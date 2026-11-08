/**
 * AXION · Ordem de serviço · Banco de dados
 *
 * Ordens (ordens.json), sincronização com o GitHub, numeração e cálculo dos totais (peças, mão
 * de obra, horas, desconto).
 *
 * Depende de: dados/github.js
 */
"use strict";

let os = [];
try {
  os = JSON.parse(lsGet(LS_OS) || "[]");
} catch (e) {
  os = [];
}
os = soItens(os).map(osNormal);
if (isProt()) {
  os = [];
  try {
    localStorage.removeItem(LS_OS);
  } catch (e) {}
}
/** Versão do ordens.json no GitHub, rascunho do editor e ordem aberta na tela. */
let osSha = null,
  osDraft = null,
  osAtual = null;
/** Número da OS com 5 dígitos: 00020. */
const osNum = (o) => String(o.numero).padStart(5, "0");
/** Próximo número livre de ordem de serviço. */
function osProximo() {
  return os.reduce((m, o) => Math.max(m, parseInt(o.numero, 10) || 0), 0) + 1;
}
/** Total de um serviço: horas × valor/hora, ou valor fixo. */
function osServTotal(s) {
  return s.modo === "fixo" ? r2(s.valor) : r2(s.horas * s.vh);
}
/** Completa uma ordem lida do aparelho ou do GitHub (listas e checklist sempre no formato certo). */
function osNormal(o) {
  const lista = (v) =>
    Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
  o.prods = lista(o.prods);
  o.servs = lista(o.servs);
  if (!OS_SIT[o.status]) o.status = "aberta";
  if (o.checklist && (typeof o.checklist !== "object" || !o.checklist.itens))
    o.checklist = { itens: {}, obs: "" };
  return o;
}
/** Início da garantia: data da conclusão (ou a data da OS, para ordens antigas); null se aberta. */
function osGarantiaInicio(o) {
  if ((o.status || "aberta") === "aberta") return null;
  return o.concluidaEm || o.data || null;
}
/**
 * Situação da garantia: { dias, fim, valida, falta } ou null quando a OS não tem garantia.
 * fim = início + dias (AAAA-MM-DD); valida = hoje ainda está dentro do prazo.
 */
function osGarantia(o) {
  const dias = parseInt(o.garantia, 10) || 0;
  if (!dias) return null;
  const ini = osGarantiaInicio(o);
  if (!ini) return { dias: dias, fim: null, valida: null, falta: null };
  const p = ini.split("-").map(Number),
    fim = new Date(p[0], p[1] - 1, p[2] + dias),
    hoje = new Date(new Date().toDateString());
  const iso =
    fim.getFullYear() +
    "-" +
    pad2(fim.getMonth() + 1) +
    "-" +
    pad2(fim.getDate());
  return {
    dias: dias,
    fim: iso,
    valida: hoje <= fim,
    falta: Math.round((fim - hoje) / 86400000),
  };
}
/** Garantia em texto curto: "90 dias · até 05/02/2027". */
function osGarantiaTexto(o) {
  const g = osGarantia(o);
  if (!g) return "Sem garantia";
  return (
    g.dias +
    " dias · " +
    (g.fim ? "até " + dataBR(g.fim) : "conta a partir da conclusão")
  );
}
/** Registra a data de conclusão quando a OS sai de "aberta" (e limpa se voltar a "aberta"). */
function osMarcarConclusao(o, statusAnterior) {
  if ((o.status || "aberta") === "aberta") o.concluidaEm = "";
  else if (!o.concluidaEm)
    o.concluidaEm =
      (statusAnterior || "aberta") === "aberta" ? hojeISO() : o.data;
}
/** Totais da ordem: produtos, serviços, horas, desconto e total geral. */
function osTotals(o) {
  const prod = (o.prods || []).reduce((a, p) => a + r2(p.qtd * p.valor), 0);
  const serv = (o.servs || []).reduce((a, s) => a + osServTotal(s), 0);
  const horas = (o.servs || [])
    .filter((s) => s.modo === "hora")
    .reduce((a, s) => a + s.horas, 0);
  const desc = Math.min(r2(o.desconto || 0), r2(prod + serv));
  return {
    prod: r2(prod),
    serv: r2(serv),
    horas: horas,
    desc: desc,
    total: r2(prod + serv - desc),
  };
}
/** Guarda o cache local das ordens (desligado quando o token tem senha). */
function persistOs() {
  if (isProt()) {
    try {
      localStorage.removeItem(LS_OS);
    } catch (e) {}
  } else lsSet(LS_OS, JSON.stringify(os));
}
/** Endereço do ordens.json na API do GitHub. */
const osUrl = (c) =>
  "https://api.github.com/repos/" + c.repo + "/contents/" + OS_PATH;
