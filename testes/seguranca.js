/**
 * AXION · Testes · Segurança
 *
 * Token criptografado (nunca em texto puro), senha errada e limite de 5 tentativas, bloqueio
 * automático em 10 min, sem cópia dos dados no aparelho quando há senha, token só para a API
 * do GitHub (nunca na URL), textos maliciosos (XSS) não executam, CSP e SRI funcionando.
 *
 * Depende de: testes/apoio.js
 */
"use strict";

const A = require("./apoio");

const TOKEN = "github_pat_TESTE_FALSO_0123456789";
const SENHA = "senha-de-teste-forte";
const XSS = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const XSS2 = '"><svg onload="window.__xss=(window.__xss||0)+1">';

/** Configura o GitHub com senha pela tela de Configurações. */
async function configurar(pg) {
  await A.vai(pg, "config");
  await pg.fill("#c_repo", "teste/dados");
  await pg.fill("#c_token", TOKEN);
  await pg.fill("#c_pass", SENHA);
  await pg.fill("#c_pass2", SENHA);
  await A.clica(pg, "#c_save", 3000);
}
/** Todo o conteúdo do armazenamento do navegador (local e de sessão) num texto só. */
const armazenado = (pg) =>
  pg.evaluate(
    () =>
      JSON.stringify(Object.assign({}, localStorage)) +
      JSON.stringify(Object.assign({}, sessionStorage)),
  );

