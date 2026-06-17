// js/tenant.js
// ─────────────────────────────────────────────────────────────
// Núcleo do multi-tenancy — cria, carrega e gerencia tenants
// Um "tenant" = uma clínica odontológica (cliente do SaaS)
// ─────────────────────────────────────────────────────────────
import { db, auth } from "./firebase.js";
import {
  doc, collection, addDoc, setDoc, getDoc, getDocs,
  updateDoc, query, where, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ══════════════════════════════════════════════════════════════
// ESTRUTURA DO TENANT NO FIRESTORE
//
// tenants/{clinicaId}                ← documento raiz do tenant
//   nome:          "Clínica Sorriso"
//   nomeProprietario: "Dr. Rafael"
//   email:         "dr@clinica.com"
//   telefone:      "(11) 99999-9999"
//   plano:         "starter" | "pro" | "clinica"
//   status:        "trial" | "ativo" | "suspenso" | "cancelado"
//   trialExpira:   Timestamp (14 dias após cadastro)
//   stripeCustomerId: "cus_xxx"
//   stripeSubscriptionId: "sub_xxx"
//   criadoEm:      Timestamp
//   atualizadoEm:  Timestamp
//   limites:       { maxUsuarios: 1, maxPacientes: 100 }
//
// clinica/{clinicaId}/...            ← dados clínicos (já existente)
// ══════════════════════════════════════════════════════════════

export const PLANOS = {
  starter: {
    nome: "Starter",
    preco: 89,
    maxUsuarios: 1,
    maxPacientes: 100,
    descricao: "Ideal para dentistas autônomos"
  },
  pro: {
    nome: "Pro",
    preco: 179,
    maxUsuarios: 3,
    maxPacientes: null,   // ilimitado
    descricao: "Para clínicas com pequena equipe"
  },
  clinica: {
    nome: "Clínica",
    preco: 349,
    maxUsuarios: null,    // ilimitado
    maxPacientes: null,   // ilimitado
    descricao: "Clínicas grandes com múltiplas cadeiras"
  }
};

// ── Gera um ID legível e único para a clínica ─────────────────
function gerarClinicaId(nome) {
  const slug = nome
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 20);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${slug}-${rand}`;
}

// ── Cria um novo tenant (chamado no cadastro) ─────────────────
export async function criarTenant({ nome, nomeProprietario, email, telefone, plano, uid }) {
  const clinicaId = gerarClinicaId(nome);
  const agora     = new Date();
  const trial     = new Date(agora);
  trial.setDate(agora.getDate() + 14);

  const dadosTenant = {
    clinicaId,
    nome,
    nomeProprietario,
    email,
    telefone: telefone || "",
    plano,
    status: "trial",
    trialExpira: Timestamp.fromDate(trial),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    limites: {
      maxUsuarios: PLANOS[plano].maxUsuarios,
      maxPacientes: PLANOS[plano].maxPacientes
    },
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  };

  // Grava o tenant
  await setDoc(doc(db, "tenants", clinicaId), dadosTenant);

  // Cria documento raiz da clínica (para os dados clínicos)
  await setDoc(doc(db, "clinica", clinicaId), {
    nome,
    criadoEm: serverTimestamp()
  });

  // Cria o primeiro usuário (admin/proprietário)
  await setDoc(doc(db, "clinica", clinicaId, "usuarios", uid), {
    uid,
    nome: nomeProprietario,
    email,
    perfil: "admin",
    ativo: true,
    criadoEm: serverTimestamp()
  });

  return clinicaId;
}

// ── Carrega o tenant do usuário logado ────────────────────────
export async function carregarTenantDoUsuario(uid) {
  // Busca em qual clínica esse uid é usuário
  // (índice: clinica/*/usuarios/{uid})
  // Como Firestore não faz collectionGroup query com UID facilmente,
  // guardamos o clinicaId no próprio documento do usuário em /usuarios/{uid}
  const userRef = doc(db, "usuarios", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return null;

  const clinicaId = userSnap.data().clinicaId;
  return carregarTenant(clinicaId);
}

// ── Carrega um tenant pelo ID ─────────────────────────────────
export async function carregarTenant(clinicaId) {
  const snap = await getDoc(doc(db, "tenants", clinicaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ── Verifica se o tenant está ativo (trial ou pago) ──────────
export function tenantAtivo(tenant) {
  if (!tenant) return false;
  if (tenant.status === "ativo") return true;
  if (tenant.status === "trial") {
    const agora = new Date();
    const expira = tenant.trialExpira?.toDate?.() || new Date(0);
    return agora < expira;
  }
  return false;
}

// ── Dias restantes de trial ───────────────────────────────────
export function diasRestantesTrial(tenant) {
  if (!tenant || tenant.status !== "trial") return 0;
  const expira = tenant.trialExpira?.toDate?.() || new Date(0);
  const diff = expira - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Verifica limite de pacientes ──────────────────────────────
export async function verificarLimitePacientes(clinicaId) {
  const tenant = await carregarTenant(clinicaId);
  if (!tenant) return false;
  const max = tenant.limites?.maxPacientes;
  if (!max) return true; // ilimitado

  const snap = await getDocs(
    query(
      collection(db, "clinica", clinicaId, "pacientes"),
      where("ativo", "==", true)
    )
  );
  return snap.size < max;
}

// ── Verifica limite de usuários ───────────────────────────────
export async function verificarLimiteUsuarios(clinicaId) {
  const tenant = await carregarTenant(clinicaId);
  if (!tenant) return false;
  const max = tenant.limites?.maxUsuarios;
  if (!max) return true;

  const snap = await getDocs(
    collection(db, "clinica", clinicaId, "usuarios")
  );
  return snap.size < max;
}

// ── Atualiza plano (após pagamento confirmado) ────────────────
export async function ativarPlano(clinicaId, plano, stripeData = {}) {
  await updateDoc(doc(db, "tenants", clinicaId), {
    plano,
    status: "ativo",
    limites: {
      maxUsuarios: PLANOS[plano].maxUsuarios,
      maxPacientes: PLANOS[plano].maxPacientes
    },
    ...stripeData,
    atualizadoEm: serverTimestamp()
  });
}

// ── Suspende um tenant (inadimplência) ───────────────────────
export async function suspenderTenant(clinicaId, motivo = "") {
  await updateDoc(doc(db, "tenants", clinicaId), {
    status: "suspenso",
    motivoSuspensao: motivo,
    suspendidoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });
}

// ── Reativa um tenant ─────────────────────────────────────────
export async function reativarTenant(clinicaId) {
  await updateDoc(doc(db, "tenants", clinicaId), {
    status: "ativo",
    motivoSuspensao: null,
    suspendidoEm: null,
    atualizadoEm: serverTimestamp()
  });
}

// ── Lista todos os tenants (painel admin) ─────────────────────
export async function listarTodosTenants({ status } = {}) {
  const q = status
    ? query(collection(db, "tenants"), where("status", "==", status), orderBy("criadoEm", "desc"))
    : query(collection(db, "tenants"), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Salva o tenant ativo na sessão (localStorage) ─────────────
export function salvarSessaoTenant(clinicaId, perfil) {
  localStorage.setItem("clinicaId", clinicaId);
  localStorage.setItem("perfil", perfil);
}

export function limparSessaoTenant() {
  localStorage.removeItem("clinicaId");
  localStorage.removeItem("perfil");
}

export function getClinicaIdSessao() {
  return localStorage.getItem("clinicaId");
}

export function getPerfilSessao() {
  return localStorage.getItem("perfil");
}
