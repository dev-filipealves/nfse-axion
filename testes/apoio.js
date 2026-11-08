/**
 * AXION · Testes · Apoio
 *
 * Peças comuns a todos os testes: servidor local do site, navegador (Playwright), bibliotecas
 * do CDN servidas a partir do node_modules, um GitHub falso (em memória, com falhas
 * programáveis) e dados de exemplo inventados (nenhum dado real de cliente).
 *
 * Depende de: playwright, pdfjs-dist, qrcode-generator, html2canvas, jspdf (package.json)
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RAIZ = path.resolve(__dirname, "..");
const NM = path.join(__dirname, "node_modules");

/* ---------------------------------------------------------------- Resultado */

const resultados = [];
let grupoAtual = "";

/** Começa um grupo de testes (só para o relatório). */
function grupo(nome) {
  grupoAtual = nome;
  console.log("\n== " + nome + " ==");
}
/** Registra uma verificação: ok (true/false) e um detalhe opcional. */
function confere(nome, ok, detalhe) {
  resultados.push({
    grupo: grupoAtual,
    nome,
    ok: !!ok,
    detalhe: detalhe || "",
  });
  console.log(
    (ok ? "  ✅ " : "  ❌ ") + nome + (detalhe ? "  — " + detalhe : ""),
  );
}
/** Registra uma medida de desempenho (aprovada se ficar dentro do limite em ms). */
function mede(nome, ms, limite) {
  confere(nome, ms <= limite, ms.toFixed(0) + " ms (limite " + limite + " ms)");
}

/* ---------------------------------------------------------------- Servidor */

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};
/** Sobe um servidor local com os arquivos do site. Devolve { url, bytes, fechar }. */
function servidor() {
  const bytes = { total: 0 };
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    const arq = path.join(RAIZ, p === "/" ? "index.html" : p);
    if (
      !arq.startsWith(RAIZ) ||
      !fs.existsSync(arq) ||
      fs.statSync(arq).isDirectory()
    ) {
      res.writeHead(404);
      return res.end();
    }
    const dado = fs.readFileSync(arq);
    bytes.total += dado.length;
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream",
    });
    res.end(dado);
  });
  return new Promise((ok) =>
    srv.listen(0, "127.0.0.1", () =>
      ok({
        url: "http://127.0.0.1:" + srv.address().port + "/index.html",
        bytes,
        fechar: () => srv.close(),
      }),
    ),
  );
}

/* ---------------------------------------------------------------- GitHub falso */

/**
 * GitHub em memória. arquivos: { "notas.json": <lista> }. falha(req) pode devolver
 * { status, corpo } | "abortar" | "demorar" para simular erros. pedidos guarda cada chamada.
 */
function githubFalso(arquivos) {
  const g = { arquivos: {}, shas: {}, pedidos: [], falha: null, n: 0 };
  for (const [k, v] of Object.entries(arquivos || {}))
    g.arquivos[k] = JSON.stringify(v);
  g.rota = async (route) => {
    const r = route.request();
    const url = r.url();
    const p = url.includes("/contents/")
      ? decodeURIComponent(url.split("/contents/")[1].split("?")[0])
      : null;
    g.pedidos.push({
      url,
      metodo: r.method(),
      auth: r.headers()["authorization"] || "",
      arquivo: p,
    });
    const f = g.falha && g.falha({ metodo: r.method(), arquivo: p, url });
    if (f === "abortar") return route.abort("failed");
    if (f === "demorar") return; // nunca responde (o app precisa sobreviver)
    if (f)
      return route.fulfill({
        status: f.status,
        body: f.corpo || "{}",
        contentType: "application/json",
      });
    if (!p)
      return route.fulfill({ status: 200, json: { full_name: "teste/dados" } });
    if (r.method() === "PUT") {
      const corpo = JSON.parse(r.postData());
      if (g.shas[p] && corpo.sha !== g.shas[p])
        return route.fulfill({ status: 409, json: { message: "conflict" } });
      g.arquivos[p] = Buffer.from(corpo.content, "base64").toString("utf8");
      g.shas[p] = "sha" + ++g.n;
      return route.fulfill({
        status: 200,
        json: { content: { sha: g.shas[p] } },
      });
    }
    if (!(p in g.arquivos)) return route.fulfill({ status: 404, json: {} });
    if (!g.shas[p]) g.shas[p] = "sha" + ++g.n;
    return route.fulfill({
      status: 200,
      json: {
        sha: g.shas[p],
        content: Buffer.from(g.arquivos[p], "utf8").toString("base64"),
      },
    });
  };
  /** Conteúdo atual de um arquivo do repositório falso (já convertido de JSON). */
  g.ler = (p) => JSON.parse(g.arquivos[p] || "null");
  return g;
}

