/**
 * AXION · Configuração
 *
 * Todos os valores fixos do sistema ficam aqui: dados da empresa, limite do MEI,
 * categorias, formas de pagamento e nomes dos arquivos/chaves de armazenamento.
 * Para mudar um texto ou valor fixo, mude AQUI — o resto do código só lê estas constantes.
 *
 * Depende de: base/logo.js
 */
"use strict";

/* ---------------------------------------------------------------- Publicação */

/** Identificação desta publicação: o js/app/versao.js confere se todos os arquivos são da mesma versão. */
window.AXION_BUILD = "2026-11-08.1";

/** Mostra na tela qualquer erro inesperado (ajuda a diagnosticar no celular). */
window.addEventListener("error", function (e) {
  var m = document.getElementById("msg");
  if (m) {
    m.textContent = "Erro: " + (e.message || "desconhecido");
    m.className = "err";
  }
});

/* ---------------------------------------------------------------- Empresa */

/** Logo da AXION (data URI definido em base/logo.js), usada nos documentos e relatórios. */
const LOGO = window.AXION_LOGO;

/** Nome fantasia que aparece na nota personalizada e nos relatórios. */
const FANTASIA = "AXION | SISTEMAS EMBARCADOS E ENERGIA";

/** Cabeçalho da ordem de serviço. */
const OS_EMPRESA = {
  nome: "AXION MOTORHOME",
  slogan: "Tecnologia para sistemas embarcados e energia",
  razao: "66.730.393 FILIPE LOPES ALVES",
  cnpj: "CNPJ 66.730.393/0001-05",
};

/** Limite anual de faturamento do MEI (R$). Atualize se a lei mudar. */
const LIMITE_MEI = 81000;

/* ---------------------------------------------------------------- Listas e textos */

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** Categorias sugeridas ao lançar entradas e despesas nas Finanças. */
const CATS_ENTRADA = [
  "Salário",
  "Serviço",
  "Reembolso/Estorno",
  "Venda",
  "Outros",
];
const CATS_DESPESA = [
  "Moradia",
  "Contas (água, luz, telefone)",
  "Cartão de crédito",
  "Financiamento/Consórcio",
  "Dízimo/Doações",
  "Saúde",
  "Transporte",
  "Alimentação",
  "Educação",
  "Impostos (DAS)",
  "Impostos/Taxas",
  "Ferramentas/Software",
  "Material/Peças",
  "Marketing",
  "Contador",
  "Retirada (pró-labore)",
  "Outros",
];

/** Situações da ordem de serviço: com ícone (botões) e sem ícone (relatórios). */
const OS_STATUS_TXT = {
  aberta: "🛠 Aberta",
  concluida: "✔️ Concluída",
  paga: "✅ Paga",
};
const OS_SIT = { aberta: "Aberta", concluida: "Concluída", paga: "Paga" };

/** Formas de pagamento oferecidas na ordem de serviço. */
const OS_PAGAMENTOS = [
  "A definir",
  "Pix",
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Transferência",
  "Boleto",
];

/* ---------------------------------------------------------------- Armazenamento */

/** Arquivos JSON no repositório privado do GitHub (o de notas pode ser trocado em Configurações). */
const NOTAS_PATH = "notas.json";
const FIN_PATH = "financeiro.json";
const PERFIS_PATH = "perfis.json";
const OS_PATH = "ordens.json";
const SERVICOS_PATH = "servicos.json";

/** Chaves do armazenamento local do navegador (cópia neste aparelho quando não há senha). */
const LS_CFG = "axion_nfse_cfg";
const LS_NOTES = "axion_nfse_notas";
const LS_FIN = "axion_nfse_fin";
const LS_PERFIS = "axion_nfse_perfis";
const LS_OS = "axion_nfse_os";
const LS_SERVICOS = "axion_nfse_servicos";
const LS_LASTSYNC = "axion_nfse_lastsync";