/** Baixa as ordens do GitHub (arquivo novo = lista vazia). */
async function osLoad() {
  const c = cfg();
  if (!c.repo || !c.token) return false;
  const r = await fetch(osUrl(c) + "?t=" + Date.now(), {
    headers: ghHead(c),
    cache: "no-store",
  });
  if (r.status === 404) {
    osSha = null;
    return true;
  }
  if (!r.ok) throw new Error(ghErr(r.status));
  const j = await r.json();
  osSha = j.sha;
  const raw = b64dec(j.content || "").trim();
  let arr = [];
  if (raw) {
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        "o arquivo " +
          OS_PATH +
          " não é um JSON válido. Apague-o no GitHub e tente de novo",
      );
    }
  }
  os = soItens(arr).map(osNormal);
  return true;
}
/** Envia as ordens para o GitHub. */
async function osPush(msg) {
  const c = cfg();
  const body = { message: msg, content: b64enc(JSON.stringify(os, null, 1)) };
  if (osSha) body.sha = osSha;
  const r = await fetch(osUrl(c), {
    method: "PUT",
    headers: Object.assign({ "Content-Type": "application/json" }, ghHead(c)),
    body: JSON.stringify(body),
  });
  if (r.status === 409 || r.status === 422) {
    const e = new Error("conflito");
    e.conflict = true;
    throw e;
  }
  if (!r.ok) throw new Error(ghErr(r.status));
  osSha = (await r.json()).content.sha;
}
/** Aplica uma alteração nas ordens e sincroniza (GitHub ou só neste aparelho). */
async function osSync(mut, okMsg, commitMsg) {
  if (isProt() && !(await ensureUnlocked())) {
    setSync("⚠️ Não salvo: senha não informada.");
    return false;
  }
  const c = cfg();
  const fim = () => {
    renderOsList();
    renderHome();
  };
  if (!(c.repo && c.token)) {
    mut(os);
    persistOs();
    setSync(
      "💾 " +
        okMsg +
        " (somente neste aparelho). Toque em ⚙️ para guardar no GitHub.",
    );
    fim();
    return true;
  }
  for (let t = 0; t < 2; t++) {
    let applied = false;
    try {
      await osLoad();
      mut(os);
      applied = true;
      persistOs();
      await osPush(commitMsg);
      setSync("✅ " + okMsg + " no GitHub (" + c.repo + ")");
      markSync(true);
      fim();
      return true;
    } catch (e) {
      if (e && e.conflict && t === 0) continue;
      if (!applied) mut(os);
      persistOs();
      markSync(false);
      setSync(
        isProt()
          ? "⚠️ Não salvou no GitHub: " +
              ((e && e.message) || e) +
              ". Tente de novo."
          : "⚠️ " +
              okMsg +
              " só neste aparelho. GitHub: " +
              ((e && e.message) || e),
      );
      fim();
      return false;
    }
  }
}
/** Carrega ordens e cadastro (pede a senha se preciso). */
async function prepararOs() {
  if (isProt() && !(await ensureUnlocked())) {
    say("🔒 Senha necessária para usar as ordens de serviço.", true);
    return false;
  }
  const c = cfg();
  if (c.repo && c.token) {
    try {
      await osLoad();
      persistOs();
      await catalogo.load();
      catalogo.persist();
    } catch (e) {
      say(
        "⚠️ Não sincronizou: " +
          ((e && e.message) || e) +
          ". Usando os dados deste aparelho.",
        true,
      );
    }
  }
  atualizarListaSvc();
  return true;
}
/** Nova OS: confere a numeração com o GitHub antes de abrir o editor. */
async function novaOs() {
  if (!(await prepararOs())) return;
  osEditor(null);
}