/* ---------------------------------------------------------------- Navegador */

/** Serve as bibliotecas do CDN (jsDelivr) a partir do node_modules; adulterar=true muda o conteúdo. */
function rotaCdn(adulterar) {
  return (route) => {
    const m = route
      .request()
      .url()
      .match(/https:\/\/cdn\.jsdelivr\.net\/npm\/(@?[^@]+)@[^/]+\/(.*)/);
    const arq = m && path.join(NM, m[1], m[2]);
    if (!arq || !fs.existsSync(arq)) return route.abort("failed");
    let corpo = fs.readFileSync(arq);
    if (adulterar)
      corpo = Buffer.concat([corpo, Buffer.from("\n;window.__adulterado=1;")]);
    return route.fulfill({
      body: corpo,
      contentType: "application/javascript",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  };
}

/**
 * Abre o navegador com o site. opcoes: { celular, dados (localStorage), github, cdn: "ok"|"fora"|"adulterado",
 * cpu (lentidão, ex. 4) }. Devolve { navegador, ctx, pg, erros, outros (pedidos a outros sites) }.
 */
async function abrir(site, opcoes) {
  const o = opcoes || {};
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({
    viewport: o.celular
      ? { width: 390, height: 844 }
      : { width: 1366, height: 900 },
    isMobile: !!o.celular,
    hasTouch: !!o.celular,
    acceptDownloads: true,
  });
  const outros = [];
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(site.url.replace(/\/index\.html$/, "")))
      return route.fallback();
    outros.push(u);
    return route.abort("blockedbyclient");
  });
  if (o.cdn === "fora")
    await ctx.route("https://cdn.jsdelivr.net/**", (r) => r.abort("failed"));
  else
    await ctx.route(
      "https://cdn.jsdelivr.net/**",
      rotaCdn(o.cdn === "adulterado"),
    );
  if (o.github) await ctx.route("https://api.github.com/**", o.github.rota);
  if (o.dados) {
    const js = Object.entries(o.dados)
      .map(
        ([k, v]) =>
          "localStorage.setItem(" +
          JSON.stringify(k) +
          "," +
          JSON.stringify(typeof v === "string" ? v : JSON.stringify(v)) +
          ");",
      )
      .join("");
    await ctx.addInitScript(
      "if(!sessionStorage.getItem('__ini')){sessionStorage.setItem('__ini','1');" +
        js +
        "}",
    );
  }
  ctx.on("page", (p) => p.on("popup", (x) => x.close().catch(() => {})));
  const pg = await ctx.newPage();
  const erros = [];
  pg.on("pageerror", (e) => erros.push(String(e && e.message ? e.message : e)));
  pg.on("dialog", (d) => d.accept().catch(() => {}));
  if (o.cpu) {
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.cpu });
  }
  await pg.goto(site.url);
  await pg.waitForTimeout(600);
  return { navegador, ctx, pg, erros, outros };
}

/** Clica num seletor e espera a tela assentar. */
async function clica(pg, sel, espera) {
  await pg.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("não achei " + s);
    el.click();
  }, sel);
  await pg.waitForTimeout(espera == null ? 200 : espera);
}
/** Volta à tela inicial pelo menu. */
async function inicio(pg) {
  await clica(pg, '[data-go="home"]');
}
/** Caminhos de navegação até cada tela (pela tela inicial). */
const TELAS = {
  notas: ['#empty .tile[data-go="nf"]', '#nfhub .tile[data-go="notas"]'],
  relNotas: ['#empty .tile[data-go="nf"]', '#nfhub .tile[data-go="rel"]'],
  oslist: ['#empty .tile[data-go="os"]', '#oshub .tile[data-go="oslist"]'],
  cadastro: ['#empty .tile[data-go="os"]', '#oshub .tile[data-go="cat"]'],
  osrel: ['#empty .tile[data-go="os"]', '#oshub .tile[data-go="osrep"]'],
  perfis: ['#empty .tile[data-go="fin"]'],
  config: ['#empty .tile[data-go="cfg"]'],
};
/** Vai até uma tela (nome de TELAS), partindo da inicial. */
async function vai(pg, tela, espera) {
  await inicio(pg);
  for (const s of TELAS[tela]) await clica(pg, s, espera);
}

