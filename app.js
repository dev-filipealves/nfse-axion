/**
 * AXION | Sistemas Embarcados e Energia
 * Gerador de NFS-e personalizada.
 *
 * O que este arquivo faz:
 *  - lê o PDF do DANFSe e monta a nota com a identidade AXION;
 *  - salva as notas (neste aparelho ou em um repositório privado do GitHub);
 *  - controla recebimentos, relatórios e o limite anual do MEI;
 *  - protege o token do GitHub com senha (AES-256-GCM + PBKDF2).
 */
"use strict";

// Identificação desta publicação (o version.js confere se os arquivos combinam)
window.AXION_BUILD = "2026-11-04.2";

window.addEventListener("error", function (e) {
  var m = document.getElementById("msg");
  if (m) {
    m.textContent = "Erro: " + (e.message || "desconhecido");
    m.className = "err";
  }
});
(function () {
  const LOGO = window.AXION_LOGO;
  document.getElementById("logoEmpty").src = LOGO;
  const FANTASIA = "AXION | SISTEMAS EMBARCADOS E ENERGIA";
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "-").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  let current = null,
    downloads = null;

  /** Mostra uma mensagem de status (ou erro) abaixo dos botões. */
  function say(t, err) {
    const m = $("#msg");
    m.textContent = t || "";
    m.className = err ? "err" : "";
  }

  try {
    if (window.claude && claude.use) {
      claude
        .use("downloads")
        .then((d) => {
          downloads = d;
          if (!d) $("#dl").title = "Download indisponível nesta visualização";
        })
        .catch(() => {});
    }
  } catch (e) {}

  /** Lê a 1ª página do PDF e devolve a lista de textos, na ordem em que aparecem. */
  async function extract(file) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({
      data: await file.arrayBuffer(),
      isEvalSupported: false, // compatível com a política de segurança (CSP)
    }).promise;
    const page = await pdf.getPage(1);
    const tc = await page.getTextContent();
    return tc.items.map((i) => i.str.trim()).filter(Boolean);
  }
  /** Cria um leitor que devolve o texto logo após um rótulo (n = ocorrência). */
  function reader(items) {
    return (label, n = 0) => {
      let c = 0;
      for (let i = 0; i < items.length; i++) {
        const t = items[i];
        if (t === label || t.endsWith(" " + label)) {
          if (c === n) {
            const v = items[i + 1];
            return v === undefined ? "-" : v;
          }
          c++;
        }
      }
      return "-";
    };
  }
  /** Converte os textos do DANFSe em um objeto com os dados da nota. */
  function parse(items) {
    const g = reader(items);
    const chaveFb =
      items.find((t) => /^\d{40,}$/.test(t.replace(/\s/g, ""))) || "-";
    let chave = g("CHAVE DE ACESSO DA NFS-e");
    if (!/\d{20,}/.test(chave)) chave = chaveFb;
    let regime = g("Simples Nacional na Data de Competência");
    if (/Microempreendedor/i.test(regime))
      regime = "Optante – Microempreendedor Individual (MEI)";
    const d = {
      chave,
      numero: g("NÚMERO DA NFS-e"),
      competencia: g("COMPETÊNCIA DA NFS-e"),
      emissao: g("DATA E HORA DA EMISSÃO DA NFS-e"),
      dps: g("NÚMERO DA DPS"),
      serie: g("SÉRIE DA DPS"),
      situacao: g("SITUAÇÃO DA NFS-e"),
      emitente: g("EMITENTE DA NFS-e"),
      municipioDoc: "",
      p: {
        doc: g("CNPJ / CPF / NIF", 0),
        nome: g("Nome / Nome Empresarial", 0),
        tel: g("Telefone", 0),
        mun: g("Município / Sigla UF", 0),
        cep: g("Código IBGE / CEP", 0),
        end: g("Endereço", 0),
        email: g("E-mail", 0),
        im: g("Indicador Municipal (Inscrição)", 0),
        regime,
      },
      t: {
        doc: g("CNPJ / CPF / NIF", 1),
        nome: g("Nome / Nome Empresarial", 1),
        tel: g("Telefone", 1),
        mun: g("Município / Sigla UF", 1),
        cep: g("Código IBGE / CEP", 1),
        end: g("Endereço", 1),
        email: g("E-mail", 1),
        im: g("Indicador Municipal (Inscrição)", 1),
      },
      s: {
        trib: g("Código de Tributação Nacional/Municipal"),
        nbs: g("Código da NBS"),
        local: g("Local da Prestação / Sigla UF / País"),
        desc: g("Descrição do Serviço"),
      },
      iss: {
        tipo: g("Tipo de Tributação do ISSQN"),
        inc: g("Município / Sigla UF / País de Incidência do ISSQN"),
        ret: g("Retenção do ISSQN"),
        bc: g("BC ISSQN"),
        aliq: g("Alíquota Aplicada"),
        val: g("ISSQN Apurado"),
      },
      v: {
        op: g("VALOR DA OPERAÇÃO / SERVIÇO"),
        liq: g("VALOR LÍQUIDO DA NFS-e"),
        ret: g("Total das Retenções (ISSQN / Federais)"),
        di: g("Desconto Incondicionado"),
        dc: g("Desconto Condicionado"),
        ibs: g("Total do IBS/CBS"),
      },
      info: g("INFORMAÇÕES COMPLEMENTARES"),
    };
    const m = items.find((t) => /^Município:/.test(t));
    d.municipioDoc = m ? m.replace(/^Município:\s*/, "") : "";
    return d;
  }
  const F = (l, v, c = "") =>
    `<div class="f ${c}"><label>${esc(l)}</label><div>${esc(v)}</div></div>`;

  /** Desenha a nota personalizada na tela e gera o QR Code de validação. */
  function render(d) {
    const chv = String(d.chave || "").replace(/\D/g, "");
    const qrData =
      "https://www.nfse.gov.br/ConsultaPublica/" +
      (chv.length >= 40 ? "?tpc=1&chave=" + chv : "");
    const qr = qrcode(0, "M");
    qr.addData(qrData);
    qr.make();
    const qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    const money = (v) => (v && v !== "-" ? v : "R$ 0,00");
    const info = d.info && d.info !== "-" ? d.info : "-";
    $("#paper").innerHTML = `
  <div class="hd">
    <img class="logo" src="${LOGO}" alt="AXION">
    <div class="t"><div class="fan">${esc(FANTASIA)}</div><div class="sub">${esc(d.p.nome)} · CNPJ ${esc(d.p.doc)}</div></div>
    <div class="doc"><b>NOTA FISCAL DE SERVIÇO ELETRÔNICA</b><span>NFS-e · ${esc(d.municipioDoc || d.p.mun)}</span></div>
  </div>
  <div class="stripe"></div>
  <div class="body" contenteditable="true" spellcheck="false">
    <div class="top">
      <div class="sec" style="flex:1">
        <h3>Identificação da nota</h3>
        <div class="g c3">
          ${F("Número da NFS-e", d.numero)}${F("Competência", d.competencia)}${F("Emissão da NFS-e", d.emissao)}
          ${F("Nº da DPS", d.dps)}${F("Série da DPS", d.serie)}${F("Situação", d.situacao)}
          <div class="f span3"><label>Chave de acesso</label><div class="key">${esc(d.chave)}</div></div>
        </div>
      </div>
      <div class="qr">${qrSvg}<span>Validar NFS-e nº ${esc(d.numero)}<br>nfse.gov.br</span></div>
    </div>

    <div class="sec"><h3>Prestador do serviço</h3>
      <div class="g c4">
        ${F("Nome fantasia", FANTASIA, "span4")}
        ${F("Razão social / Nome empresarial", d.p.nome, "span2")}${F("CNPJ / CPF", d.p.doc, "")}${F("Inscrição municipal", d.p.im)}
        ${F("Endereço", d.p.end, "span2")}${F("Município / UF", d.p.mun)}${F("CEP (IBGE / CEP)", d.p.cep)}
        ${F("E-mail", d.p.email, "span2")}${F("Telefone", d.p.tel)}${F("Emitente", d.emitente)}
        ${F("Simples Nacional", d.p.regime, "span4")}
      </div>
    </div>

    <div class="sec"><h3>Tomador do serviço</h3>
      <div class="g c4">
        ${F("Razão social / Nome empresarial", d.t.nome, "span2")}${F("CNPJ / CPF", d.t.doc, "")}${F("Inscrição municipal", d.t.im)}
        ${F("Endereço", d.t.end, "span2")}${F("Município / UF", d.t.mun)}${F("CEP (IBGE / CEP)", d.t.cep)}
        ${F("E-mail", d.t.email, "span3")}${F("Telefone", d.t.tel)}
      </div>
    </div>

    <div class="sec"><h3>Discriminação do serviço</h3>
      <div class="g c3">
        ${F("Cód. tributação nacional / municipal", d.s.trib)}${F("Código NBS", d.s.nbs)}${F("Local da prestação", d.s.local)}
      </div>
      <div class="desc">${esc(d.s.desc)}</div>
    </div>

    <div class="sec"><h3>Tributação municipal (ISSQN)</h3>
      <div class="g c3">
        ${F("Tipo de tributação", d.iss.tipo)}${F("Município de incidência", d.iss.inc)}${F("Retenção do ISSQN", d.iss.ret)}
        ${F("Base de cálculo", d.iss.bc)}${F("Alíquota aplicada", d.iss.aliq)}${F("ISSQN apurado", d.iss.val)}
      </div>
    </div>

    <div class="sec"><h3>Valores</h3>
      <div class="tot">
        ${F("Valor do serviço", d.v.op)}${F("Desconto incondicionado", d.v.di)}${F("Desconto condicionado", d.v.dc)}
        ${F("Retenções (ISSQN / federais)", d.v.ret)}${F("Total IBS / CBS", money(d.v.ibs))}
        <div class="f big"><label>Valor líquido da NFS-e</label><div>${esc(d.v.liq)}</div></div>
      </div>
    </div>

    <div class="sec"><h3>Informações complementares</h3><div class="desc">${esc(info)}</div></div>
  </div>
  <div class="ft">
    <div style="max-width:430px">Documento auxiliar personalizado, gerado a partir do DANFSe oficial. A autenticidade da NFS-e deve ser conferida no Portal Nacional da NFS-e pela <b>chave de acesso</b>.<br><b>${esc(FANTASIA)}</b></div>
    <div class="sig">Data de ciência / assinatura</div>
  </div>`;
    $("#empty").hidden = true;
    $("#listbox").hidden = true;
    $("#cfgbox").hidden = true;
    $("#repbox").hidden = true;
    $("#finbox").hidden = true;
    $("#fit").hidden = false;
    $("#hint").hidden = false;
    $("#dl").disabled = false;
    $("#sharebtn").disabled = false;
    $("#launchbtn").disabled = false;
    fit();
  }
  /** Ajusta a escala da nota para caber na largura da tela. */
  function fit() {
    const p = $("#paper"),
      w = $("#fit");
    if (w.hidden) return;
    const s = Math.min(1, (w.clientWidth - 12) / 794);
    p.style.transform = `scale(${s})`;
    w.style.height = p.offsetHeight * s + 8 + "px";
  }
  addEventListener("resize", fit);

  /** Processa o PDF enviado: lê, mostra a nota e salva. */
  async function handleFile(f) {
    if (!f) return;
    say("Lendo a nota…");
    try {
      const items = await extract(f);
      if (items.length < 10)
        throw new Error(
          "O PDF não tem texto legível. Use o DANFSe original baixado do portal.",
        );
      current = parse(items);
      render(current);
      say("Nota gerada. Confira os dados e baixe o PDF.");
      saveNote(current, f);
    } catch (err) {
      console.error(err);
      say("Não consegui ler esse arquivo: " + (err.message || err), true);
    }
  }
  /** Abre o seletor de arquivos do aparelho. */
  function openPicker() {
    try {
      const i = document.createElement("input");
      i.type = "file";
      i.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0";
      document.body.appendChild(i);
      i.addEventListener("change", () => {
        const f = i.files && i.files[0];
        i.remove();
        handleFile(f);
      });
      i.click();
    } catch (err) {
      say(
        "Seu navegador bloqueou o seletor. Use o campo ‘Escolher arquivo’.",
        true,
      );
    }
  }
  document
    .querySelectorAll(".pickbtn")
    .forEach((b) => b.addEventListener("click", openPicker));
  document.querySelectorAll(".native").forEach((i) =>
    i.addEventListener("change", () => {
      const f = i.files && i.files[0];
      handleFile(f);
      i.value = "";
    }),
  );

  /* ===== Banco de notas (local + GitHub) ===== */
  const LS_NOTES = "axion_nfse_notas",
    LS_CFG = "axion_nfse_cfg";
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
  let sessionToken = null,
    lastUse = 0;
  /** Indica se o token do GitHub está protegido por senha. */
  function isProt() {
    try {
      return !!JSON.parse(lsGet(LS_CFG) || "{}").enc;
    } catch (e) {
      return false;
    }
  }
  /** Guarda o cache local das notas (desligado quando o token tem senha). */
  function persist() {
    if (isProt()) {
      try {
        localStorage.removeItem(LS_NOTES);
      } catch (e) {}
    } else lsSet(LS_NOTES, JSON.stringify(notes));
    renderHome();
  }
  /* --- criptografia do token: PBKDF2-SHA256 (600 mil iterações) + AES-256-GCM --- */
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
    let c = {};
    try {
      c = JSON.parse(lsGet(LS_CFG) || "{}");
    } catch (e) {}
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
    let c = {};
    try {
      c = JSON.parse(lsGet(LS_CFG) || "{}");
    } catch (e) {
      c = {};
    }
    if (c.enc) c.token = sessionToken || "";
    return c;
  }
  const b64enc = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64dec = (s) => decodeURIComponent(escape(atob(s.replace(/\s/g, ""))));
  /** Monta a URL da API de conteúdo do GitHub para o arquivo do banco. */
  function ghUrl(c) {
    return (
      "https://api.github.com/repos/" +
      c.repo +
      "/contents/" +
      (c.path || "notas.json")
    );
  }
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
  /** Atualiza a mensagem de sincronização e o aviso na tela. */
  function setSync(t) {
    const s = $("#syncst");
    if (s) s.textContent = t;
    say(t, /^⚠️/.test(t));
  }

  /* ---------- Indicador de última sincronização (rodapé) ---------- */
  const LS_LASTSYNC = "axion_nfse_lastsync";
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
        "⚠️ Falha ao sincronizar" +
        (ult ? " · última: " + fmtDataHora(ult) : "");
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
            (c.path || "notas.json") +
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
  /** Baixa um arquivo (recurso do app Claude ou download comum do navegador). */
  async function saveBlob(blob, filename) {
    if (downloads) {
      await downloads.save({ filename: filename, data: blob });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
  /** Esconde todas as telas; cada tela se mostra sozinha em seguida. */
  function hideAll() {
    [
      "#empty",
      "#fit",
      "#hint",
      "#listbox",
      "#cfgbox",
      "#repbox",
      "#finbox",
    ].forEach((s) => {
      $(s).hidden = true;
    });
  }
  const LIMITE_MEI = 81000; // limite anual do MEI (confirmado para 2026); altere aqui se a lei mudar
  /** Formata número como moeda brasileira. */
  function brl(n) {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  /** Uma nota cancelada fica no histórico, mas não entra em totais, limite e relatórios. */
  function ativa(n) {
    return n.status !== "cancelada";
  }
  /** Dias desde a emissão da nota (0 se a data for inválida). */
  function diasDesde(n) {
    const x = ndate(n);
    if (!x) return 0;
    const t = new Date(x.y, x.m - 1, x.d).getTime();
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }
  /** Converte "R$ 1.466,67" em número. */
  function toNum(s) {
    const m = String(s || "").match(/[\d.]+,\d{2}|\d+/);
    if (!m) return 0;
    return parseFloat(m[0].replace(/\./g, "").replace(",", ".")) || 0;
  }
  /** Painel de faturamento do mês/ano e barra do limite anual do MEI. */
  function renderResumo() {
    const el = $("#resumo");
    if (!el) return;
    const now = new Date(),
      ano = now.getFullYear(),
      mes = now.getMonth() + 1;
    let tm = 0,
      ta = 0;
    notes.forEach((n) => {
      if (!ativa(n)) return;
      const m = String((n.d && n.d.emissao) || "").match(
        /(\d{2})\/(\d{2})\/(\d{4})/,
      );
      if (!m) return;
      const vv = n.d.v || {};
      const v = toNum(vv.liq && vv.liq !== "-" ? vv.liq : vv.op);
      if (+m[3] === ano) {
        ta += v;
        if (+m[2] === mes) tm += v;
      }
    });
    const pct = Math.min(100, (ta / LIMITE_MEI) * 100),
      cor =
        ta >= LIMITE_MEI
          ? "#d23b3b"
          : ta >= LIMITE_MEI * 0.8
            ? "#e0a100"
            : "#2f6bff";
    el.innerHTML =
      '<div class="resumo"><div class="small">Faturamento das notas salvas aqui</div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;margin-top:4px"><span>' +
      String(mes).padStart(2, "0") +
      "/" +
      ano +
      ": <b>" +
      brl(tm) +
      "</b></span><span>" +
      ano +
      ": <b>" +
      brl(ta) +
      "</b></div>" +
      '<div class="bar2"><i style="width:' +
      pct.toFixed(1) +
      "%;background:" +
      cor +
      '"></i></div>' +
      '<div class="small">' +
      pct.toFixed(0) +
      "% do limite anual do MEI (" +
      brl(LIMITE_MEI) +
      ")" +
      (ta >= LIMITE_MEI * 0.8 ? " ⚠️ atenção" : "") +
      "</div></div>";
  }
  let stFilter = "todas";
  /** Valor líquido (ou do serviço) de uma nota, em número. */
  function vOf(n) {
    const vv = (n.d && n.d.v) || {};
    return toNum(vv.liq && vv.liq !== "-" ? vv.liq : vv.op);
  }
  /** Extrai dia, mês e ano da data de emissão da nota. */
  function ndate(n) {
    const m = String((n.d && n.d.emissao) || "").match(
      /(\d{2})\/(\d{2})\/(\d{4})/,
    );
    return m ? { d: +m[1], m: +m[2], y: +m[3] } : null;
  }
  /** HTML de uma nota na lista: status, cobrança, observação, cancelamento e PDF. */
  function itemHtml(n) {
    const st = n.status || "receber",
      id = esc(n.id),
      dias = diasDesde(n);
    let badges;
    if (st === "cancelada") {
      badges = '<span class="badge off">🚫 Cancelada</span>';
    } else if (st === "recebida") {
      badges =
        '<button class="badge ok" data-st="' +
        id +
        '">✅ Recebida' +
        (n.pagoEm ? " em " + esc(n.pagoEm) : "") +
        "</button>";
    } else {
      badges =
        '<button class="badge ' +
        (dias > 30 ? "late" : "wait") +
        '" data-st="' +
        id +
        '">⏳ A receber · ' +
        dias +
        (dias === 1 ? " dia" : " dias") +
        "</button>" +
        '<button class="badge" data-cobrar="' +
        id +
        '">💬 Cobrar</button>';
    }
    return (
      '<div class="item' +
      (st === "cancelada" ? " cancel" : "") +
      '" data-id="' +
      id +
      '">' +
      '<div style="flex:1;min-width:0"><div class="nm">' +
      esc(n.nome) +
      "</div>" +
      '<div class="sb">' +
      esc(n.d.t.nome) +
      " · " +
      esc(n.d.v.op) +
      "</div>" +
      (n.obs ? '<div class="obs">📝 ' + esc(n.obs) + "</div>" : "") +
      '<div class="acts">' +
      badges +
      '<button class="badge" data-obs="' +
      id +
      '">📝 ' +
      (n.obs ? "Editar obs." : "Observação") +
      "</button>" +
      lancarBadge(n) +
      '<button class="badge" data-cancel="' +
      id +
      '">' +
      (st === "cancelada" ? "↩ Reativar" : "🚫 Cancelar") +
      "</button>" +
      (n.pdf
        ? '<button class="badge" data-pdf="' +
          esc(n.pdf) +
          '">📎 PDF original</button>'
        : "") +
      "</div></div>" +
      '<button class="x" data-del="' +
      id +
      '" aria-label="Excluir nota">🗑</button></div>'
    );
  }
  /** Redesenha a lista de notas conforme busca, filtro e totais. */
  function refreshList() {
    const box = $("#items");
    if (!box) return;
    renderResumo();
    const q = (($("#q") && $("#q").value) || "").toLowerCase().trim(),
      qd = q.replace(/\D/g, "");
    const arr = notes
      .filter((n) => {
        if (stFilter !== "todas" && (n.status || "receber") !== stFilter)
          return false;
        if (!q) return true;
        const vv = (n.d && n.d.v) || {},
          val = String(vv.liq && vv.liq !== "-" ? vv.liq : vv.op || "");
        const num = val.replace(/^[^\d]*/, "");
        const hay = (
          n.nome +
          " " +
          ((n.d && n.d.t && n.d.t.nome) || "") +
          " " +
          (n.obs || "") +
          " " +
          val +
          " " +
          num +
          " " +
          num.replace(/\./g, "") +
          " " +
          num.replace(/\./g, "").replace(",", ".")
        ).toLowerCase();
        return (
          hay.includes(q) ||
          (qd.length >= 2 && val.replace(/\D/g, "").includes(qd))
        );
      })
      .sort((a, b) => String(b.nome).localeCompare(String(a.nome)));
    const ativas = arr.filter(ativa);
    $("#tot").textContent =
      arr.length +
      " nota(s) · Total " +
      brl(ativas.reduce((s, n) => s + vOf(n), 0)) +
      (arr.length > ativas.length ? " (canceladas ficam fora do total)" : "");
    box.innerHTML = arr.length
      ? arr.map(itemHtml).join("")
      : '<div class="small" style="margin-top:12px">Nenhuma nota encontrada.</div>';
  }
  /** Janela de texto: mostra um campo editável e botões; devolve { acao, texto }. */
  function askText(o) {
    return new Promise((res) => {
      const m = $("#txmodal"),
        t = $("#txin"),
        b = $("#txbtns");
      $("#txtitle").textContent = o.titulo || "";
      t.value = o.texto || "";
      t.placeholder = o.placeholder || "";
      t.hidden = !!o.semTexto; // menu de botões, sem campo de texto
      b.innerHTML = (o.botoes || [])
        .map(
          (x) =>
            '<button class="btn' +
            (x.sec ? " sec" : "") +
            '" data-a="' +
            x.id +
            '" style="width:100%">' +
            x.rotulo +
            "</button>",
        )
        .join("");
      m.hidden = false;
      setTimeout(() => t.focus(), 50);
      b.onclick = (ev) => {
        const bt = ev.target.closest("[data-a]");
        if (!bt) return;
        m.hidden = true;
        b.onclick = null;
        res({ acao: bt.getAttribute("data-a"), texto: t.value });
      };
    });
  }
  /** Abre um link (WhatsApp, e-mail) em outra aba. */
  function abrir(url) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  /** Monta uma mensagem de cobrança editável e abre o WhatsApp ou o e-mail. */
  async function cobrar(id) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const d = n.d,
      data = String(d.emissao || "").slice(0, 10);
    const msg =
      "Olá! Segue a NFS-e nº " +
      d.numero +
      " (emitida em " +
      data +
      "), no valor de " +
      d.v.op +
      ", referente a: " +
      String((d.s && d.s.desc) || "serviço prestado").slice(0, 120) +
      ".\nFico no aguardo da confirmação do pagamento. Obrigado!\n\nAXION | Sistemas Embarcados e Energia";
    const r = await askText({
      titulo: "💬 Cobrar · " + n.nome,
      texto: msg,
      botoes: [
        { id: "wpp", rotulo: "WhatsApp" },
        { id: "email", rotulo: "E-mail" },
        { id: "cancelar", rotulo: "Cancelar", sec: true },
      ],
    });
    if (r.acao === "wpp") {
      const tel = String((d.t && d.t.tel) || "").replace(/\D/g, "");
      const num = tel.length >= 10 ? (tel.length <= 11 ? "55" + tel : tel) : "";
      abrir("https://wa.me/" + num + "?text=" + encodeURIComponent(r.texto));
    } else if (r.acao === "email") {
      const em = d.t && d.t.email && d.t.email !== "-" ? d.t.email : "";
      abrir(
        "mailto:" +
          em +
          "?subject=" +
          encodeURIComponent("NFS-e nº " + d.numero + " — AXION") +
          "&body=" +
          encodeURIComponent(r.texto),
      );
    }
  }
  $("#chips").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-f]");
    if (!b) return;
    stFilter = b.getAttribute("data-f");
    document
      .querySelectorAll("#chips .chip")
      .forEach((x) => x.classList.toggle("on", x === b));
    refreshList();
  });
  /* ----- Relatórios ----- */
  /** Define o período escolhido no relatório (y = ano de referência do gráfico). */
  function repRange() {
    const v = $("#r_per").value,
      now = new Date(),
      y = now.getFullYear(),
      m = now.getMonth() + 1,
      pad = (x) => String(x).padStart(2, "0");
    if (v === "mes")
      return {
        t: "Mês " + pad(m) + "/" + y,
        s: pad(m) + "-" + y,
        y: y,
        f: (x) => x.y === y && x.m === m,
      };
    if (v === "mesant") {
      const pm = m === 1 ? 12 : m - 1,
        py = m === 1 ? y - 1 : y;
      return {
        t: "Mês " + pad(pm) + "/" + py,
        s: pad(pm) + "-" + py,
        y: py,
        f: (x) => x.y === py && x.m === pm,
      };
    }
    if (v === "ano")
      return { t: "Ano " + y, s: "" + y, y: y, f: (x) => x.y === y };
    if (v === "anoant")
      return {
        t: "Ano " + (y - 1),
        s: "" + (y - 1),
        y: y - 1,
        f: (x) => x.y === y - 1,
      };
    return { t: "Todo o período", s: "completo", y: y, f: () => true };
  }
  /** Calcula totais, recebido, a receber, resumo por cliente e faturamento mensal. */
  function repData() {
    const R = repRange();
    const todas = notes
      .filter((n) => {
        const x = ndate(n);
        return x && R.f(x);
      })
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    const arr = todas.filter(ativa),
      canc = todas.filter((n) => !ativa(n));
    const sum = (l) => l.reduce((s, n) => s + vOf(n), 0),
      cl = {};
    arr.forEach((n) => {
      const k = (n.d.t && n.d.t.nome) || "-";
      const o = (cl[k] = cl[k] || { nome: k, doc: n.d.t.doc, q: 0, v: 0 });
      o.q++;
      o.v += vOf(n);
    });
    const tot = sum(arr),
      rec = sum(arr.filter((n) => n.status === "recebida"));
    const meses = Array(12).fill(0);
    notes.filter(ativa).forEach((n) => {
      const x = ndate(n);
      if (x && x.y === R.y) meses[x.m - 1] += vOf(n);
    });
    return {
      R: R,
      arr: arr,
      canc: canc,
      todas: todas,
      tot: tot,
      rec: rec,
      pen: tot - rec,
      meses: meses,
      cli: Object.values(cl).sort((a, b) => b.v - a.v),
    };
  }
  /** Gráfico de barras do faturamento mês a mês (SVG) e projeção do ano. */
  function chartHtml(D) {
    const y = D.R.y,
      hoje = new Date(),
      atual = hoje.getFullYear() === y;
    const totalAno = D.meses.reduce((s, v) => s + v, 0);
    const maxV = Math.max.apply(null, D.meses.concat([1])),
      W = 340,
      H = 120,
      bw = 20,
      gap = (W - 12 * bw) / 13;
    const letras = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    let barras = "";
    D.meses.forEach((v, i) => {
      const h = Math.round((v / maxV) * 90),
        x = gap + i * (bw + gap);
      barras +=
        '<rect x="' +
        x.toFixed(1) +
        '" y="' +
        (100 - h) +
        '" width="' +
        bw +
        '" height="' +
        h +
        '" rx="3"></rect>' +
        '<text x="' +
        (x + bw / 2).toFixed(1) +
        '" y="114">' +
        letras[i] +
        "</text>";
    });
    let proj;
    if (atual) {
      const passados = hoje.getMonth() + 1,
        media = totalAno / passados,
        estim = media * 12,
        rest = 12 - passados;
      proj =
        '<div class="proj">📈 No ritmo atual (média de <b>' +
        brl(media) +
        "</b>/mês), você fecha " +
        y +
        " com cerca de <b>" +
        brl(estim) +
        "</b> (" +
        ((estim / LIMITE_MEI) * 100).toFixed(0) +
        "% do limite do MEI)." +
        (estim > LIMITE_MEI
          ? " ⚠️ A projeção passa do limite de " + brl(LIMITE_MEI) + "."
          : "") +
        "</div>";
      if (rest > 0)
        proj +=
          '<div class="proj">🎯 Para ficar no limite, dá para faturar em média <b>' +
          brl(Math.max(0, (LIMITE_MEI - totalAno) / rest)) +
          "</b>/mês nos " +
          rest +
          " meses restantes.</div>";
      proj +=
        '<div class="small">Estimativa simples: média dos meses já decorridos × 12.</div>';
    } else {
      proj =
        '<div class="proj">Total de ' +
        y +
        ": <b>" +
        brl(totalAno) +
        "</b> (" +
        ((totalAno / LIMITE_MEI) * 100).toFixed(0) +
        "% do limite).</div>";
    }
    return (
      '<div class="sect">Faturamento por mês · ' +
      y +
      '</div><svg class="bars" viewBox="0 0 ' +
      W +
      " " +
      H +
      '" role="img" aria-label="Faturamento por mês">' +
      barras +
      "</svg>" +
      proj
    );
  }
  /** Desenha o relatório na tela. */
  function renderRep() {
    const D = repData(),
      pc = (v) => (D.tot ? ((v / D.tot) * 100).toFixed(0) + "%" : "0%");
    $("#r_out").innerHTML =
      '<div class="sect">Resumo · ' +
      esc(D.R.t) +
      "</div>" +
      '<div class="row"><span>Notas emitidas</span><b>' +
      D.arr.length +
      "</b></div>" +
      '<div class="row"><span>Total faturado</span><b>' +
      brl(D.tot) +
      "</b></div>" +
      '<div class="row"><span>✅ Recebido</span><b>' +
      brl(D.rec) +
      "</b></div>" +
      '<div class="row"><span>⏳ A receber</span><b>' +
      brl(D.pen) +
      "</b></div>" +
      (D.canc.length
        ? '<div class="row"><span>🚫 Canceladas (fora dos totais)</span><b>' +
          D.canc.length +
          "</b></div>"
        : "") +
      chartHtml(D) +
      '<div class="sect">Por cliente</div>' +
      (D.cli
        .map(
          (c) =>
            '<div class="row"><span>' +
            esc(c.nome) +
            '<br><span class="small">' +
            c.q +
            " nota(s) · " +
            pc(c.v) +
            "</span></span><b>" +
            brl(c.v) +
            "</b></div>",
        )
        .join("") || '<div class="small">Sem notas no período.</div>') +
      '<div class="sect">Notas do período</div>' +
      (D.todas
        .map(
          (n) =>
            '<div class="row"><span>' +
            esc(n.nome) +
            (n.obs
              ? '<br><span class="small">📝 ' + esc(n.obs) + "</span>"
              : "") +
            "</span><b>" +
            (n.status === "cancelada"
              ? "🚫 "
              : n.status === "recebida"
                ? "✅ "
                : "⏳ ") +
            brl(vOf(n)) +
            "</b></div>",
        )
        .join("") || '<div class="small">Nenhuma.</div>');
  }
  /** Abre a tela de relatórios. */
  async function showRep() {
    await showList();
    if (isProt() && !sessionToken) return;
    hideAll();
    $("#repbox").hidden = false;
    renderRep();
    window.scrollTo({ top: 0 });
  }
  /** Protege um valor para uso em CSV (separador ponto e vírgula). */
  function csvCell(s) {
    s = String(s == null ? "" : s);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  $("#repbtn").addEventListener("click", showRep);
  $("#r_per").addEventListener("change", renderRep);
  $("#r_csv").addEventListener("click", async () => {
    const D = repData();
    const rows = [
      [
        "Nota",
        "Emissão",
        "Cliente",
        "CNPJ/CPF",
        "Valor",
        "Status",
        "Recebido em",
        "Observação",
      ],
    ].concat(
      D.todas.map((n) => [
        n.nome,
        String(n.d.emissao || "").slice(0, 10),
        n.d.t.nome,
        n.d.t.doc,
        vOf(n).toFixed(2).replace(".", ","),
        n.status === "cancelada"
          ? "Cancelada"
          : n.status === "recebida"
            ? "Recebida"
            : "A receber",
        n.pagoEm || "",
        n.obs || "",
      ]),
    );
    try {
      await saveBlob(
        new Blob(
          ["\ufeff" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")],
          { type: "text/csv;charset=utf-8" },
        ),
        "relatorio-nfse-" + D.R.s + ".csv",
      );
      say("CSV gerado.");
    } catch (e) {
      say("Erro ao gerar o CSV: " + ((e && e.message) || e), true);
    }
  });
  $("#r_pdf").addEventListener("click", async () => {
    try {
      const D = repData(),
        doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
      let y = 36;
      try {
        doc.addImage(LOGO, "PNG", 14, 10, 16, 16);
      } catch (e) {}
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("AXION | SISTEMAS EMBARCADOS E ENERGIA", 34, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        "Relatório de NFS-e · " +
          D.R.t +
          " · gerado em " +
          new Date().toLocaleDateString("pt-BR"),
        34,
        22,
      );
      const nl = (h) => {
        if (y + h > 284) {
          doc.addPage();
          y = 20;
        }
      };
      const head = (s) => {
        nl(12);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(s.toUpperCase(), 14, y);
        y += 2;
        doc.line(14, y, 196, y);
        y += 5;
        doc.setFont("helvetica", "normal");
      };
      const row = (a, b, c) => {
        nl(6);
        doc.setFontSize(9);
        doc.text(String(a).slice(0, 62), 14, y);
        if (c) doc.text(String(c), 150, y);
        doc.text(String(b), 196, y, { align: "right" });
        y += 5.5;
      };
      head("Resumo");
      row("Notas emitidas", D.arr.length);
      row("Total faturado", brl(D.tot));
      row("Recebido", brl(D.rec));
      row("A receber", brl(D.pen));
      head("Por cliente");
      D.cli.forEach((c) =>
        row(
          c.nome + " (" + c.q + ")",
          brl(c.v),
          D.tot ? ((c.v / D.tot) * 100).toFixed(0) + "%" : "",
        ),
      );
      head("Notas do período");
      D.arr.forEach((n) =>
        row(
          n.nome,
          brl(vOf(n)),
          n.status === "recebida" ? "Recebida" : "A receber",
        ),
      );
      await saveBlob(doc.output("blob"), "relatorio-nfse-" + D.R.s + ".pdf");
      say("PDF do relatório gerado.");
    } catch (e) {
      say("Erro ao gerar o PDF: " + ((e && e.message) || e), true);
    }
  });
  /** Abre a tela "Minhas notas" (pede senha e sincroniza se preciso). */
  async function showList() {
    if (isProt() && !(await ensureUnlocked())) {
      say("🔒 Senha necessária para ver as notas.", true);
      return;
    }
    hideAll();
    $("#listbox").hidden = false;
    refreshList();
    window.scrollTo({ top: 0 });
    const c = cfg();
    if (c.repo && c.token) {
      setSync("Sincronizando…");
      try {
        await ghLoad();
        persist();
        setSync("✅ Sincronizado com " + c.repo);
        markSync(true);
      } catch (e) {
        markSync(false);
        setSync(
          "⚠️ Não sincronizou: " +
            ((e && e.message) || e) +
            ". Mostrando as notas deste aparelho.",
        );
      }
      refreshList();
    } else
      setSync(
        "💾 Notas guardadas só neste aparelho. Toque em ⚙️ para guardar no GitHub.",
      );
  }
  $("#listbtn").addEventListener("click", showList);
  $("#q").addEventListener("input", refreshList);
  $("#items").addEventListener("click", async (ev) => {
    const st = ev.target.closest("[data-st]");
    if (st) {
      ev.stopPropagation();
      const id = st.getAttribute("data-st");
      await sync(
        (arr) => {
          const x = arr.find((n) => n.id === id);
          if (!x) return;
          if (x.status === "recebida") {
            x.status = "receber";
            x.pagoEm = "";
          } else {
            x.status = "recebida";
            x.pagoEm = new Date().toLocaleDateString("pt-BR");
          }
        },
        "Status atualizado",
        "Status " + id,
      );
      return;
    }
    const pb = ev.target.closest("[data-pdf]");
    if (pb) {
      ev.stopPropagation();
      await getPdf(pb.getAttribute("data-pdf"));
      return;
    }
    const lc = ev.target.closest("[data-lancar]");
    if (lc) {
      ev.stopPropagation();
      await lancarNota(lc.getAttribute("data-lancar"));
      return;
    }
    const cn = ev.target.closest("[data-cancel]");
    if (cn) {
      ev.stopPropagation();
      const id = cn.getAttribute("data-cancel"),
        n = notes.find((x) => x.id === id);
      if (!n) return;
      const reativar = n.status === "cancelada";
      let ok = true;
      if (!reativar) {
        try {
          ok = confirm(
            "Marcar a nota " +
              n.nome +
              " como cancelada? Ela sai dos totais e do limite do MEI.",
          );
        } catch (e) {}
      }
      if (ok)
        await sync(
          (arr) => {
            const x = arr.find((y) => y.id === id);
            if (x) {
              x.status = reativar ? "receber" : "cancelada";
              x.pagoEm = "";
            }
          },
          reativar ? "Nota reativada" : "Nota cancelada",
          (reativar ? "Reativar " : "Cancelar ") + id,
        );
      return;
    }
    const ob = ev.target.closest("[data-obs]");
    if (ob) {
      ev.stopPropagation();
      const id = ob.getAttribute("data-obs"),
        n = notes.find((x) => x.id === id);
      if (!n) return;
      const r = await askText({
        titulo: "📝 Observação · " + n.nome,
        texto: n.obs || "",
        placeholder: "Ex.: cliente pediu desconto; pago em 2x",
        botoes: [
          { id: "salvar", rotulo: "Salvar" },
          { id: "cancelar", rotulo: "Cancelar", sec: true },
        ],
      });
      if (r.acao === "salvar")
        await sync(
          (arr) => {
            const x = arr.find((y) => y.id === id);
            if (x) x.obs = r.texto.trim();
          },
          "Observação salva",
          "Observação " + id,
        );
      return;
    }
    const cb = ev.target.closest("[data-cobrar]");
    if (cb) {
      ev.stopPropagation();
      await cobrar(cb.getAttribute("data-cobrar"));
      return;
    }
    const del = ev.target.closest("[data-del]");
    if (del) {
      ev.stopPropagation();
      const id = del.getAttribute("data-del");
      const n = notes.find((x) => x.id === id);
      let ok = true;
      try {
        ok = confirm("Excluir a nota " + (n ? n.nome : "") + "?");
      } catch (e) {}
      if (ok)
        await sync(
          (arr) => {
            const i = arr.findIndex((x) => x.id === id);
            if (i >= 0) arr.splice(i, 1);
          },
          "Nota excluída",
          "Excluir NFS-e " + (n ? n.nome : ""),
        );
      return;
    }
    const it = ev.target.closest(".item");
    if (!it) return;
    const n = notes.find((x) => x.id === it.getAttribute("data-id"));
    if (!n) return;
    current = n.d;
    render(current);
    say(
      "Nota " + n.nome + " aberta. Toque em Baixar PDF para imprimir de novo.",
    );
    window.scrollTo({ top: 0 });
  });
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
    $("#c_path").value = c.path || "notas.json";
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
    const path = $("#c_path").value.trim() || "notas.json";
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

  $("#cancel").addEventListener("click", () => {
    current = null;
    $("#repbox").hidden = true;
    $("#finbox").hidden = true;
    $("#listbox").hidden = true;
    $("#cfgbox").hidden = true;
    $("#paper").innerHTML = "";
    $("#fit").hidden = true;
    $("#hint").hidden = true;
    $("#empty").hidden = false;
    renderHome();
    $("#dl").disabled = true;
    $("#sharebtn").disabled = true;
    $("#launchbtn").disabled = true;
    say("");
    window.scrollTo({ top: 0 });
  });

  /** Nome do arquivo PDF da nota exibida na tela. */
  function nomeArquivoNota() {
    return "NFSe-" + String(current.numero).replace(/\W/g, "") + "-AXION.pdf";
  }
  /** Gera o PDF da nota exibida na tela e devolve o Blob. */
  async function gerarPdfNota() {
    const canvas = await html2canvas($("#paper"), {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      onclone: (doc) => {
        const p = doc.getElementById("paper");
        p.style.transform = "none";
        const w = doc.getElementById("fit");
        w.style.height = "auto";
        w.style.overflow = "visible";
        w.style.padding = "0";
        w.style.maxWidth = "none";
      },
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210,
      H = (canvas.height * W) / canvas.width;
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,
      0,
      W,
      Math.min(H, 297),
    );
    return pdf.output("blob");
  }
  $("#dl").addEventListener("click", async () => {
    if (!current) return;
    const btn = $("#dl");
    btn.disabled = true;
    say("Gerando PDF…");
    try {
      await saveBlob(await gerarPdfNota(), nomeArquivoNota());
      say("PDF salvo.");
    } catch (err) {
      if (err && err.code === "declined") say("Download cancelado.");
      else {
        console.error(err);
        say("Erro ao gerar o PDF: " + (err.message || err.code || err), true);
      }
    } finally {
      btn.disabled = false;
    }
  });
  /** Compartilha o PDF da nota (WhatsApp, e-mail...) pelo menu do aparelho. */
  $("#sharebtn").addEventListener("click", async () => {
    if (!current) return;
    const btn = $("#sharebtn");
    btn.disabled = true;
    say("Preparando o PDF para compartilhar…");
    try {
      const blob = await gerarPdfNota();
      const file = new File([blob], nomeArquivoNota(), {
        type: "application/pdf",
      });
      const texto =
        "NFS-e nº " +
        current.numero +
        " · " +
        current.v.op +
        " · AXION | Sistemas Embarcados e Energia";
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "NFS-e nº " + current.numero,
          text: texto,
        });
        say("Compartilhado.");
      } else {
        // Sem suporte a compartilhar arquivos: baixa o PDF e abre o WhatsApp com a mensagem
        await saveBlob(blob, nomeArquivoNota());
        say(
          "Este navegador não compartilha arquivos. O PDF foi baixado: anexe-o na conversa.",
          true,
        );
        abrir("https://wa.me/?text=" + encodeURIComponent(texto));
      }
    } catch (err) {
      if (err && err.name === "AbortError") say("Compartilhamento cancelado.");
      else say("Erro ao compartilhar: " + ((err && err.message) || err), true);
    } finally {
      btn.disabled = false;
    }
  });

  /* ================= Financeiro (PJ e PF) ================= */
  const LS_FIN = "axion_nfse_fin";
  const FIN_PATH = "financeiro.json"; // 2º banco de dados, no mesmo repositório privado
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
  const CATS_ENTRADA = [
    "Salário",
    "Serviço",
    "Reembolso/Estorno",
    "Venda",
    "Outros",
  ];
  const CATS_DESPESA = {
    PF: [
      "Moradia",
      "Contas (água, luz, telefone)",
      "Cartão de crédito",
      "Financiamento/Consórcio",
      "Dízimo/Doações",
      "Saúde",
      "Transporte",
      "Alimentação",
      "Educação",
      "Impostos/Taxas",
      "Outros",
    ],
    PJ: [
      "Impostos (DAS)",
      "Ferramentas/Software",
      "Material/Peças",
      "Transporte/Viagem",
      "Marketing",
      "Contador",
      "Retirada (pró-labore)",
      "Dízimo/Doações",
      "Outros",
    ],
  };
  let fin = [];
  try {
    fin = JSON.parse(lsGet(LS_FIN) || "[]");
  } catch (e) {
    fin = [];
  }
  if (!Array.isArray(fin) || isProt()) {
    fin = [];
    try {
      localStorage.removeItem(LS_FIN);
    } catch (e) {}
  }
  let finSha = null;
  let finLedger = "PJ"; // "PJ" ou "PF"
  const pad2 = (n) => String(n).padStart(2, "0");
  /** Chave do mês: "2026-10". */
  function mesKey(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }
  let finMes = mesKey(new Date());
  /** Soma (ou subtrai) meses de uma chave "AAAA-MM". */
  function somaMes(key, delta) {
    const p = key.split("-").map(Number);
    return mesKey(new Date(p[0], p[1] - 1 + delta, 1));
  }
  /** "2026-10" -> "Outubro/2026". */
  function nomeMes(key) {
    const p = key.split("-");
    return MESES[+p[1] - 1] + "/" + p[0];
  }
  /** Data de hoje no formato AAAA-MM-DD. */
  function hojeISO() {
    const d = new Date();
    return (
      d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
    );
  }
  /** "2026-10-05" -> "05/10/2026". */
  function dataBR(iso) {
    const m = String(iso || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
  }
  /** "05/10/2026" -> "2026-10-05". */
  function isoDeBR(br) {
    const m = String(br || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
  }
  /** Lê um valor digitado ("1.466,67" ou "1466.67"); devolve NaN se inválido. */
  function parseValor(s) {
    s = String(s || "").replace(/[^\d,.\-]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    const v = parseFloat(s);
    return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
  }
  const novoId = () =>
    "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  /** Guarda o cache local do financeiro (desligado quando o token tem senha). */
  function persistFin() {
    if (isProt()) {
      try {
        localStorage.removeItem(LS_FIN);
      } catch (e) {}
    } else lsSet(LS_FIN, JSON.stringify(fin));
  }

  /* ----- GitHub: financeiro.json ----- */
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
    fin = Array.isArray(arr) ? arr : [];
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

  /* ----- Cálculos do mês ----- */
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

  /* ----- Tela ----- */
  /** Linha de um item (entrada ou despesa) na lista do mês. */
  function finRow(x) {
    const txt =
      x.tipo === "entrada"
        ? ["✅ Recebido", "⏳ A receber"]
        : ["✅ Pago", "⏳ A pagar"];
    const pendente = x.pago === false;
    const botao = x.derivado
      ? '<span class="badge off">🧾 automático</span>'
      : '<button class="badge ' +
        (pendente ? "wait" : "ok") +
        '" data-fpago="' +
        esc(x.id) +
        '">' +
        (pendente ? txt[1] : txt[0]) +
        "</button>";
    return (
      '<div class="frow' +
      (x.derivado ? "" : " edit") +
      '"' +
      (x.derivado ? "" : ' data-fedit="' + esc(x.id) + '"') +
      ">" +
      '<div class="fmain"><div class="fn">' +
      esc(x.nome) +
      "</div>" +
      '<div class="fs">' +
      dataBR(x.data).slice(0, 5) +
      " · " +
      esc(x.cat || "Sem categoria") +
      (x.rec ? " · 🔁" : "") +
      "</div></div>" +
      '<div class="fv"><b>' +
      brl(x.valor) +
      "</b>" +
      botao +
      "</div></div>"
    );
  }
  /** Desenha o seletor de mês, os totais e as listas do financeiro. */
  function renderFin() {
    const box = $("#finbox");
    if (!box || box.hidden) return;
    document
      .querySelectorAll("#f_tabs .chip")
      .forEach((b) =>
        b.classList.toggle("on", b.getAttribute("data-l") === finLedger),
      );
    const cur = mesKey(new Date());
    $("#f_mes").innerHTML = opcoesMes()
      .map(
        (k) =>
          '<option value="' +
          k +
          '"' +
          (k === finMes ? " selected" : "") +
          ">" +
          nomeMes(k) +
          (k === cur ? "  ● mês atual" : "") +
          "</option>",
      )
      .join("");
    $("#f_cur").innerHTML =
      finMes === cur
        ? '<span class="atual">● Este é o mês atual</span>'
        : '<button class="badge" data-fhoje="1">↩ Ir para o mês atual (' +
          nomeMes(cur) +
          ")</button>";
    const lista = itensDoMes(),
      T = totaisFin(lista);
    $("#f_sum").innerHTML =
      '<div class="fcards"><div class="fcard"><span>💰 Entradas</span><b>' +
      brl(T.e) +
      "</b></div>" +
      '<div class="fcard"><span>💸 Despesas</span><b>' +
      brl(T.d) +
      "</b></div>" +
      '<div class="fcard ' +
      (T.saldo >= 0 ? "pos" : "neg") +
      '"><span>' +
      (T.saldo >= 0 ? "✅" : "⚠️") +
      " Saldo</span><b>" +
      brl(T.saldo) +
      "</b></div></div>" +
      (T.aReceber > 0
        ? '<div class="small">⏳ A receber: <b>' +
          brl(T.aReceber) +
          "</b></div>"
        : "") +
      (T.aPagar > 0
        ? '<div class="small">⏳ A pagar: <b>' + brl(T.aPagar) + "</b></div>"
        : "");
    const cats = porCategoria(T.des);
    $("#f_lists").innerHTML =
      '<div class="sect">💰 Entradas (' +
      T.ent.length +
      ")</div>" +
      (T.ent.map(finRow).join("") ||
        '<div class="small">Nenhuma entrada neste mês.</div>') +
      '<div class="sect">💸 Despesas (' +
      T.des.length +
      ")</div>" +
      (T.des.map(finRow).join("") ||
        '<div class="small">Nenhuma despesa neste mês.</div>') +
      (cats.length
        ? '<div class="sect">Despesas por categoria</div>' +
          cats
            .map(
              (c) =>
                '<div class="row"><span>' +
                esc(c.nome) +
                '<br><span class="small">' +
                (T.d ? ((c.v / T.d) * 100).toFixed(0) : 0) +
                "% das despesas</span></span><b>" +
                brl(c.v) +
                "</b></div>",
            )
            .join("")
        : "");
  }
  /** Janela para criar ou editar um item; devolve { acao, dados }. */
  function openItem(tipo, item) {
    return new Promise((res) => {
      const m = $("#fmodal"),
        edit = !!item;
      $("#ftitle").textContent =
        (edit ? "✏️ Editar " : "➕ ") +
        (tipo === "entrada" ? "entrada" : "despesa") +
        " · " +
        finLedger;
      const cats = tipo === "entrada" ? CATS_ENTRADA : CATS_DESPESA[finLedger];
      $("#fi_cat").innerHTML = cats
        .map((c) => "<option>" + esc(c) + "</option>")
        .join("");
      if (item && item.cat && cats.indexOf(item.cat) < 0)
        $("#fi_cat").insertAdjacentHTML(
          "beforeend",
          "<option>" + esc(item.cat) + "</option>",
        );
      $("#fi_cat").value = item && item.cat ? item.cat : cats[0];
      $("#fi_nome").value = item ? item.nome : "";
      $("#fi_valor").value = item ? String(item.valor).replace(".", ",") : "";
      $("#fi_data").value = item
        ? item.data
        : finMes === mesKey(new Date())
          ? hojeISO()
          : finMes + "-01";
      $("#fi_pago").checked = item ? item.pago !== false : true;
      $("#fi_pagolbl").textContent =
        tipo === "entrada" ? "Já recebido" : "Já pago";
      $("#fi_rec").checked = !!(item && item.rec);
      $("#fi_err").textContent = "";
      $("#fi_del").hidden = !edit;
      m.hidden = false;
      setTimeout(() => $("#fi_nome").focus(), 50);
      const fim = (r) => {
        m.hidden = true;
        $("#fi_save").onclick =
          $("#fi_del").onclick =
          $("#fi_cancel").onclick =
            null;
        res(r);
      };
      $("#fi_cancel").onclick = () => fim({ acao: "cancelar" });
      $("#fi_del").onclick = () => fim({ acao: "excluir" });
      $("#fi_save").onclick = () => {
        const nome = $("#fi_nome").value.trim(),
          valor = parseValor($("#fi_valor").value),
          data = $("#fi_data").value;
        if (!nome || !(valor > 0) || !data) {
          $("#fi_err").textContent =
            "Preencha o nome, um valor maior que zero e a data.";
          return;
        }
        fim({
          acao: "salvar",
          dados: {
            nome: nome,
            valor: valor,
            data: data,
            cat: $("#fi_cat").value,
            pago: $("#fi_pago").checked,
            rec: $("#fi_rec").checked,
          },
        });
      };
    });
  }
  /** Adiciona uma entrada ou despesa. */
  async function addItem(tipo) {
    const r = await openItem(tipo);
    if (r.acao !== "salvar") return;
    const rec = Object.assign(
      { id: novoId(), ledger: finLedger, tipo: tipo, criadoEm: Date.now() },
      r.dados,
    );
    finMes = rec.data.slice(0, 7);
    await finSync(
      (arr) => {
        arr.push(rec);
      },
      (tipo === "entrada" ? "Entrada" : "Despesa") + " salva",
      "Financeiro " + finLedger + ": " + rec.nome,
    );
    await oferecerReplica(rec);
  }
  /** Edita ou exclui um item. */
  async function editItem(id) {
    const it = fin.find((x) => x.id === id);
    if (!it) return;
    const r = await openItem(it.tipo, it);
    if (r.acao === "cancelar") return;
    if (r.acao === "excluir") {
      let ok = true;
      try {
        ok = confirm('Excluir "' + it.nome + '"?');
      } catch (e) {}
      if (!ok) return;
      await finSync(
        (arr) => {
          const i = arr.findIndex((x) => x.id === id);
          if (i >= 0) arr.splice(i, 1);
        },
        "Item excluído",
        "Excluir " + it.nome,
      );
      return;
    }
    finMes = r.dados.data.slice(0, 7);
    await finSync(
      (arr) => {
        const x = arr.find((y) => y.id === id);
        if (x) Object.assign(x, r.dados);
      },
      "Item atualizado",
      "Editar " + r.dados.nome,
    );
  }
  /** Alterna entre pago/a pagar (ou recebido/a receber). */
  async function togglePago(id) {
    await finSync(
      (arr) => {
        const x = arr.find((y) => y.id === id);
        if (x) x.pago = x.pago === false;
      },
      "Situação atualizada",
      "Situação " + id,
    );
  }
  /** Copia para o mês atual os itens recorrentes do mês anterior (como "a pagar"). */
  async function repetirRecorrentes() {
    const prev = somaMes(finMes, -1),
      p = finMes.split("-").map(Number);
    const novos = [];
    fin
      .filter(
        (x) =>
          x.ledger === finLedger &&
          x.rec &&
          String(x.data).slice(0, 7) === prev,
      )
      .forEach((o) => {
        const existe = fin.some(
          (x) =>
            x.ledger === finLedger &&
            x.tipo === o.tipo &&
            x.nome === o.nome &&
            String(x.data).slice(0, 7) === finMes,
        );
        if (existe) return;
        const dia = Math.min(
          +o.data.slice(8, 10),
          new Date(p[0], p[1], 0).getDate(),
        );
        novos.push(
          Object.assign({}, o, {
            notaId: undefined,
            id: novoId(),
            data: finMes + "-" + pad2(dia),
            pago: false,
            criadoEm: Date.now(),
          }),
        );
      });
    if (!novos.length) {
      say(
        "Nada para repetir: não há itens recorrentes em " +
          nomeMes(prev) +
          " ou eles já estão neste mês.",
        true,
      );
      return;
    }
    await finSync(
      (arr) => {
        novos.forEach((n) => arr.push(n));
      },
      novos.length + " item(ns) repetido(s)",
      "Repetir recorrentes",
    );
  }
  /** Cria ou atualiza a despesa "Dízimo 10%" na conta aberta (PJ ou PF), com base nas entradas do mês. */
  async function dizimo() {
    const T = totaisFin(itensDoMes());
    if (!(T.e > 0)) {
      say("Não há entradas neste mês para calcular o dízimo.", true);
      return;
    }
    const valor = Math.round(T.e * 10) / 100,
      ledger = finLedger;
    await finSync(
      (arr) => {
        const x = arr.find(
          (y) =>
            y.ledger === ledger &&
            y.tipo === "despesa" &&
            y.nome === "Dízimo 10%" &&
            String(y.data).slice(0, 7) === finMes,
        );
        if (x) x.valor = valor;
        else
          arr.push({
            id: novoId(),
            ledger: ledger,
            tipo: "despesa",
            nome: "Dízimo 10%",
            valor: valor,
            data: finMes === mesKey(new Date()) ? hojeISO() : finMes + "-01",
            cat: "Dízimo/Doações",
            pago: false,
            rec: true,
            criadoEm: Date.now(),
          });
      },
      "Dízimo calculado em " + ledger + " (" + brl(valor) + ")",
      "Dízimo " + ledger + " " + finMes,
    );
  }

  /* ----- Resumo, PDF e tabela ----- */
  /** Texto do resumo do mês para enviar no WhatsApp. */
  function resumoTexto() {
    const T = totaisFin(itensDoMes());
    const L = (x) =>
      "• " +
      x.nome +
      ": " +
      brl(x.valor) +
      (x.pago === false
        ? x.tipo === "entrada"
          ? " (a receber)"
          : " (a pagar)"
        : "");
    const linhas = [
      "📊 CONTROLE FINANCEIRO · " + finLedger,
      "📅 " + nomeMes(finMes),
      "",
      "💰 ENTRADAS",
    ]
      .concat(T.ent.length ? T.ent.map(L) : ["• —"])
      .concat(["", "TOTAL DE ENTRADAS: " + brl(T.e), "", "💸 DESPESAS"])
      .concat(T.des.length ? T.des.map(L) : ["• —"])
      .concat([
        "",
        "TOTAL DE DESPESAS: " + brl(T.d),
        "",
        (T.saldo >= 0 ? "✅" : "⚠️") + " SALDO DO MÊS: " + brl(T.saldo),
      ]);
    if (T.aReceber > 0) linhas.push("⏳ A receber: " + brl(T.aReceber));
    if (T.aPagar > 0) linhas.push("⏳ A pagar: " + brl(T.aPagar));
    return linhas.join("\n");
  }
  /** Mostra o resumo (editável) e envia por WhatsApp ou copia o texto. */
  async function enviarResumo() {
    const r = await askText({
      titulo: "📤 Resumo · " + finLedger + " · " + nomeMes(finMes),
      texto: resumoTexto(),
      botoes: [
        { id: "wpp", rotulo: "WhatsApp" },
        { id: "copiar", rotulo: "Copiar texto" },
        { id: "cancelar", rotulo: "Cancelar", sec: true },
      ],
    });
    if (r.acao === "wpp")
      abrir("https://wa.me/?text=" + encodeURIComponent(r.texto));
    else if (r.acao === "copiar") {
      try {
        await navigator.clipboard.writeText(r.texto);
        say("Texto copiado.");
      } catch (e) {
        say(
          "Não consegui copiar. Toque no texto, selecione tudo e copie.",
          true,
        );
      }
    }
  }
  /** Situação do item em texto. */
  function situacao(x) {
    if (x.tipo === "entrada")
      return x.pago === false ? "A receber" : "Recebido";
    return x.pago === false ? "A pagar" : "Pago";
  }
  /** Exporta o mês em tabela (CSV, abre no Excel). */
  async function finCsv() {
    const rows = [
      [
        "Data",
        "Tipo",
        "Nome",
        "Categoria",
        "Valor",
        "Situação",
        "Recorrente",
        "Origem",
      ],
    ].concat(
      itensDoMes().map((x) => [
        dataBR(x.data),
        x.tipo === "entrada" ? "Entrada" : "Despesa",
        x.nome,
        x.cat || "",
        x.valor.toFixed(2).replace(".", ","),
        situacao(x),
        x.rec ? "Sim" : "Não",
        x.derivado ? "NFS-e" : "Manual",
      ]),
    );
    try {
      await saveBlob(
        new Blob(
          ["\ufeff" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")],
          { type: "text/csv;charset=utf-8" },
        ),
        "financeiro-" + finLedger + "-" + finMes + ".csv",
      );
      say("Tabela gerada.");
    } catch (e) {
      say("Erro ao gerar a tabela: " + ((e && e.message) || e), true);
    }
  }
  /** Exporta o mês em PDF. */
  async function finPdf() {
    try {
      const T = totaisFin(itensDoMes()),
        doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
      let y = 36;
      try {
        doc.addImage(LOGO, "PNG", 14, 10, 16, 16);
      } catch (e) {}
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("AXION | SISTEMAS EMBARCADOS E ENERGIA", 34, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        "Controle financeiro " +
          finLedger +
          " · " +
          nomeMes(finMes) +
          " · gerado em " +
          new Date().toLocaleDateString("pt-BR"),
        34,
        22,
      );
      const nl = (h) => {
        if (y + h > 284) {
          doc.addPage();
          y = 20;
        }
      };
      const head = (s) => {
        nl(12);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(s.toUpperCase(), 14, y);
        y += 2;
        doc.line(14, y, 196, y);
        y += 5;
        doc.setFont("helvetica", "normal");
      };
      const row = (a, b, c) => {
        nl(6);
        doc.setFontSize(9);
        doc.text(String(a).slice(0, 60), 14, y);
        if (c) doc.text(String(c), 150, y);
        doc.text(String(b), 196, y, { align: "right" });
        y += 5.5;
      };
      head("Resumo");
      row("Total de entradas", brl(T.e));
      row("Total de despesas", brl(T.d));
      row("Saldo do mês", brl(T.saldo));
      if (T.aReceber > 0) row("A receber", brl(T.aReceber));
      if (T.aPagar > 0) row("A pagar", brl(T.aPagar));
      head("Entradas");
      T.ent.forEach((x) =>
        row(
          x.nome,
          brl(x.valor),
          dataBR(x.data) + (x.pago === false ? " · a receber" : ""),
        ),
      );
      head("Despesas");
      T.des.forEach((x) =>
        row(
          x.nome,
          brl(x.valor),
          dataBR(x.data) + (x.pago === false ? " · a pagar" : ""),
        ),
      );
      head("Despesas por categoria");
      porCategoria(T.des).forEach((c) =>
        row(c.nome, brl(c.v), T.d ? ((c.v / T.d) * 100).toFixed(0) + "%" : ""),
      );
      await saveBlob(
        doc.output("blob"),
        "financeiro-" + finLedger + "-" + finMes + ".pdf",
      );
      say("PDF gerado.");
    } catch (e) {
      say("Erro ao gerar o PDF: " + ((e && e.message) || e), true);
    }
  }

  /** Depois de lançar uma receita no PJ, oferece copiá-la também para a pessoa física. */
  async function oferecerReplica(rec) {
    if (
      rec.ledger !== "PJ" ||
      rec.tipo !== "entrada" ||
      !fin.some((x) => x.id === rec.id)
    )
      return;
    const r = await askText({
      titulo: "👤 Replicar na PF? · " + rec.nome + " · " + brl(rec.valor),
      semTexto: true,
      botoes: [
        { id: "sim", rotulo: "👤 Replicar na PF (mesmo valor)" },
        { id: "nao", rotulo: "Não replicar", sec: true },
      ],
    });
    if (r.acao !== "sim") return;
    const copia = Object.assign({}, rec, {
      id: novoId(),
      ledger: "PF",
      criadoEm: Date.now(),
    });
    await finSync(
      (arr) => {
        arr.push(copia);
      },
      "Receita replicada na PF",
      "Replicar na PF: " + rec.nome,
    );
  }
  /** Botão "Lançar" da nota; mostra onde ela já foi lançada. */
  function lancarBadge(n) {
    if (n.status === "cancelada") return "";
    const onde = [];
    fin.forEach((x) => {
      if (x.notaId !== n.id) return;
      const t = x.ledger + (x.tipo === "despesa" ? " (despesa)" : "");
      if (onde.indexOf(t) < 0) onde.push(t);
    });
    return (
      '<button class="badge' +
      (onde.length ? " ok" : "") +
      '" data-lancar="' +
      esc(n.id) +
      '">' +
      (onde.length ? "✅ Lançada: " + esc(onde.join(", ")) : "💸 Lançar") +
      "</button>"
    );
  }
  /** Menu para lançar o valor da nota no financeiro (PJ ou PF, entrada ou despesa). */
  async function lancarNota(id) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const r = await askText({
      titulo: "💸 Lançar no financeiro · " + n.nome + " · " + n.d.v.op,
      semTexto: true,
      botoes: [
        { id: "PJ-entrada", rotulo: "🏢 PJ · Entrada (receita)" },
        { id: "PF-entrada", rotulo: "👤 PF · Entrada (receita)" },
        { id: "PJ-despesa", rotulo: "🏢 PJ · Despesa", sec: true },
        { id: "PF-despesa", rotulo: "👤 PF · Despesa", sec: true },
        { id: "cancelar", rotulo: "Cancelar", sec: true },
      ],
    });
    if (r.acao === "cancelar") return;
    const p = r.acao.split("-"),
      ledger = p[0],
      tipo = p[1];
    const rec = {
      id: novoId(),
      ledger: ledger,
      tipo: tipo,
      nome: "NFS-e " + n.nome,
      valor: vOf(n),
      data: isoDeBR(n.pagoEm) || hojeISO(),
      cat: tipo === "entrada" ? "Serviço" : "Outros",
      pago: tipo === "entrada" ? n.status === "recebida" : true,
      rec: false,
      notaId: n.id,
      criadoEm: Date.now(),
    };
    let dup = false;
    await finSync(
      (arr) => {
        if (
          arr.some(
            (x) => x.notaId === n.id && x.ledger === ledger && x.tipo === tipo,
          )
        )
          dup = true;
        else arr.push(rec);
      },
      "Nota lançada no " + ledger + " (" + tipo + ")",
      "Lançar " + n.nome + " no " + ledger,
    );
    refreshList();
    if (dup) {
      say(
        "Esta nota já foi lançada no " + ledger + " como " + tipo + ".",
        true,
      );
      return;
    }
    finMes = rec.data.slice(0, 7);
    finLedger = ledger;
    await oferecerReplica(rec);
  }
  $("#launchbtn").addEventListener("click", () => {
    if (!current) return;
    const id = noteName(current);
    if (!notes.some((x) => x.id === id)) {
      say("Aguarde a nota ser salva e tente de novo.", true);
      return;
    }
    lancarNota(id);
  });

  /** Abre a tela do financeiro (pede a senha e sincroniza, se preciso). */
  async function showFin() {
    if (isProt() && !(await ensureUnlocked())) {
      say("🔒 Senha necessária para abrir o financeiro.", true);
      return;
    }
    hideAll();
    $("#finbox").hidden = false;
    renderFin();
    window.scrollTo({ top: 0 });
    const c = cfg();
    if (c.repo && c.token) {
      setSync("Sincronizando…");
      try {
        await ghLoad();
        persist();
        await finLoad();
        persistFin();
        markSync(true);
        setSync("✅ Sincronizado com " + c.repo);
      } catch (e) {
        markSync(false);
        setSync(
          "⚠️ Não sincronizou: " +
            ((e && e.message) || e) +
            ". Mostrando os dados deste aparelho.",
        );
      }
      renderFin();
    } else
      setSync(
        "💾 Dados guardados só neste aparelho. Toque em ⚙️ para guardar no GitHub.",
      );
  }
  $("#finbtn").addEventListener("click", showFin);
  $("#f_tabs").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-l]");
    if (!b) return;
    finLedger = b.getAttribute("data-l");
    renderFin();
  });
  $("#f_prev").addEventListener("click", () => {
    finMes = somaMes(finMes, -1);
    renderFin();
  });
  $("#f_next").addEventListener("click", () => {
    finMes = somaMes(finMes, 1);
    renderFin();
  });
  $("#f_mes").addEventListener("change", () => {
    finMes = $("#f_mes").value;
    renderFin();
  });
  $("#f_cur").addEventListener("click", (ev) => {
    if (!ev.target.closest("[data-fhoje]")) return;
    finMes = mesKey(new Date());
    renderFin();
  });
  $("#f_add_e").addEventListener("click", () => addItem("entrada"));
  $("#f_add_d").addEventListener("click", () => addItem("despesa"));
  $("#f_rep").addEventListener("click", repetirRecorrentes);
  $("#f_diz").addEventListener("click", dizimo);
  $("#f_wpp").addEventListener("click", enviarResumo);
  $("#f_pdf").addEventListener("click", finPdf);
  $("#f_csv").addEventListener("click", finCsv);
  $("#f_lists").addEventListener("click", async (ev) => {
    const p = ev.target.closest("[data-fpago]");
    if (p) {
      ev.stopPropagation();
      await togglePago(p.getAttribute("data-fpago"));
      return;
    }
    const e = ev.target.closest("[data-fedit]");
    if (e) await editItem(e.getAttribute("data-fedit"));
  });

  /* ================= Tela inicial ================= */
  /** Atualiza os números do cartão "Visão geral" da tela inicial. */
  function renderHome() {
    const hi = $("#homeHi");
    if (!hi) return;
    const now = new Date();
    hi.textContent =
      "Olá! · " +
      now.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    let mes = 0,
      ano = 0,
      aReceber = 0,
      qtd = 0;
    notes.forEach((n) => {
      if (!ativa(n)) return;
      qtd++;
      const x = ndate(n),
        v = vOf(n);
      if (x && x.y === now.getFullYear()) {
        ano += v;
        if (x.m === now.getMonth() + 1) mes += v;
      }
      if ((n.status || "receber") === "receber") aReceber += v;
    });
    $("#hMes").textContent = brl(mes);
    $("#hSub").textContent =
      "faturado em " +
      now.toLocaleDateString("pt-BR", { month: "long" }) +
      " · a receber " +
      brl(aReceber) +
      " · " +
      qtd +
      " nota(s)";
    $("#hPct").textContent = Math.round((ano / LIMITE_MEI) * 100) + "%";
  }
  /** Cada quadrado da tela inicial leva para uma ferramenta. */
  $("#empty").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-go]");
    if (!b) return;
    const go = b.getAttribute("data-go");
    if (go === "nota") openPicker();
    else if (go === "fin") showFin();
    else if (go === "rel") showRep();
    else if (go === "notas") showList();
    else if (go === "cfg") $("#cfgbtn").click();
  });

  /* ---------- Inicialização ---------- */
  renderHome();
  updateSyncLabel();
  // Avisa se alguma biblioteca externa não carregou (internet ou bloqueio de segurança)
  const faltando = [];
  if (typeof pdfjsLib === "undefined") faltando.push("leitor de PDF");
  if (typeof qrcode === "undefined") faltando.push("QR Code");
  if (typeof html2canvas === "undefined") faltando.push("imagem da nota");
  if (!window.jspdf) faltando.push("gerador de PDF");
  if (faltando.length)
    say(
      "⚠️ Não carregou: " +
        faltando.join(", ") +
        ". Verifique a internet e recarregue a página.",
      true,
    );
})();
