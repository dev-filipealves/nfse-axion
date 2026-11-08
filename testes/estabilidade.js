/**
 * AXION · Testes · Estabilidade
 *
 * Dados corrompidos no aparelho, falhas do GitHub (401, 403, 404, 409, 500, JSON inválido,
 * sem internet, sem resposta), CDN fora do ar e um "teste do macaco" com centenas de toques
 * aleatórios. O app não pode travar nem perder dados.
 *
 * Depende de: testes/apoio.js
 */
"use strict";

const A = require("./apoio");

/** Passa por todas as telas principais e devolve quantas abriram. */
async function percorre(pg) {
  let abriu = 0;
  for (const t of Object.keys(A.TELAS)) {
    try {
      await A.vai(pg, t, 250);
      abriu++;
    } catch (e) {}
  }
  // abre também o primeiro item de cada lista (nota, OS e editor, perfil)
  const abre = [
    ["notas", "#items .item .nm"],
    ["oslist", "[data-osopen]"],
    ["oslist", "[data-osedit]"],
    ["perfis", ".pcard .pc-name"],
  ];
  for (const [t, sel] of abre) {
    await A.vai(pg, t, 250).catch(() => {});
    if (await pg.$(sel)) await A.clica(pg, sel, 300).catch(() => {});
  }
  return abriu;
}

