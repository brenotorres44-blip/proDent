// js/db.js  (versão multi-tenant com isolamento forçado)
// ─────────────────────────────────────────────────────────────
// REGRA DE OURO: nenhuma função acessa dados sem um clinicaId.
// O clinicaId vem sempre da sessão autenticada, nunca da URL.
// ─────────────────────────────────────────────────────────────
import { db } from "./firebase.js";
import { getClinicaIdSessao } from "./tenant.js";
import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query,
  where, orderBy, limit,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Referência de coleção sempre isolada pelo clinicaId da sessão
function col(nome, clinicaId) {
  const id = clinicaId || getClinicaIdSessao();
  if (!id) throw new Error("Sessão sem clinicaId. Faça login.");
  return collection(db, "clinica", id, nome);
}

function docRef(nome, id, clinicaId) {
  const cid = clinicaId || getClinicaIdSessao();
  if (!cid) throw new Error("Sessão sem clinicaId. Faça login.");
  return doc(db, "clinica", cid, nome, id);
}

// ─────────────────────────────────────────────────────────────
// USUÁRIOS DA CLÍNICA
// ─────────────────────────────────────────────────────────────
export const Usuarios = {
  async criar(uid, dados, clinicaId) {
    return setDoc(doc(db, "clinica", clinicaId || getClinicaIdSessao(), "usuarios", uid), {
      ...dados,
      uid,
      ativo: true,
      criadoEm: serverTimestamp()
    });
  },

  async listar(clinicaId) {
    const snap = await getDocs(col("usuarios", clinicaId));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async atualizar(uid, dados, clinicaId) {
    return updateDoc(docRef("usuarios", uid, clinicaId), {
      ...dados,
      atualizadoEm: serverTimestamp()
    });
  },

  async desativar(uid, clinicaId) {
    return updateDoc(docRef("usuarios", uid, clinicaId), {
      ativo: false,
      atualizadoEm: serverTimestamp()
    });
  }
};

// ─────────────────────────────────────────────────────────────
// PACIENTES
// ─────────────────────────────────────────────────────────────
export const Pacientes = {
  async criar(dados, clinicaId) {
    return addDoc(col("pacientes", clinicaId), {
      ...dados,
      ativo: true,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  },

  async atualizar(id, dados, clinicaId) {
    return updateDoc(docRef("pacientes", id, clinicaId), {
      ...dados,
      atualizadoEm: serverTimestamp()
    });
  },

  async excluir(id, clinicaId) {
    return updateDoc(docRef("pacientes", id, clinicaId), {
      ativo: false,
      atualizadoEm: serverTimestamp()
    });
  },

  async buscarPorId(id, clinicaId) {
    const snap = await getDoc(docRef("pacientes", id, clinicaId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async listar({ apenasAtivos = true } = {}, clinicaId) {
    const q = apenasAtivos
      ? query(col("pacientes", clinicaId), where("ativo", "==", true), orderBy("nome"))
      : query(col("pacientes", clinicaId), orderBy("nome"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async buscarPorNome(termo, clinicaId) {
    const fim = termo + "\uf8ff";
    const q   = query(
      col("pacientes", clinicaId),
      where("nome", ">=", termo),
      where("nome", "<=", fim),
      orderBy("nome"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async contar(clinicaId) {
    const snap = await getDocs(
      query(col("pacientes", clinicaId), where("ativo", "==", true))
    );
    return snap.size;
  }
};

// ─────────────────────────────────────────────────────────────
// AGENDAMENTOS
// ─────────────────────────────────────────────────────────────
export const Agendamentos = {
  async criar(dados, clinicaId) {
    return addDoc(col("agendamentos", clinicaId), {
      ...dados,
      status: dados.status || "agendado",
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  },

  async atualizar(id, dados, clinicaId) {
    return updateDoc(docRef("agendamentos", id, clinicaId), {
      ...dados,
      atualizadoEm: serverTimestamp()
    });
  },

  async atualizarStatus(id, status, clinicaId) {
    return updateDoc(docRef("agendamentos", id, clinicaId), {
      status,
      atualizadoEm: serverTimestamp()
    });
  },

  async buscarPorDia(data, clinicaId) {
    const inicio = new Date(data); inicio.setHours(0,0,0,0);
    const fim    = new Date(data); fim.setHours(23,59,59,999);
    const q = query(
      col("agendamentos", clinicaId),
      where("dataHora", ">=", Timestamp.fromDate(inicio)),
      where("dataHora", "<=", Timestamp.fromDate(fim)),
      orderBy("dataHora")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async buscarPorSemana(dataInicio, clinicaId) {
    const fim = new Date(dataInicio);
    fim.setDate(dataInicio.getDate() + 6);
    fim.setHours(23,59,59,999);
    const q = query(
      col("agendamentos", clinicaId),
      where("dataHora", ">=", Timestamp.fromDate(dataInicio)),
      where("dataHora", "<=", Timestamp.fromDate(fim)),
      orderBy("dataHora")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async buscarPorPaciente(pacienteId, clinicaId) {
    const q = query(
      col("agendamentos", clinicaId),
      where("pacienteId", "==", pacienteId),
      orderBy("dataHora", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// ─────────────────────────────────────────────────────────────
// PROCEDIMENTOS
// ─────────────────────────────────────────────────────────────
export const Procedimentos = {
  async criar(dados, clinicaId) {
    return addDoc(col("procedimentos", clinicaId), {
      ...dados,
      status: dados.status || "em_andamento",
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  },

  async atualizar(id, dados, clinicaId) {
    return updateDoc(docRef("procedimentos", id, clinicaId), {
      ...dados,
      atualizadoEm: serverTimestamp()
    });
  },

  async buscarPorPaciente(pacienteId, clinicaId) {
    const q = query(
      col("procedimentos", clinicaId),
      where("pacienteId", "==", pacienteId),
      orderBy("dataRealizacao", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async listarRecentes(qtd = 30, clinicaId) {
    const q = query(
      col("procedimentos", clinicaId),
      orderBy("criadoEm", "desc"),
      limit(qtd)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async buscarPorMes(ano, mes, clinicaId) {
    const inicio = new Date(ano, mes-1, 1);
    const fim    = new Date(ano, mes, 0, 23, 59, 59);
    const q = query(
      col("procedimentos", clinicaId),
      where("dataRealizacao", ">=", Timestamp.fromDate(inicio)),
      where("dataRealizacao", "<=", Timestamp.fromDate(fim)),
      orderBy("dataRealizacao", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// ─────────────────────────────────────────────────────────────
// CONTAS A RECEBER
// ─────────────────────────────────────────────────────────────
export const ContasReceber = {
  async criar(dados, clinicaId) {
    return addDoc(col("contas_receber", clinicaId), {
      ...dados,
      valorPago: dados.valorPago || 0,
      status: dados.status || "aberto",
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  },

  async registrarPagamento(id, valorPago, formaPagamento, clinicaId) {
    const snap = await getDoc(docRef("contas_receber", id, clinicaId));
    if (!snap.exists()) throw new Error("Conta não encontrada");
    const conta     = snap.data();
    const totalPago = (conta.valorPago || 0) + valorPago;
    const status    = totalPago >= conta.valor ? "pago" : "parcial";
    return updateDoc(docRef("contas_receber", id, clinicaId), {
      valorPago: totalPago,
      formaPagamento,
      status,
      dataPagamento: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  },

  async listar({ status } = {}, clinicaId) {
    const q = status
      ? query(col("contas_receber", clinicaId), where("status", "==", status), orderBy("vencimento"))
      : query(col("contas_receber", clinicaId), orderBy("vencimento", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async emAtraso(clinicaId) {
    const agora = Timestamp.fromDate(new Date());
    const q = query(
      col("contas_receber", clinicaId),
      where("status", "in", ["aberto", "parcial"]),
      where("vencimento", "<", agora),
      orderBy("vencimento")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async totalMes(ano, mes, clinicaId) {
    const dados = await this.buscarPorMes(ano, mes, clinicaId);
    return dados.reduce((acc, c) => acc + (c.valorPago || 0), 0);
  },

  async buscarPorMes(ano, mes, clinicaId) {
    const inicio = new Date(ano, mes-1, 1);
    const fim    = new Date(ano, mes, 0, 23, 59, 59);
    const q = query(
      col("contas_receber", clinicaId),
      where("vencimento", ">=", Timestamp.fromDate(inicio)),
      where("vencimento", "<=", Timestamp.fromDate(fim)),
      orderBy("vencimento")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// ─────────────────────────────────────────────────────────────
// CONTAS A PAGAR
// ─────────────────────────────────────────────────────────────
export const ContasPagar = {
  async criar(dados, clinicaId) {
    return addDoc(col("contas_pagar", clinicaId), {
      ...dados,
      valorPago: 0,
      status: "aberto",
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  },

  async marcarComoPago(id, formaPagamento, clinicaId) {
    return updateDoc(docRef("contas_pagar", id, clinicaId), {
      status: "pago",
      formaPagamento,
      dataPagamento: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  },

  async atualizar(id, dados, clinicaId) {
    return updateDoc(docRef("contas_pagar", id, clinicaId), {
      ...dados,
      atualizadoEm: serverTimestamp()
    });
  },

  async excluir(id, clinicaId) {
    return deleteDoc(docRef("contas_pagar", id, clinicaId));
  },

  async listar({ status } = {}, clinicaId) {
    const q = status
      ? query(col("contas_pagar", clinicaId), where("status", "==", status), orderBy("vencimento"))
      : query(col("contas_pagar", clinicaId), orderBy("vencimento", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async emAtraso(clinicaId) {
    const agora = Timestamp.fromDate(new Date());
    const q = query(
      col("contas_pagar", clinicaId),
      where("status", "==", "aberto"),
      where("vencimento", "<", agora),
      orderBy("vencimento")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async buscarPorMes(ano, mes, clinicaId) {
    const inicio = new Date(ano, mes-1, 1);
    const fim    = new Date(ano, mes, 0, 23, 59, 59);
    const q = query(
      col("contas_pagar", clinicaId),
      where("vencimento", ">=", Timestamp.fromDate(inicio)),
      where("vencimento", "<=", Timestamp.fromDate(fim)),
      orderBy("vencimento")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// ─────────────────────────────────────────────────────────────
// DASHBOARD — agrega dados do tenant
// ─────────────────────────────────────────────────────────────
export const Dashboard = {
  async resumoHoje(clinicaId) {
    const hoje      = new Date();
    const [agendamentos, atrasados] = await Promise.all([
      Agendamentos.buscarPorDia(hoje, clinicaId),
      ContasReceber.emAtraso(clinicaId)
    ]);
    return {
      totalConsultasHoje: agendamentos.length,
      agendamentos,
      totalAtrasados:     atrasados.length,
      valorAtrasado:      atrasados.reduce((s, c) => s + (c.valor - (c.valorPago || 0)), 0)
    };
  },

  async resumoMes(ano, mes, clinicaId) {
    const [recebido, despesas, procs, pacientes] = await Promise.all([
      ContasReceber.totalMes(ano, mes, clinicaId),
      ContasPagar.buscarPorMes(ano, mes, clinicaId),
      Procedimentos.buscarPorMes(ano, mes, clinicaId),
      Pacientes.contar(clinicaId)
    ]);
    const totalPago = despesas.filter(d => d.status === "pago").reduce((s, d) => s + d.valor, 0);
    return {
      recebido,
      despesas: totalPago,
      lucro:    recebido - totalPago,
      totalProcedimentos: procs.length,
      totalPacientes:     pacientes,
      ticketMedio: procs.length
        ? procs.reduce((s, p) => s + (p.valor || 0), 0) / procs.length
        : 0
    };
  }
};
