// js/auth.js  (versão multi-tenant)
// ─────────────────────────────────────────────────────────────
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  salvarSessaoTenant, limparSessaoTenant,
  carregarTenant, tenantAtivo, criarTenant
} from "./tenant.js";

// ── Cadastro completo (novo dentista + nova clínica) ──────────
export async function cadastrar({ email, senha, nome, nomeClinica, telefone, plano }) {
  // 1. Cria usuário no Firebase Auth
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  const uid  = cred.user.uid;

  // 2. Cria o tenant (clínica) no Firestore
  const clinicaId = await criarTenant({
    nome: nomeClinica,
    nomeProprietario: nome,
    email,
    telefone,
    plano,
    uid
  });

  // 3. Grava o mapeamento uid → clinicaId em /usuarios/{uid}
  //    (facilita o lookup de qual clínica pertence ao usuário)
  await setDoc(doc(db, "usuarios", uid), {
    uid,
    email,
    clinicaId,
    perfil: "admin",
    criadoEm: serverTimestamp()
  });

  // 4. Salva na sessão
  salvarSessaoTenant(clinicaId, "admin");

  return { uid, clinicaId };
}

// ── Login ─────────────────────────────────────────────────────
export async function login(email, senha) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  const uid  = cred.user.uid;

  // Descobre qual clínica pertence ao usuário
  const userSnap = await getDoc(doc(db, "usuarios", uid));
  if (!userSnap.exists()) throw new Error("Usuário sem clínica associada.");

  const { clinicaId, perfil } = userSnap.data();

  // Verifica se o tenant está ativo
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

// ── Reset de senha ────────────────────────────────────────────
export async function resetSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Guarda de rota: redireciona se não autenticado ────────────
export function requireAuth(onReady) {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    // Recarrega dados do tenant a cada navegação
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!userSnap.exists()) {
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }

    const { clinicaId, perfil } = userSnap.data();
    const tenant = await carregarTenant(clinicaId);

    if (!tenant || !tenantAtivo(tenant)) {
      window.location.href = "suspenso.html";
      return;
    }

    salvarSessaoTenant(clinicaId, perfil);
    onReady({ user, clinicaId, perfil, tenant });
  });
}

// ── Guarda de rota para o painel admin (super-admin) ─────────
export function requireSuperAdmin(onReady) {
  onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = "login.html"; return; }

    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!userSnap.exists() || userSnap.data().perfil !== "superadmin") {
      window.location.href = "index.html";
      return;
    }
    onReady(user);
  });
}
