/**
 * AXION · Configurações
 *
 * Tela de configuração do GitHub (repositório, token, senha).
 *
 * Depende de: dados/seguranca.js
 */
"use strict";

$("#cfgbtn").addEventListener("click", () => {
  hideAll();
  const c = cfg();
  $("#c_repo").value = c.repo || "";
  $("#c_token").value = c.enc ? "" : c.token || "";
  $("#c_token").placeholder = c.enc
    ? "🔒 protegido (deixe em branco para manter)"
    : "github_pat_...";
  $("#c_pass").value = "";
  $("#c_pass2").value = "";
  $("#c_path").value = c.path || NOTAS_PATH;
  if (c.token && !c.enc)
    say(
      "⚠️ Seu token está sem senha. Digite o token e crie uma senha para protegê-lo.",
      true,
    );
  $("#cfgbox").hidden = false;
  window.scrollTo({ top: 0 });
});
$("#c_save").addEventListener("click", async () => {
  let old = {};
  try {
    old = JSON.parse(lsGet(LS_CFG) || "{}");
  } catch (e) {}
  const repo = $("#c_repo")
    .value.trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\/+$/, "");
  const path = $("#c_path").value.trim() || NOTAS_PATH;
  const token = $("#c_token").value.trim(),
    p1 = $("#c_pass").value,
    p2 = $("#c_pass2").value;
  if (!/^[^\/\s]+\/[^\/\s]+$/.test(repo)) {
    say("Preencha o repositório no formato usuário/nome.", true);
    return;
  }
  const c = { repo: repo, path: path };
  if (token) {
    if (p1.length < 6) {
      say(
        "Crie uma senha com pelo menos 6 caracteres (de preferência 8 ou mais).",
        true,
      );
      return;
    }
    if (p1 !== p2) {
      say("As senhas não conferem.", true);
      return;
    }
    say("Protegendo o token com a senha…");
    try {
      c.enc = await encryptToken(token, p1);
    } catch (e) {
      say(
        "⚠️ Este navegador não permite criptografia. Abra o site por HTTPS.",
        true,
      );
      return;
    }
    sessionToken = token;
    lastUse = Date.now();
  } else if (old.enc) {
    c.enc = old.enc;
    if (!(await ensureUnlocked())) {
      say("Digite a senha atual para salvar.", true);
      return;
    }
  } else {
    say("Cole o token do GitHub.", true);
    return;
  }
  lsSet(LS_CFG, JSON.stringify(c));
  say("Testando conexão…");
  try {
    const local = notes.slice();
    await ghLoad();
    let add = 0;
    local.forEach((n) => {
      if (!notes.some((x) => x.nome === n.nome)) {
        notes.push(n);
        add++;
      }
    });
    if (!ghSha || add) {
      await ghPush("Sincronizar notas NFS-e");
    }
    persist();
    setSync("✅ Conectado a " + repo + ". Token protegido por senha.");
    markSync(true);
    $("#c_token").value = "";
    $("#c_pass").value = "";
    $("#c_pass2").value = "";
  } catch (e) {
    markSync(false);
    setSync("⚠️ Não conectou: " + ((e && e.message) || e));
  }
});
$("#c_clear").addEventListener("click", () => {
  sessionToken = null;
  lsSet(LS_CFG, "{}");
  updateSyncLabel();
  $("#c_token").value = "";
  say("Configuração removida deste aparelho.");
});
$("#c_back").addEventListener("click", () => {
  $("#cancel").click();
});
/** Quadrados, menu lateral e cartões do painel levam para as ferramentas. */
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-go]");
  if (b) {
    const go = b.getAttribute("data-go");
    if (go === "nota") openPicker();
    else if (go === "nf") showNfHub();
    else if (go === "notas") showList();
    else if (go === "rel") showRep();
    else if (go === "os") showOsHub();
    else if (go === "osnew") novaOs();
    else if (go === "oslist") showOs();
    else if (go === "cat") showCat();
    else if (go === "osrep") showOsRep();
    else if (go === "fin") showFin();
    else if (go === "home") irInicio();
    else if (go === "cfg") $("#cfgbtn").click();
    return;
  }
  const on = ev.target.closest("[data-opennote]");
  if (on) {
    const n = notes.find((x) => x.id === on.getAttribute("data-opennote"));
    if (n) {
      current = n.d;
      render(current);
      say("Nota " + n.nome + " aberta.");
    }
    return;
  }
  const dc = ev.target.closest("[data-dcobrar]");
  if (dc) {
    cobrar(dc.getAttribute("data-dcobrar"));
    return;
  }
  const dos = ev.target.closest("[data-dos]");
  if (dos) {
    osMostrar(dos.getAttribute("data-dos"));
    return;
  }
  const dp = ev.target.closest("[data-dpagar]");
  if (dp) {
    finMes = mesKey(new Date());
    showFin(dp.getAttribute("data-dpagar"));
  }
});
