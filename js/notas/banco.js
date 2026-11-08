/**
 * AXION · Notas · Banco de dados
 *
 * Lista de notas (notas.json), salvar/carregar no GitHub, PDF original (pasta pdfs/) e o nome
 * padrão de cada nota.
 *
 * Depende de: dados/github.js
 */
"use strict";

/** Nota aberta na tela (dados lidos do PDF ou do banco). */
let current = null;
let notes = [];
try {
  notes = JSON.parse(lsGet(LS_NOTES) || "[]");
} catch (e) {
  notes = [];
}
if (!Array.isArray(notes)) notes = [];
if (isProt()) {
  notes = [];
  try {
    localStorage.removeItem(LS_NOTES);
  } catch (e) {}
}
let ghSha = null;
/** Guarda o cache local das notas (desligado quando o token tem senha). */
function persist() {
  if (isProt()) {
    try {
      localStorage.removeItem(LS_NOTES);
    } catch (e) {}
  } else lsSet(LS_NOTES, JSON.stringify(notes));
  renderHome();
}
/** Monta a URL da API de conteúdo do GitHub para o arquivo do banco. */
function ghUrl(c) {
  return (
    "https://api.github.com/repos/" +
    c.repo +
    "/contents/" +
    (c.path || NOTAS_PATH)
  );
}
/** Gera o nome da nota: número-DDMMAAAA-CLIENTE (10 letras). */
function noteName(d) {
  const n = String(parseInt(d.numero, 10) || d.numero).padStart(2, "0");
  const m = String(d.emissao || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const dt = m ? m[1] + m[2] + m[3] : "00000000";
  const nome = String((d.t && d.t.nome) || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  return n + "-" + dt + "-" + (nome || "SEMNOME");
}
/** Baixa o banco de notas do GitHub e guarda o sha para atualizar depois. */
async function ghLoad() {
  const c = cfg();
  if (!c.repo || !c.token) return false;
  const r = await fetch(ghUrl(c) + "?t=" + Date.now(), {
    headers: ghHead(c),
    cache: "no-store",
  });
  if (r.status === 404) {
    // 404 pode ser arquivo novo OU repositório errado: confirma o repositório
    const rr = await fetch("https://api.github.com/repos/" + c.repo, {
      headers: ghHead(c),
      cache: "no-store",
    });
    if (!rr.ok) throw new Error(ghErr(rr.status));
    ghSha = null;
    return true;
  }
  if (!r.ok) throw new Error(ghErr(r.status));
  const j = await r.json();
  ghSha = j.sha;
  let arr = [];
  const raw = b64dec(j.content || "").trim();
  if (raw) {
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        "o arquivo " +
          (c.path || NOTAS_PATH) +
          " não é um JSON válido. Apague-o no GitHub e tente de novo",
      );
    }
  }
  notes = Array.isArray(arr) ? arr : [];
  return true;
}
/** Envia o banco de notas para o GitHub. */
async function ghPush(msg) {
  const c = cfg();
  const body = {
    message: msg,
    content: b64enc(JSON.stringify(notes, null, 1)),
  };
  if (ghSha) body.sha = ghSha;
  const r = await fetch(ghUrl(c), {
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
  const j = await r.json();
  ghSha = j.content.sha;
}
/** Aplica uma alteração nas notas e sincroniza (GitHub ou só neste aparelho). */
async function sync(mut, okMsg, commitMsg) {
  if (isProt() && !(await ensureUnlocked())) {
    setSync(
      "⚠️ Nota não salva: senha não informada. Gere a nota de novo e digite a senha.",
    );
    return;
  }
  const c = cfg();
  if (!(c.repo && c.token)) {
    mut(notes);
    persist();
    setSync(
      "💾 " +
        okMsg +
        " (somente neste aparelho). Toque em ⚙️ para guardar no GitHub.",
    );
    refreshList();
    return;
  }
  for (let t = 0; t < 2; t++) {
    let applied = false;
    try {
      await ghLoad();
      mut(notes);
      applied = true;
      persist();
      await ghPush(commitMsg);
      setSync("✅ " + okMsg + " no GitHub (" + c.repo + ")");
      markSync(true);
      refreshList();
      return;
    } catch (e) {
      if (e && e.conflict && t === 0) continue;
      if (!applied) mut(notes);
      persist();
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
      refreshList();
      return;
    }
  }
}
/** Guarda o PDF original no repositório privado (pasta pdfs/). */
async function uploadPdf(nome, file) {
  const c = cfg();
  if (!(c.repo && c.token)) return "";
  const path = "pdfs/" + nome + ".pdf",
    url = "https://api.github.com/repos/" + c.repo + "/contents/" + path;
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 8192)
    s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  let sha;
  const g = await fetch(url, { headers: ghHead(c), cache: "no-store" });
  if (g.ok) sha = (await g.json()).sha;
  const body = { message: "PDF " + nome, content: btoa(s) };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: "PUT",
    headers: Object.assign({ "Content-Type": "application/json" }, ghHead(c)),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(ghErr(r.status));
  return path;
}
/** Baixa de volta o PDF original guardado no GitHub. */
async function getPdf(path) {
  if (isProt() && !(await ensureUnlocked())) return;
  const c = cfg();
  setSync("Baixando PDF original…");
  try {
    const r = await fetch(
      "https://api.github.com/repos/" + c.repo + "/contents/" + path,
      {
        headers: Object.assign({}, ghHead(c), {
          Accept: "application/vnd.github.raw+json",
        }),
        cache: "no-store",
      },
    );
    if (!r.ok) throw new Error(ghErr(r.status));
    await saveBlob(
      new Blob([await r.arrayBuffer()], { type: "application/pdf" }),
      path.split("/").pop(),
    );
    setSync("✅ PDF original baixado.");
  } catch (e) {
    setSync("⚠️ Não baixou o PDF: " + ((e && e.message) || e));
  }
}
/** Salva a nota no banco (e o PDF original, se houver). */
async function saveNote(d, file) {
  const nm = noteName(d);
  const rec = {
    id: nm,
    nome: nm,
    salvoEm: Date.now(),
    status: "receber",
    pagoEm: "",
    obs: "",
    pdf: "",
    d: JSON.parse(JSON.stringify(d)),
  };
  setSync("Salvando " + rec.nome + "…");
  if (file) {
    try {
      if (isProt()) await ensureUnlocked();
      rec.pdf = await uploadPdf(nm, file);
    } catch (e) {
      setSync("⚠️ PDF original não foi guardado: " + ((e && e.message) || e));
    }
  }
  await sync(
    (arr) => {
      const i = arr.findIndex((x) => x.nome === rec.nome);
      if (i >= 0) {
        const o = arr[i];
        arr[i] = Object.assign({}, rec, {
          status: o.status || "receber",
          pagoEm: o.pagoEm || "",
          obs: o.obs || "",
          pdf: rec.pdf || o.pdf || "",
        });
      } else arr.unshift(rec);
    },
    "Nota " + rec.nome + " salva",
    "NFS-e " + rec.nome,
  );
}
