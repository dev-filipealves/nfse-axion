/**
 * AXION · Testes · Desempenho
 *
 * Tempo de abertura, tamanho baixado e velocidade das telas com muitos dados (1000 notas,
 * 500 OS, 2000 lançamentos, 300 serviços) num celular simulado 4× mais lento, além de
 * travadas (tarefas longas) durante a rolagem.
 *
 * Depende de: testes/apoio.js
 */
"use strict";

const A = require("./apoio");

/** Mede (ms) o tempo de uma ação na página até a tela ser desenhada. */
function cronometra(pg, acao) {
  return pg.evaluate(
    (src) =>
      new Promise((ok) => {
        const t0 = performance.now();
        new Function(src)();
        requestAnimationFrame(() =>
          setTimeout(() => ok(performance.now() - t0), 0),
        );
      }),
    acao,
  );
}

module.exports = async function (site) {
  A.grupo("Desempenho: abertura do site");
  {
    site.bytes.total = 0;
    const s = await A.abrir(site, { celular: true, cpu: 4 });
    const nav = await s.pg.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return { dom: n.domContentLoadedEventEnd, load: n.loadEventEnd };
    });
    A.mede("Pronto para usar (celular 4× mais lento)", nav.dom, 2000);
    A.mede("Carregamento completo (celular 4× mais lento)", nav.load, 3000);
    const kb = site.bytes.total / 1024;
    A.confere(
      "Tamanho dos arquivos do site (sem as bibliotecas do CDN)",
      kb < 450,
      kb.toFixed(0) + " KB",
    );
    await s.navegador.close();
  }

  A.grupo("Desempenho: muitos dados (celular 4× mais lento)");
  const dados = A.dadosLocais({
    notas: Array.from({ length: 1000 }, (_, i) =>
      A.nota(
        i + 1,
        "Cliente " + (i % 150),
        100 + (i % 900),
        i % 3 ? "recebida" : "receber",
        A.diasAtras(i % 365),
      ),
    ),
    os: Array.from({ length: 500 }, (_, i) =>
      A.ordem(i + 1, "Cliente " + (i % 150), {
        status: ["aberta", "concluida", "paga"][i % 3],
        data: A.diasAtras(i % 365),
        concluidaEm: A.diasAtras(i % 365),
      }),
    ),
    fin: Array.from({ length: 2000 }, (_, i) => A.lancamento(i)),
    perfis: A.PERFIS,
    servicos: Array.from({ length: 300 }, (_, i) => ({
      id: "s" + i,
      nome: "Serviço " + i,
      modo: i % 2 ? "hora" : "fixo",
      valor: 50 + i,
    })),
  });
  const s = await A.abrir(site, { celular: true, cpu: 4, dados });
  const { pg } = s;
  const nav = await pg.evaluate(
    () =>
      performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd,
  );
  A.mede("Abertura com todos os dados", nav, 2500);
  const abre = async (nome, caminho, ultimo, limite) => {
    await A.vai(pg, caminho); // 1ª vez: aquece
    await A.inicio(pg);
    for (const sel of A.TELAS[caminho].slice(0, -1)) await A.clica(pg, sel);
    const ms = await cronometra(
      pg,
      "document.querySelector(" +
        JSON.stringify(ultimo || A.TELAS[caminho].slice(-1)[0]) +
        ").click()",
    );
    A.mede(nome, ms, limite);
  };
  await A.inicio(pg);
  A.mede(
    "Tela inicial (painel) com 1000 notas e 2000 lançamentos",
    await cronometra(pg, "renderHome()"),
    400,
  );
  await abre("Minhas notas (1000)", "notas", null, 1200);
  A.mede(
    "Busca nas notas (digitar)",
    await cronometra(
      pg,
      "const q=document.querySelector('#q');q.value='cliente 12';q.dispatchEvent(new Event('input'))",
    ),
    300,
  );
  await abre("Relatório de notas", "relNotas", null, 800);
  A.mede(
    "Relatório de notas: trocar para o ano",
    await cronometra(
      pg,
      "const r=document.querySelector('#r_per');r.value='ano';r.dispatchEvent(new Event('change'))",
    ),
    600,
  );
  await abre("Minhas OS (500)", "oslist", null, 800);
  A.mede(
    "Busca nas OS (digitar)",
    await cronometra(
      pg,
      "const q=document.querySelector('#os_q');q.value='tst10';q.dispatchEvent(new Event('input'))",
    ),
    300,
  );
  await pg.fill("#os_q", "");
  await pg.dispatchEvent("#os_q", "input");
  A.mede(
    "Abrir uma OS (documento com QR Pix)",
    await cronometra(pg, "document.querySelector('[data-osopen]').click()"),
    400,
  );
  await abre("Relatório de OS", "osrel", null, 600);
  await abre("Cadastro de serviços (300)", "cadastro", null, 500);
  await abre("Meus perfis (2000 lançamentos)", "perfis", null, 500);
  A.mede(
    "Abrir o perfil (mês com lançamentos)",
    await cronometra(pg, "document.querySelector('.pcard .pc-name').click()"),
    500,
  );

  A.grupo("Desempenho: rolagem no celular");
  await A.vai(pg, "notas");
  await pg.evaluate(() => {
    window.__longas = [];
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => window.__longas.push(e.duration)),
    ).observe({ type: "longtask", buffered: false });
  });
  for (let i = 0; i < 40; i++) {
    await pg.mouse.wheel(0, 600);
    await pg.waitForTimeout(30);
  }
  await pg.waitForTimeout(300);
  const longas = await pg.evaluate(() => window.__longas);
  const maior = longas.length ? Math.max(...longas) : 0;
  A.confere(
    "Rolagem da lista de 1000 notas sem travadas longas",
    maior < 200,
    longas.length + " tarefas longas, maior " + maior.toFixed(0) + " ms",
  );
  A.confere(
    "Sem erros de JavaScript",
    s.erros.length === 0,
    s.erros.join(" | "),
  );
  await s.navegador.close();
};
