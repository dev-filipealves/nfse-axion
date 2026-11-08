/**
 * AXION · Segurança e armazenamento local
 *
 * Armazenamento no aparelho, configuração do GitHub e senha: o token é criptografado (PBKDF2 +
 * AES-256-GCM) e só é liberado na memória depois da senha.
 *
 * Depende de: base/ui.js
 */
"use strict";

/** Lê do armazenamento local do navegador (sem quebrar se estiver bloqueado). */
function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
}
/** Grava no armazenamento local do navegador (sem quebrar se estiver bloqueado). */
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}
/** Lê a configuração guardada (sempre um objeto, mesmo se estiver corrompida). */
function lerCfg() {
  try {
    const c = JSON.parse(lsGet(LS_CFG) || "{}");
    return c && typeof c === "object" && !Array.isArray(c) ? c : {};
  } catch (e) {
    return {};
  }
}
/** Token liberado na memória (após a senha) e o horário do último uso, para o bloqueio automático. */
let sessionToken = null,
  lastUse = 0;
/** Indica se o token do GitHub está protegido por senha. */
function isProt() {
  return !!lerCfg().enc;
}
/** Conversões de texto e bytes usadas na criptografia. */
const TE = new TextEncoder(),
  TD = new TextDecoder();
const b2s = (b) => {
  let s = "";
  new Uint8Array(b).forEach((x) => {
    s += String.fromCharCode(x);
  });
  return btoa(s);
};
const s2b = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** Deriva a chave AES a partir da senha (PBKDF2-SHA256). */
async function deriveKey(pass, salt, iter) {
  const km = await crypto.subtle.importKey(
    "raw",
    TE.encode(pass),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
/** Criptografa o token com a senha (AES-256-GCM). */
async function encryptToken(token, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    iter = 600000;
  const k = await deriveKey(pass, salt, iter);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    k,
    TE.encode(token),
  );
  return { v: 1, salt: b2s(salt), iv: b2s(iv), ct: b2s(ct), iter: iter };
}
/** Descriptografa o token; falha se a senha estiver errada. */
async function decryptToken(e, pass) {
  const k = await deriveKey(pass, s2b(e.salt), e.iter);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: s2b(e.iv) },
    k,
    s2b(e.ct),
  );
  return TD.decode(pt);
}
/** Abre a janela de senha e devolve o texto digitado (ou null se cancelar). */
function askPass(msg) {
  return new Promise((res) => {
    const m = $("#pwmodal"),
      i = $("#pwin");
    $("#pwmsg").textContent = msg || "Digite a senha para continuar.";
    i.value = "";
    m.hidden = false;
    setTimeout(() => i.focus(), 50);
    const done = (v) => {
      m.hidden = true;
      $("#pwok").onclick = null;
      $("#pwcancel").onclick = null;
      i.onkeydown = null;
      res(v);
    };
    $("#pwok").onclick = () => done(i.value);
    $("#pwcancel").onclick = () => done(null);
    i.onkeydown = (e) => {
      if (e.key === "Enter") done(i.value);
    };
  });
}
/** Garante que o token esteja liberado na memória (pede a senha se preciso). */
async function ensureUnlocked() {
  if (!isProt()) return true;
  if (sessionToken && Date.now() - lastUse > 10 * 60 * 1000)
    sessionToken = null; // bloqueio automático após 10 min
  if (sessionToken) {
    lastUse = Date.now();
    return true;
  }
  const c = lerCfg();
  let msg = "Digite a senha para acessar as notas.";
  for (let i = 0; i < 5; i++) {
    const p = await askPass(msg);
    if (p === null) return false;
    try {
      sessionToken = await decryptToken(c.enc, p);
      lastUse = Date.now();
      return true;
    } catch (e) {
      msg = "Senha incorreta (" + (i + 1) + "/5). Tente de novo.";
    }
  }
  return false;
}
/** Lê a configuração do GitHub; o token vem da memória quando protegido. */
function cfg() {
  const c = lerCfg();
  if (c.enc) c.token = sessionToken || "";
  return c;
}