/* ---------------------------------------------------------------- Dados de exemplo (inventados) */

const hoje = new Date();
const ISO = (d) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");
/** Data AAAA-MM-DD deslocada em dias a partir de hoje. */
const diasAtras = (n) =>
  ISO(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n));
const brlTxt = (v) =>
  "R$ " +
  v
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Nota fiscal de exemplo no formato salvo pelo app. */
function nota(n, cliente, valor, status, data) {
  const [y, m, d] = (data || ISO(hoje)).split("-");
  const id =
    String(n).padStart(2, "0") +
    "-" +
    d +
    m +
    y +
    "-" +
    cliente.slice(0, 10).toUpperCase();
  return {
    id,
    nome: id,
    salvoEm: Date.now(),
    status: status || "receber",
    pagoEm: "",
    obs: "",
    d: {
      numero: String(n),
      emissao: d + "/" + m + "/" + y + " 10:00:00",
      chave: "1".repeat(50),
      serie: "1",
      dps: String(n),
      competencia: d + "/" + m + "/" + y,
      situacao: "-",
      emitente: "-",
      s: {
        desc: "Serviço de teste " + n,
        trib: "14.01.01 / -",
        nbs: "1.2001.31.10",
        local: "Cidade Teste / RS",
      },
      p: {
        doc: "00.000.000/0001-00",
        nome: "EMPRESA TESTE",
        tel: "-",
        mun: "Cidade Teste / RS",
        cep: "-",
        end: "-",
        email: "-",
        im: "-",
        regime: "MEI",
      },
      t: {
        nome: cliente,
        doc: "000.000.000-00",
        tel: "(51) 90000-0000",
        mun: "-",
        cep: "-",
        end: "-",
        email: "cliente@exemplo.com",
        im: "-",
      },
      iss: { tipo: "Operação Tributável" },
      v: {
        op: brlTxt(valor),
        liq: brlTxt(valor),
        ret: "-",
        di: "-",
        dc: "-",
        ibs: "R$ 0,00",
      },
    },
  };
}
/** Ordem de serviço de exemplo. */
function ordem(n, cliente, extra) {
  return Object.assign(
    {
      id: "os" + n,
      numero: n,
      data: ISO(hoje),
      cliente,
      tel: "51900000000",
      veiculo: "Motorhome " + n,
      placa: "TST" + (1000 + (n % 9000)),
      status: "aberta",
      prods: [{ nome: "Peça " + n, qtd: 2, valor: 50 }],
      servs: [
        { nome: "Mão de obra", modo: "hora", horas: 1.5, vh: 80, valor: 0 },
      ],
      desconto: 0,
      pagamento: "Pix",
      obs: "",
      garantia: 90,
    },
    extra || {},
  );
}
/** Lançamento financeiro de exemplo. */
function lancamento(i, extra) {
  return Object.assign(
    {
      id: "f" + i,
      ledger: "PF",
      tipo: i % 3 ? "despesa" : "entrada",
      nome: "Lançamento " + i,
      valor: 10 + (i % 97),
      data: diasAtras(i % 300),
      cat: "Outros",
      pago: i % 2 === 0,
    },
    extra || {},
  );
}
const PERFIS = [{ id: "PF", nome: "Pessoa Teste", criadoEm: 1 }];

/** Monta o localStorage do app com listas de exemplo. */
function dadosLocais(d) {
  const r = {};
  if (d.notas) r.axion_nfse_notas = d.notas;
  if (d.os) r.axion_nfse_os = d.os;
  if (d.fin) r.axion_nfse_fin = d.fin;
  if (d.perfis) r.axion_nfse_perfis = d.perfis;
  if (d.servicos) r.axion_nfse_servicos = d.servicos;
  if (d.cfg) r.axion_nfse_cfg = d.cfg;
  return r;
}

module.exports = {
  RAIZ,
  resultados,
  grupo,
  confere,
  mede,
  servidor,
  githubFalso,
  abrir,
  clica,
  inicio,
  vai,
  TELAS,
  ISO,
  diasAtras,
  nota,
  ordem,
  lancamento,
  PERFIS,
  dadosLocais,
};
