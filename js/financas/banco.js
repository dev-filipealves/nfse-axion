/**
 * AXION · Finanças · Banco de dados
 *
 * Lançamentos (financeiro.json), sincronização com o GitHub e cálculos do mês (totais,
 * categorias, meses disponíveis).
 *
 * Depende de: dados/github.js
 */
"use strict";

/** Lançamentos de todos os perfis (cópia local quando não há senha). */
let fin = [];
try {
  fin = JSON.parse(lsGet(LS_FIN) || "[]");
} catch (e) {
  fin = [];
}
fin = soItens(fin);
if (isProt()) {
  fin = [];
  try {
    localStorage.removeItem(LS_FIN);
  } catch (e) {}
}
/** Versão do financeiro.json no GitHub (necessária para gravar). */
let finSha = null;
/** Perfil aberto e mês exibido na tela do Financeiro. */
let finLedger = "PF";
let finMes = mesKey(new Date());
/** Guarda o cache local do financeiro (desligado quando o token tem senha). */
function persistFin() {
  if (isProt()) {
    try {
      localStorage.removeItem(LS_FIN);
    } catch (e) {}
  } else lsSet(LS_FIN, JSON.stringify(fin));
}
/** Endereço do financeiro.json na API do GitHub. */
function finUrl(c) {
  return "https://api.github.com/repos/" + c.repo + "/contents/" + FIN_PATH;
}
/** Baixa o financeiro do GitHub (arquivo novo = lista vazia). */
async function finLoad() {
  const c = cfg();
  if (!c.repo || !c.token) return false;
  const r = await fetch(finUrl(c) + "?t=" + Date.now(), {
    headers: ghHead(c),
    cache: "no-store",
  });
  if (r.status === 404) {
    finSha = null;
    return true;
  }
  if (!r.ok) throw new Error(ghErr(r.status));
  const j = await r.json();
  finSha = j.sha;
  const raw = b64dec(j.content || "").trim();
  let arr = [];
  if (raw) {
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        "o arquivo " +
          FIN_PATH +
          " não é um JSON válido. Apague-o no GitHub e tente de novo",
      );
    }
  }
  fin = soItens(arr);
  return true;
}
/** Envia o financeiro para o GitHub. */
async function finPush(msg) {
  const c = cfg();
  const body = {
    message: msg,
    content: b64enc(JSON.stringify(fin, null, 1)),
  };
  if (finSha) body.sha = finSha;
  const r = await fetch(finUrl(c), {
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
  finSha = (await r.json()).content.sha;
}
/** Aplica uma alteração no financeiro e sincroniza (GitHub ou só neste aparelho). */
async function finSync(mut, okMsg, commitMsg) {
  if (isProt() && !(await ensureUnlocked())) {
    setSync("⚠️ Não salvo: senha não informada.");
    return false;
  }
  const c = cfg();
  if (!(c.repo && c.token)) {
    mut(fin);
    persistFin();
    setSync(
      "💾 " +
        okMsg +
        " (somente neste aparelho). Toque em ⚙️ para guardar no GitHub.",
    );
    renderFin();
    return true;
  }
  for (let t = 0; t < 2; t++) {
    let applied = false;
    try {
      await finLoad();
      mut(fin);
      applied = true;
      persistFin();
      await finPush(commitMsg);
      setSync("✅ " + okMsg + " no GitHub (" + c.repo + ")");
      markSync(true);
      renderFin();
      return true;
    } catch (e) {
      if (e && e.conflict && t === 0) continue;
      if (!applied) mut(fin);
      persistFin();
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
      renderFin();
      return false;
    }
  }
}
/** Itens do mês e do tipo de conta (PJ/PF) selecionados. */
function itensDoMes() {
  const base = fin.filter(
    (x) => x.ledger === finLedger && String(x.data).slice(0, 7) === finMes,
  );
  return base.sort(
    (a, b) =>
      String(a.data).localeCompare(String(b.data)) ||
      String(a.nome).localeCompare(String(b.nome)),
  );
}
/** Totais: entradas, despesas, saldo e valores ainda pendentes. */
function totaisFin(lista) {
  const ent = lista.filter((x) => x.tipo === "entrada"),
    des = lista.filter((x) => x.tipo === "despesa");
  const s = (l) => l.reduce((acc, x) => acc + x.valor, 0);
  return {
    ent: ent,
    des: des,
    e: s(ent),
    d: s(des),
    saldo: s(ent) - s(des),
    aReceber: s(ent.filter((x) => x.pago === false)),
    aPagar: s(des.filter((x) => x.pago === false)),
  };
}
/** Soma das despesas por categoria, da maior para a menor. */
function porCategoria(des) {
  const m = {};
  des.forEach((x) => {
    const k = x.cat || "Sem categoria";
    m[k] = (m[k] || 0) + x.valor;
  });
  return Object.keys(m)
    .map((k) => ({ nome: k, v: m[k] }))
    .sort((a, b) => b.v - a.v);
}
/** Meses disponíveis no seletor (12 para trás, 6 para frente e os que têm dados). */
function opcoesMes() {
  const cur = mesKey(new Date()),
    set = {};
  for (let i = -12; i <= 6; i++) set[somaMes(cur, i)] = 1;
  fin.forEach((x) => {
    set[String(x.data).slice(0, 7)] = 1;
  });
  notes.forEach((n) => {
    const iso = n.status === "recebida" ? isoDeBR(n.pagoEm) : "";
    if (iso) set[iso.slice(0, 7)] = 1;
  });
  set[finMes] = 1;
  return Object.keys(set)
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort();
}
