// js/seed.js
// ─────────────────────────────────────────────────────────────
// Script de seed — popula o Firestore com dados iniciais
// Execute UMA VEZ após criar o projeto Firebase.
// Acesse a página seed.html logado como admin para rodar.
// ─────────────────────────────────────────────────────────────
import { db, auth }    from "./firebase.js";
import { Pacientes, Agendamentos, Procedimentos, ContasReceber, ContasPagar } from "./db.js";
import { Timestamp }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function ts(ano, mes, dia, hora = 0, min = 0) {
  return Timestamp.fromDate(new Date(ano, mes - 1, dia, hora, min));
}

export async function runSeed(log) {
  log("Criando pacientes...");

  const pacientes = [
    { nome: "Ana Mendes",       cpf: "111.222.333-44", dataNasc: "1988-04-12", telefone: "(11) 98765-4321", email: "ana@email.com",      convenio: "Unimed" },
    { nome: "Carlos Silva",     cpf: "222.333.444-55", dataNasc: "1975-07-30", telefone: "(11) 97654-3210", email: "carlos@email.com",    convenio: "" },
    { nome: "Mariana Oliveira", cpf: "333.444.555-66", dataNasc: "1992-11-05", telefone: "(11) 96543-2109", email: "mariana@email.com",   convenio: "Bradesco" },
    { nome: "Pedro Fontes",     cpf: "444.555.666-77", dataNasc: "2005-03-22", telefone: "(11) 95432-1098", email: "pedro@email.com",     convenio: "Amil" },
    { nome: "Lúcia Costa",      cpf: "555.666.777-88", dataNasc: "1963-09-14", telefone: "(11) 94321-0987", email: "lucia@email.com",     convenio: "" },
    { nome: "Roberto Braga",    cpf: "666.777.888-99", dataNasc: "1980-02-08", telefone: "(11) 93210-9876", email: "roberto@email.com",   convenio: "SulAmérica" },
    { nome: "Juliana Neves",    cpf: "777.888.999-00", dataNasc: "1995-06-19", telefone: "(11) 92109-8765", email: "juliana@email.com",   convenio: "" },
    { nome: "Thiago Melo",      cpf: "888.999.000-11", dataNasc: "1987-12-27", telefone: "(11) 91098-7654", email: "thiago@email.com",    convenio: "Unimed" },
  ];

  const ids = {};
  for (const p of pacientes) {
    const ref = await Pacientes.criar(p);
    ids[p.nome] = ref.id;
    log(`  ✓ ${p.nome}`);
  }

  log("Criando agendamentos de hoje...");
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const agendHoje = [
    { pacienteId: ids["Ana Mendes"],       pacienteNome: "Ana Mendes",       procedimento: "Consulta de Rotina",      dataHora: ts(2026,6,17,8,0),  duracao: 60, status: "concluido" },
    { pacienteId: ids["Carlos Silva"],     pacienteNome: "Carlos Silva",     procedimento: "Extração Simples",        dataHora: ts(2026,6,17,9,0),  duracao: 60, status: "concluido" },
    { pacienteId: ids["Mariana Oliveira"], pacienteNome: "Mariana Oliveira", procedimento: "Clareamento",             dataHora: ts(2026,6,17,10,0), duracao: 90, status: "concluido" },
    { pacienteId: ids["Pedro Fontes"],     pacienteNome: "Pedro Fontes",     procedimento: "Manutenção Ortodôntica",  dataHora: ts(2026,6,17,11,0), duracao: 60, status: "em_atendimento" },
    { pacienteId: ids["Lúcia Costa"],      pacienteNome: "Lúcia Costa",      procedimento: "Tratamento de Canal",     dataHora: ts(2026,6,17,14,0), duracao: 90, status: "agendado" },
    { pacienteId: ids["Roberto Braga"],    pacienteNome: "Roberto Braga",    procedimento: "Restauração",             dataHora: ts(2026,6,17,15,0), duracao: 60, status: "agendado" },
    { pacienteId: ids["Juliana Neves"],    pacienteNome: "Juliana Neves",    procedimento: "Implante",                dataHora: ts(2026,6,17,16,0), duracao: 120, status: "agendado" },
    { pacienteId: ids["Thiago Melo"],      pacienteNome: "Thiago Melo",      procedimento: "Raspagem Periodontal",    dataHora: ts(2026,6,17,17,0), duracao: 60, status: "confirmado" },
  ];
  for (const a of agendHoje) { await Agendamentos.criar(a); }
  log(`  ✓ ${agendHoje.length} agendamentos criados`);

  log("Criando procedimentos...");
  const procs = [
    { pacienteId: ids["Ana Mendes"],       pacienteNome: "Ana Mendes",       tipo: "Clareamento Dental",        dentes: [],    valor: 1200, status: "concluido",    dataRealizacao: ts(2026,6,17) },
    { pacienteId: ids["Carlos Silva"],     pacienteNome: "Carlos Silva",     tipo: "Extração Simples",           dentes: [28],  valor: 450,  status: "concluido",    dataRealizacao: ts(2026,6,16) },
    { pacienteId: ids["Mariana Oliveira"], pacienteNome: "Mariana Oliveira", tipo: "Restauração em Resina",      dentes: [16,17], valor: 580, status: "concluido",   dataRealizacao: ts(2026,6,15) },
    { pacienteId: ids["Pedro Fontes"],     pacienteNome: "Pedro Fontes",     tipo: "Manutenção Ortodôntica",     dentes: [],    valor: 300,  status: "em_andamento", dataRealizacao: ts(2026,6,14) },
    { pacienteId: ids["Lúcia Costa"],      pacienteNome: "Lúcia Costa",      tipo: "Tratamento de Canal",        dentes: [36],  valor: 1800, status: "parcial",      dataRealizacao: ts(2026,6,13) },
    { pacienteId: ids["Juliana Neves"],    pacienteNome: "Juliana Neves",    tipo: "Implante Osseointegrado",    dentes: [46],  valor: 4500, status: "em_andamento", dataRealizacao: ts(2026,6,12) },
    { pacienteId: ids["Thiago Melo"],      pacienteNome: "Thiago Melo",      tipo: "Raspagem Periodontal",       dentes: [],    valor: 900,  status: "concluido",    dataRealizacao: ts(2026,6,11) },
    { pacienteId: ids["Roberto Braga"],    pacienteNome: "Roberto Braga",    tipo: "Prótese Parcial",            dentes: [],    valor: 2200, status: "parcial",       dataRealizacao: ts(2026,6,10) },
  ];
  for (const p of procs) { await Procedimentos.criar(p); }
  log(`  ✓ ${procs.length} procedimentos criados`);

  log("Criando contas a receber...");
  const receber = [
    { pacienteId: ids["Ana Mendes"],    pacienteNome: "Ana Mendes",    descricao: "Implante — parcela 2/3",    valor: 1800, vencimento: ts(2026,6,18), status: "aberto" },
    { pacienteId: ids["Carlos Silva"],  pacienteNome: "Carlos Silva",  descricao: "Ortodontia — parcela 1/12", valor: 950,  vencimento: ts(2026,6,12), status: "atrasado" },
    { pacienteId: ids["Lúcia Costa"],   pacienteNome: "Lúcia Costa",   descricao: "Canal — parcela 2/2",       valor: 900,  vencimento: ts(2026,6,20), status: "aberto" },
    { pacienteId: ids["Juliana Neves"], pacienteNome: "Juliana Neves", descricao: "Implante — parcela 1/4",    valor: 1125, vencimento: ts(2026,6,25), status: "aberto" },
    { pacienteId: ids["Pedro Fontes"],  pacienteNome: "Pedro Fontes",  descricao: "Ortodontia — parcela 3/12", valor: 300,  vencimento: ts(2026,6,5),  status: "pago", valorPago: 300 },
    { pacienteId: ids["Thiago Melo"],   pacienteNome: "Thiago Melo",   descricao: "Periodontia",               valor: 900,  vencimento: ts(2026,6,2),  status: "pago", valorPago: 900 },
  ];
  for (const c of receber) { await ContasReceber.criar(c); }
  log(`  ✓ ${receber.length} contas a receber criadas`);

  log("Criando contas a pagar...");
  const pagar = [
    { descricao: "Aluguel do Consultório",     fornecedor: "Imobiliária Central",  categoria: "infraestrutura", valor: 3200, vencimento: ts(2026,6,25), status: "aberto" },
    { descricao: "Materiais odontológicos",    fornecedor: "DentalFornece Ltda.",  categoria: "materiais",      valor: 1450, vencimento: ts(2026,6,28), status: "aberto" },
    { descricao: "Licença de Software",        fornecedor: "SaaS Provider",        categoria: "tecnologia",     valor: 280,  vencimento: ts(2026,6,30), status: "aberto" },
    { descricao: "Energia Elétrica",           fornecedor: "Enel",                 categoria: "utilidades",     valor: 380,  vencimento: ts(2026,6,10), status: "pago" },
    { descricao: "Folha de Pagamento",         fornecedor: "Funcionários",         categoria: "rh",             valor: 4200, vencimento: ts(2026,6,5),  status: "pago" },
    { descricao: "Contador",                   fornecedor: "Escritório Contábil",  categoria: "servicos",       valor: 450,  vencimento: ts(2026,6,1),  status: "pago" },
    { descricao: "Internet + Telefone",        fornecedor: "Claro",                categoria: "utilidades",     valor: 220,  vencimento: ts(2026,6,1),  status: "pago" },
  ];
  for (const c of pagar) { await ContasPagar.criar(c); }
  log(`  ✓ ${pagar.length} contas a pagar criadas`);

  log("✅ Seed concluído com sucesso!");
}