module.exports = async function (site) {
  A.grupo("Segurança: token, senha e bloqueio");
  const gh = A.githubFalso({
    "notas.json": [A.nota(1, "Cliente Sigiloso", 500)],
    "ordens.json": [A.ordem(9, "Cliente Sigiloso")],
  });
  let s = await A.abrir(site, { celular: true, github: gh });
  let { pg } = s;
  await configurar(pg);
  const guardado = await armazenado(pg);
  A.confere(
    "Token NÃO fica em texto puro no aparelho",
    !guardado.includes(TOKEN) && !guardado.includes("TESTE_FALSO"),
  );
  A.confere("Senha NÃO fica guardada no aparelho", !guardado.includes(SENHA));
  const cfgSalva = JSON.parse(
    await pg.evaluate(() => localStorage.getItem("axion_nfse_cfg")),
  );
  A.confere(
    "Token cifrado com AES-GCM + PBKDF2 (600 mil rodadas, sal e IV aleatórios)",
    cfgSalva.enc &&
      cfgSalva.enc.iter >= 600000 &&
      cfgSalva.enc.salt &&
      cfgSalva.enc.iv &&
      !cfgSalva.token,
  );

  // recarrega: precisa da senha
  await pg.reload();
  await pg.waitForTimeout(600);
  const antes = gh.pedidos.length;
  await A.vai(pg, "notas");
  A.confere(
    "Depois de recarregar, pede a senha para abrir as notas",
    await pg.isVisible("#pwmodal"),
  );
  for (let i = 1; i <= 4; i++) {
    await pg.fill("#pwin", "errada" + i);
    await A.clica(pg, "#pwok", 1500);
  }
  A.confere(
    "Senha errada é recusada e conta as tentativas",
    /\(4\/5\)/.test(await pg.innerText("#pwmsg")),
  );
  await pg.fill("#pwin", "errada5");
  await A.clica(pg, "#pwok", 1500);
  A.confere(
    "Após 5 senhas erradas, desiste (janela fecha, nada é aberto)",
    !(await pg.isVisible("#pwmodal")) && !(await pg.isVisible("#listbox")),
  );
  A.confere(
    "Com senha errada nenhum pedido com token foi ao GitHub",
    gh.pedidos.slice(antes).every((p) => !p.auth.includes(TOKEN)),
  );

  await A.vai(pg, "notas");
  await pg.fill("#pwin", SENHA);
  await A.clica(pg, "#pwok", 2500);
  A.confere(
    "Senha certa libera e sincroniza",
    (await pg.isVisible("#listbox")) &&
      /Cliente Sigiloso/.test(await pg.innerText("#items")),
  );
  const comToken = gh.pedidos.filter((p) => p.auth.includes(TOKEN));
  A.confere(
    "Token enviado só no cabeçalho Authorization para api.github.com",
    comToken.length > 0 &&
      comToken.every((p) => p.url.startsWith("https://api.github.com/")),
  );
  A.confere(
    "Token nunca aparece na URL",
    gh.pedidos.every((p) => !p.url.includes(TOKEN)) &&
      s.outros.every((u) => !u.includes(TOKEN)),
  );
  A.confere(
    "Nenhum pedido a outros sites",
    s.outros.length === 0,
    s.outros.slice(0, 3).join(" "),
  );
  await A.vai(pg, "oslist", 600);
  const local = await pg.evaluate(() =>
    [
      localStorage.getItem("axion_nfse_notas"),
      localStorage.getItem("axion_nfse_os"),
    ].join(""),
  );
  A.confere(
    "Com senha, os dados NÃO ficam guardados no aparelho",
    !local.includes("Sigiloso"),
  );

  // bloqueio automático: adianta o relógio 11 minutos
  await pg.evaluate(() => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + 11 * 60 * 1000;
  });
  await A.vai(pg, "notas");
  A.confere(
    "Bloqueio automático: após 10 min sem uso pede a senha de novo",
    await pg.isVisible("#pwmodal"),
  );
  await A.clica(pg, "#pwcancel");
  A.confere(
    "Cancelar a senha não abre as notas",
    !(await pg.isVisible("#listbox")),
  );
  A.confere(
    "Sem erros de JavaScript",
    s.erros.length === 0,
    s.erros.join(" | "),
  );
  await s.navegador.close();

  /* ------------------------------------------------ XSS */
  A.grupo("Segurança: textos maliciosos (XSS)");
  const notaX = A.nota(1, XSS, 100);
  notaX.d.s.desc = XSS2;
  notaX.d.t.email = XSS;
  notaX.obs = XSS;
  const osX = A.ordem(1, XSS, {
    veiculo: XSS2,
    placa: XSS,
    obs: XSS,
    pagamento: XSS2,
    prods: [{ nome: XSS, qtd: 1, valor: 10 }],
    servs: [{ nome: XSS2, modo: "fixo", horas: 0, vh: 0, valor: 10 }],
    checklist: { itens: { [XSS]: "defeito", Bateria: "ok" }, obs: XSS2 },
  });
  osX.id = 'x"><img src=x onerror=window.__xss=1>';
  s = await A.abrir(site, {
    dados: A.dadosLocais({
      notas: [notaX],
      os: [osX],
      fin: [
        A.lancamento(1, { nome: XSS, cat: XSS2 }),
        A.lancamento(3, { nome: XSS2, tipo: "entrada" }),
      ],
      perfis: [{ id: "PF", nome: XSS, criadoEm: 1 }],
      servicos: [{ id: "s1", nome: XSS, modo: "fixo", valor: 10 }],
    }),
  });
  pg = s.pg;
  const telas = ["notas", "relNotas", "oslist", "cadastro", "osrel", "perfis"];
  for (const t of telas) await A.vai(pg, t, 300);
  await A.vai(pg, "notas");
  await A.clica(pg, "#items .item .nm", 400);
  await A.vai(pg, "notas");
  await A.clica(pg, "[data-cobrar]", 300);
  await A.clica(pg, '#txbtns [data-a="cancelar"]');
  await A.clica(pg, "[data-lancar]", 300);
  await A.clica(pg, '#txbtns [data-a="cancelar"]');
  await A.vai(pg, "oslist");
  await A.clica(pg, "[data-osopen]", 400);
  await A.clica(pg, "#os_edit", 300);
  await A.vai(pg, "perfis");
  await A.clica(pg, ".pcard .pc-name", 300).catch(() => {});
  await pg.fill("#gsearch", "img").catch(() => {});
  await pg.press("#gsearch", "Enter").catch(() => {});
  await pg.waitForTimeout(400);
  const xss = await pg.evaluate(() => window.__xss || 0);
  const injetados = await pg.evaluate(
    () => document.querySelectorAll("[onerror],[onload]").length,
  );
  A.confere(
    "Nenhum código injetado executou em nenhuma tela",
    xss === 0,
    "execuções: " + xss,
  );
  A.confere(
    "Nenhum elemento com onerror/onload foi criado",
    injetados === 0,
    injetados + " elementos",
  );
  A.confere(
    "Sem erros de JavaScript",
    s.erros.length === 0,
    s.erros.join(" | "),
  );

  /* ------------------------------------------------ CSP e SRI */
  A.grupo("Segurança: CSP e SRI");
  const csp = await pg
    .$eval('meta[http-equiv="Content-Security-Policy"]', (m) => m.content)
    .catch(() => "");
  A.confere(
    "CSP presente e restritiva",
    /default-src 'none'/.test(csp) &&
      /object-src 'none'/.test(csp) &&
      /base-uri 'none'/.test(csp) &&
      !/unsafe-eval/.test(csp) &&
      !/script-src[^;]*unsafe-inline/.test(csp),
  );
  const bloqueouInline = await pg.evaluate(
    () =>
      new Promise((ok) => {
        document.addEventListener(
          "securitypolicyviolation",
          () => ok(window.__inline !== 1),
          { once: true },
        );
        const sc = document.createElement("script");
        sc.textContent = "window.__inline=1";
        document.body.appendChild(sc);
        setTimeout(() => ok(false), 1000);
      }),
  );
  A.confere("CSP bloqueia <script> injetado na página", bloqueouInline);
  // o texto do setTimeout roda no contexto da página (onde a CSP vale), como faria um ataque
  const bloqueouEval = await pg.evaluate(
    () =>
      new Promise((ok) => {
        setTimeout("window.__ev=1", 0);
        setTimeout(() => ok(window.__ev !== 1), 300);
      }),
  );
  A.confere(
    "CSP bloqueia código montado a partir de texto (eval)",
    bloqueouEval,
  );
  const bloqueouExterno = await pg.evaluate(
    () =>
      new Promise((ok) => {
        const sc = document.createElement("script");
        sc.src = "https://exemplo-malicioso.com/x.js";
        sc.onerror = () => ok(true);
        sc.onload = () => ok(false);
        document.body.appendChild(sc);
        setTimeout(() => ok(true), 1500);
      }),
  );
  A.confere(
    "CSP bloqueia script de outro site",
    bloqueouExterno && !s.outros.some((u) => u.includes("exemplo-malicioso")),
  );
  const html = require("fs").readFileSync(A.RAIZ + "/index.html", "utf8");
  A.confere(
    "index.html sem <script> embutido nem onclick",
    !/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && !/\son[a-z]+=/i.test(html),
  );
  const externos = await pg.$$eval(
    "script[src^='https://cdn.jsdelivr.net/']",
    (l) => l.map((x) => ({ src: x.src, sri: x.integrity, co: x.crossOrigin })),
  );
  A.confere(
    "Toda biblioteca externa tem SRI (sha384) e crossorigin",
    externos.length >= 4 &&
      externos.every((x) => /^sha384-/.test(x.sri) && x.co === "anonymous"),
    externos.length + " bibliotecas",
  );
  A.confere(
    "Sem erros de JavaScript",
    s.erros.length === 0,
    s.erros.join(" | "),
  );
  await s.navegador.close();

  s = await A.abrir(site, { cdn: "adulterado" });
  const rodou = await s.pg.evaluate(() => window.__adulterado === 1);
  const libs = await s.pg.evaluate(
    () => typeof window.pdfjsLib + "/" + typeof window.qrcode,
  );
  A.confere(
    "Biblioteca do CDN adulterada é bloqueada pelo SRI",
    !rodou && libs === "undefined/undefined",
    libs,
  );
  A.confere(
    "Com CDN adulterado, o app avisa em vez de quebrar",
    s.erros.length === 0 && (await s.pg.isVisible("#empty")),
    (await s.pg.innerText("#msg").catch(() => "")).slice(0, 90),
  );
  await s.navegador.close();
};
