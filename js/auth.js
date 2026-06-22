// js/auth.js — versão corrigida multi-tenant
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  salvarSessaoTenant, limparSessaoTenant,
  carregarTenant, tenantAtivo, criarTenant
} from "./tenant.js";

// ── Cadastro completo ─────────────────────────────────────────
export async function cadastrar({ email, senha, nome, nomeClinica, telefone, plano }) {

  // 1. Cria o usuário no Firebase Auth
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  const uid  = cred.user.uid;

  // 2. Gera o clinicaId
  const clinicaId = gerarClinicaId(nomeClinica);

  // 3. Grava /usuarios/{uid} — o usuário está autenticado agora, então as regras permitem
  await setDoc(doc(db, "usuarios", uid), {
    uid,
    email,
    clinicaId,
    perfil: "admin",
    nome,
    criadoEm: serverTimestamp()
  });

  // 4. Grava /tenants/{clinicaId}
  const agora = new Date();
  const trial = new Date(agora);
  trial.setDate(agora.getDate() + 14);

  const { Timestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  await setDoc(doc(db, "tenants", clinicaId), {
    clinicaId,
    nome: nomeClinica,
    nomeProprietario: nome,
    email,
    telefone: telefone || "",
    plano,
    status: "trial",
    trialExpira: Timestamp.fromDate(trial),
    limites: planoLimites(plano),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });

  // 5. Grava /clinica/{clinicaId} (documento raiz)
  await setDoc(doc(db, "clinica", clinicaId), {
    nome: nomeClinica,
    criadoEm: serverTimestamp()
  });

  // 6. Grava /clinica/{clinicaId}/usuarios/{uid}
  await setDoc(doc(db, "clinica", clinicaId, "usuarios", uid), {
    uid,
    nome,
    email,
    perfil: "admin",
    ativo: true,
    criadoEm: serverTimestamp()
  });

  // 7. Salva sessão
  salvarSessaoTenant(clinicaId, "admin");

  return { uid, clinicaId };
}

// ── Login ─────────────────────────────────────────────────────
export async function login(email, senha) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  const uid  = cred.user.uid;

  const userSnap = await getDoc(doc(db, "usuarios", uid));
  if (!userSnap.exists()) throw new Error("Usuário sem clínica associada.");

  const { clinicaId, perfil } = userSnap.data();

  // Super-admin passa direto
  if (perfil === "superadmin") {
    salvarSessaoTenant(clinicaId, perfil);
    return { user: cred.user, clinicaId, perfil, tenant: { status: "ativo", plano: "clinica" } };
  }

  const tenant = await carregarTenant(clinicaId);
  if (!tenant) throw new Error("Clínica não encontrada.");
  if (!tenantAtivo(tenant)) {
    await signOut(auth);
    throw { code: "tenant/suspenso", tenant };
  }

  salvarSessaoTenant(clinicaId, perfil);
  return { user: cred.user, clinicaId, perfil, tenant };
}

// ── Logout ────────────────────────────────────────────────────
export async function logout() {
  limparSessaoTenant();
  await signOut(auth);
  window.location.href = "login.html";
}

// ── Guarda de rota ────────────────────────────────────────────
export function requireAuth(onReady) {
  onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = "login.html"; return; }

    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!userSnap.exists()) { await signOut(auth); window.location.href = "login.html"; return; }

    const { clinicaId, perfil } = userSnap.data();

    if (perfil === "superadmin") {
      salvarSessaoTenant(clinicaId, perfil);
      onReady({ user, clinicaId, perfil, tenant: { status: "ativo", plano: "clinica" } });
      return;
    }

    const tenant = await carregarTenant(clinicaId);
    if (!tenant || !tenantAtivo(tenant)) { window.location.href = "suspenso.html"; return; }

    salvarSessaoTenant(clinicaId, perfil);
    onReady({ user, clinicaId, perfil, tenant });
  });
}

// ── Super-admin ───────────────────────────────────────────────
export function requireSuperAdmin(onReady) {
  onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = "login.html"; return; }
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!userSnap.exists() || userSnap.data().perfil !== "superadmin") {
      window.location.href = "index.html"; return;
    }
    onReady(user);
  });
}

// ── Helpers ───────────────────────────────────────────────────
function gerarClinicaId(nome) {
  const slug = nome.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")
    .replace(/^-|-$/g, "").substring(0, 20);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${slug}-${rand}`;
}

function planoLimites(plano) {
  const limites = {
    starter: { maxUsuarios: 1,    maxPacientes: 100  },
    pro:     { maxUsuarios: 3,    maxPacientes: null },
    clinica: { maxUsuarios: null, maxPacientes: null }
  };
  return limites[plano] || limites.starter;
}
