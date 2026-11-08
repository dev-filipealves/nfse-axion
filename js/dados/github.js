/**
 * AXION · GitHub (banco de dados)
 *
 * Comunicação com a API do GitHub, indicador de sincronização no rodapé e criarBanco(): um
 * banco genérico (lista em JSON) usado por perfis e cadastro de serviços.
 *
 * Depende de: dados/seguranca.js
 */
"use strict";

/** Texto ↔ Base64 (a API do GitHub envia e recebe o conteúdo dos arquivos em Base64). */
const b64enc = (s) => btoa(unescape(encodeURIComponent(s)));
const b64dec = (s) => decodeURIComponent(escape(atob(s.replace(/\s/g, ""))));
/** Cabeçalhos de autenticação da API do GitHub. */
function ghHead(c) {
  return {
    Authorization: "Bearer " + c.token,
    Accept: "application/vnd.github+json",
  };
}
/** Traduz o código HTTP do GitHub em uma mensagem em português. */
function ghErr(status) {
  if (status === 401) return "token inválido ou expirado (401)";
  if (status === 403) return "token sem permissão (403)";
  if (status === 404)
    return "repositório não encontrado (404). Confira o nome e o acesso do token";
  return "erro " + status;
}
/** Mostra o andamento da sincronização (mensagens com ⚠️ aparecem como erro). */
function setSync(t) {
  say(t, /^⚠️/.test(t));
}
/** Formata um instante como dd/mm/aaaa hh:mm. */
function fmtDataHora(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}
/** Atualiza o texto do rodapé com a situação da sincronização. */
function updateSyncLabel(falhou) {
  const el = document.getElementById("lastSync");
  if (!el) return;
  let conf = {};
  try {
    conf = JSON.parse(lsGet(LS_CFG) || "{}");
  } catch (e) {}
  const ult = parseInt(lsGet(LS_LASTSYNC) || "0", 10);
  el.classList.toggle("warn", !!falhou);
  if (!conf.repo) {
    el.textContent = "☁ Somente neste aparelho";
  } else if (falhou) {
    el.textContent =
      "⚠️ Falha ao sincronizar" + (ult ? " · última: " + fmtDataHora(ult) : "");
  } else {
    el.textContent = ult
      ? "☁ Última sincronização: " + fmtDataHora(ult)
      : "☁ Ainda não sincronizado";
  }
}
/** Registra o resultado de uma sincronização com o GitHub. */
function markSync(ok) {
  if (ok) lsSet(LS_LASTSYNC, String(Date.now()));
  updateSyncLabel(!ok);
}
/**
 * Cria um "banco" guardado num arquivo JSON do repositório privado (uma lista de itens),
 * com cópia neste aparelho quando o token não tem senha. aoMudar() redesenha as telas.
 */
function criarBanco(path, lsKey, aoMudar) {
  const b = { dados: [], sha: null, carregado: false };
  try {
    b.dados = JSON.parse(lsGet(lsKey) || "[]");
  } catch (e) {
    b.dados = [];
  }
  if (!Array.isArray(b.dados) || isProt()) {
    b.dados = [];
    try {
      localStorage.removeItem(lsKey);
    } catch (e) {}
  }
  const url = (c) =>
    "https://api.github.com/repos/" + c.repo + "/contents/" + path;
  b.persist = () => {
    if (isProt()) {
      try {
        localStorage.removeItem(lsKey);
      } catch (e) {}
    } else lsSet(lsKey, JSON.stringify(b.dados));
  };
  /** Baixa a lista do GitHub (arquivo novo = mantém o que já existe aqui). */
  b.load = async () => {
    const c = cfg();
    if (!c.repo || !c.token) {
      b.carregado = true;
      return false;
    }
    const r = await fetch(url(c) + "?t=" + Date.now(), {
      headers: ghHead(c),
      cache: "no-store",
    });
    if (r.status === 404) {
      b.sha = null;
      b.carregado = true;
      return true;
    }
    if (!r.ok) throw new Error(ghErr(r.status));
    const j = await r.json();
    b.sha = j.sha;
    const raw = b64dec(j.content || "").trim();
    let arr = [];
    if (raw) {
      try {
        arr = JSON.parse(raw);
      } catch (e) {
        throw new Error(
          "o arquivo " +
            path +
            " não é um JSON válido. Apague-o no GitHub e tente de novo",
        );
      }
    }
    b.dados = Array.isArray(arr) ? arr : [];
    b.carregado = true;
    return true;
  };
  /** Envia a lista para o GitHub. */
  b.push = async (msg) => {
    const c = cfg();
    const body = {
      message: msg,
      content: b64enc(JSON.stringify(b.dados, null, 1)),
    };
    if (b.sha) body.sha = b.sha;
    const r = await fetch(url(c), {
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
    b.sha = (await r.json()).content.sha;
  };
  /** Aplica uma alteração e sincroniza (GitHub ou só neste aparelho). */
  b.sync = async (mut, okMsg, commitMsg) => {
    if (isProt() && !(await ensureUnlocked())) {
      setSync("⚠️ Não salvo: senha não informada.");
      return false;
    }
    const c = cfg();
    if (!(c.repo && c.token)) {
      mut(b.dados);
      b.persist();
      setSync(
        "💾 " +
          okMsg +
          " (somente neste aparelho). Toque em ⚙️ para guardar no GitHub.",
      );
      aoMudar();
      return true;
    }
    for (let t = 0; t < 2; t++) {
      let applied = false;
      try {
        await b.load();
        mut(b.dados);
        applied = true;
        b.persist();
        await b.push(commitMsg);
        setSync("✅ " + okMsg + " no GitHub (" + c.repo + ")");
        markSync(true);
        aoMudar();
        return true;
      } catch (e) {
        if (e && e.conflict && t === 0) continue;
        if (!applied) mut(b.dados);
        b.persist();
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
        aoMudar();
        return false;
      }
    }
  };
  return b;
}