module.exports = async function (site) {
  /* ------------------------------------------------ dados corrompidos */
  A.grupo("Estabilidade: dados corrompidos no aparelho");
  const lixo = {
    "texto que não é JSON": "{{{nada",
    "objeto no lugar de lista": { a: 1 },
    null: "null",
    "lista com itens quebrados": [
      null,
      1,
      "x",
      {},
      { id: "q", d: null },
      { id: "q2", status: 5, prods: "x", servs: null },
    ],
  };
  for (const [nome, valor] of Object.entries(lixo)) {
    const dados = {};
    for (const k of [
      "axion_nfse_notas",
      "axion_nfse_os",
      "axion_nfse_fin",
      "axion_nfse_perfis",
      "axion_nfse_servicos",
      "axion_nfse_cfg",
      "axion_nfse_lastsync",
    ])
      dados[k] = valor;
    const s = await A.abrir(site, { dados });
    const abriu = await percorre(s.pg);
    A.confere(
      "Abre todas as telas com " + nome,
      abriu === Object.keys(A.TELAS).length && s.erros.length === 0,
      abriu + " telas · " + s.erros.slice(0, 2).join(" | "),
    );
    await s.navegador.close();
  }

  /* ------------------------------------------------ falhas do GitHub */
  A.grupo("Estabilidade: falhas do GitHub");
  const cfg = {
    repo: "teste/dados",
    token: "github_pat_TESTE",
    path: "notas.json",
  };
  const casos = {
    "401 token inválido": { status: 401 },
    "403 sem permissão": { status: 403 },
    "500 erro do servidor": { status: 500 },
    "JSON inválido": {
      status: 200,
      corpo:
        '{"sha":"1","content":"' +
        Buffer.from("{quebrado").toString("base64") +
        '"}',
    },
    "sem internet": "abortar",
  };
  for (const [nome, f] of Object.entries(casos)) {
    const gh = A.githubFalso({
      "notas.json": [A.nota(1, "Cliente Remoto", 100)],
    });
    gh.falha = () => f;
    const s = await A.abrir(site, {
      github: gh,
      dados: A.dadosLocais({ cfg, notas: [A.nota(2, "Cliente Local", 50)] }),
    });
    await A.vai(s.pg, "notas", 1500);
    const msg = await s.pg.innerText("#msg");
    const lista = await s.pg.innerText("#items");
    A.confere(
      "GitHub " + nome + ": avisa e mostra os dados do aparelho",
      /⚠️/.test(msg) && /Cliente Local/.test(lista) && s.erros.length === 0,
      msg.slice(0, 70),
    );
    await s.navegador.close();
  }
  {
    // GitHub que não responde: a tela continua utilizável
    const gh = A.githubFalso({});
    gh.falha = () => "demorar";
    const s = await A.abrir(site, {
      github: gh,
      dados: A.dadosLocais({ cfg, os: [A.ordem(1, "Cliente Local")] }),
    });
    await A.vai(s.pg, "oslist", 800);
    const ok = /Cliente Local/.test(await s.pg.innerText("#os_items"));
    await A.inicio(s.pg);
    A.confere(
      "GitHub sem resposta: lista aparece e dá para navegar",
      ok && (await s.pg.isVisible("#empty")) && s.erros.length === 0,
    );
    await s.navegador.close();
  }
  {
    // 409: alguém salvou antes (outro aparelho) — o app relê e salva sem perder nada
    const gh = A.githubFalso({
      "ordens.json": [A.ordem(1, "Feita no outro aparelho")],
    });
    gh.shas["ordens.json"] = "sha-antigo";
    const s = await A.abrir(site, {
      github: gh,
      dados: A.dadosLocais({ cfg }),
    });
    await A.vai(s.pg, "oslist", 800);
    // outro aparelho grava enquanto esta tela está aberta
    const outra = gh.ler("ordens.json");
    outra.push(A.ordem(2, "Também do outro aparelho"));
    gh.arquivos["ordens.json"] = JSON.stringify(outra);
    gh.shas["ordens.json"] = "sha-novo";
    await A.clica(s.pg, "#os_new");
    await s.pg.fill("#os_cliente", "Feita aqui");
    await A.clica(s.pg, "#os_add" + "p");
    const c = await s.pg.$$("#os_prods > *:last-child input");
    await c[0].fill("Item");
    await c[c.length - 1].fill("10");
    await s.pg.dispatchEvent("#os_prods > *:last-child input", "input");
    await A.clica(s.pg, "#os_save", 1500);
    const nomes = (gh.ler("ordens.json") || [])
      .map((o) => o.cliente)
      .sort()
      .join(", ");
    A.confere(
      "Conflito 409: relê e salva sem perder a OS do outro aparelho",
      nomes ===
        "Feita aqui, Feita no outro aparelho, Também do outro aparelho" &&
        s.erros.length === 0,
      nomes,
    );
    await s.navegador.close();
  }

  {
    // arquivo do GitHub com itens quebrados no meio
    const gh = A.githubFalso({
      "ordens.json": [
        null,
        7,
        "x",
        {},
        { id: "z", prods: "x" },
        A.ordem(3, "Cliente Válido"),
      ],
    });
    const s = await A.abrir(site, {
      github: gh,
      dados: A.dadosLocais({ cfg }),
    });
    await A.vai(s.pg, "oslist", 800);
    await A.clica(s.pg, '[data-osopen="os3"]', 300);
    A.confere(
      "GitHub com itens quebrados: ignora o lixo e abre o que é válido",
      /Cliente Válido/.test(await s.pg.innerText("#ospaper")) &&
        s.erros.length === 0,
      s.erros.slice(0, 2).join(" | "),
    );
    await s.navegador.close();
  }

  /* ------------------------------------------------ CDN fora */
  A.grupo("Estabilidade: bibliotecas (CDN) fora do ar");
  {
    const s = await A.abrir(site, {
      cdn: "fora",
      dados: A.dadosLocais({
        os: [A.ordem(1, "Cliente")],
        notas: [A.nota(1, "Cliente", 10)],
        perfis: A.PERFIS,
      }),
    });
    const msg = await s.pg.innerText("#msg");
    const abriu = await percorre(s.pg);
    A.confere(
      "Sem CDN: avisa o que não carregou",
      /Não carregou/.test(msg),
      msg.slice(0, 60),
    );
    A.confere(
      "Sem CDN: as telas continuam abrindo",
      abriu === Object.keys(A.TELAS).length && s.erros.length === 0,
      s.erros.slice(0, 2).join(" | "),
    );
    await A.vai(s.pg, "oslist");
    await A.clica(s.pg, "[data-osopen]", 400);
    A.confere(
      "Sem CDN: a OS abre (só sem o QR do Pix)",
      /CLIENTE/.test(await s.pg.innerText("#ospaper")) && s.erros.length === 0,
      s.erros.slice(0, 2).join(" | "),
    );
    await s.navegador.close();
  }

  /* ------------------------------------------------ teste do macaco */
  A.grupo("Estabilidade: 600 toques aleatórios (celular e computador)");
  for (const celular of [true, false]) {
    const dados = A.dadosLocais({
      notas: Array.from({ length: 30 }, (_, i) =>
        A.nota(i + 1, "Cliente " + i, 100 + i, i % 2 ? "recebida" : "receber"),
      ),
      os: Array.from({ length: 20 }, (_, i) =>
        A.ordem(i + 1, "Cliente " + i, {
          status: ["aberta", "concluida", "paga"][i % 3],
          concluidaEm: A.diasAtras(i * 10),
        }),
      ),
      fin: Array.from({ length: 60 }, (_, i) => A.lancamento(i)),
      perfis: A.PERFIS,
      servicos: [{ id: "s1", nome: "Mão de obra", modo: "hora", valor: 80 }],
    });
    const s = await A.abrir(site, { celular, dados });
    let semente = 12345;
    const sorteio = (n) =>
      (semente = (semente * 1103515245 + 12345) % 2147483648) % n;
    let toques = 0;
    for (let i = 0; i < 300; i++) {
      const alvos = await s.pg.$$eval(
        "button, .tile, .item, [data-go], select, .chip, .pcard",
        (l) =>
          l
            .map((el, k) => {
              el.dataset.mk = k;
              return el;
            })
            .filter(
              (el) =>
                el.offsetParent !== null && !el.disabled && el.id !== "c_clear",
            )
            .map((el) => el.dataset.mk),
      );
      if (!alvos.length) break;
      const mk = alvos[sorteio(alvos.length)];
      try {
        const el = await s.pg.$('[data-mk="' + mk + '"]');
        if ((await el.evaluate((e) => e.tagName)) === "SELECT") {
          const n = await el.evaluate((e) => e.options.length);
          if (n) await el.selectOption({ index: sorteio(n) });
        } else await el.click({ timeout: 800, force: true });
        toques++;
      } catch (e) {}
      if (await s.pg.isVisible("#pwmodal"))
        await A.clica(s.pg, "#pwcancel", 50);
      await s.pg.waitForTimeout(25);
    }
    await A.inicio(s.pg).catch(() => {});
    const vivo = await s.pg.evaluate(
      () =>
        !!document.querySelector("#empty") && typeof renderHome === "function",
    );
    A.confere(
      (celular ? "Celular" : "Computador") +
        ": " +
        toques +
        " toques sem erro e app respondendo",
      vivo && s.erros.length === 0,
      s.erros.slice(0, 3).join(" | "),
    );
    await s.navegador.close();
  }
};
