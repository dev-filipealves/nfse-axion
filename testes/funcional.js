/**
 * AXION · Testes · Funcional (OS e cobrança)
 *
 * Confere Pix (QR + copia e cola válidos), garantia (em garantia / fora da garantia),
 * placa, checklist de entrada e ordens antigas sem esses campos.
 *
 * Depende de: testes/apoio.js
 */
"use strict";

const A = require("./apoio");

/** CRC16-CCITT (independente do app) para validar o Pix gerado. */
function crc16(t) {
  let c = 0xffff;
  for (let i = 0; i < t.length; i++) {
    c ^= t.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++)
      c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}
/** Lê os campos (ID, tamanho, valor) de um texto EMV do Pix. */
function emv(t) {
  const r = {};
  for (let i = 0; i < t.length;) {
    const id = t.substr(i, 2),
      n = parseInt(t.substr(i + 2, 2), 10);
    r[id] = t.substr(i + 4, n);
    i += 4 + n;
  }
  return r;
}
/** Confere um "Pix copia e cola": CRC, chave e valor. */
function pixValido(p, valor) {
  const c = emv(p),
    conta = emv(c["26"] || "");
  return (
    p.slice(-4) === crc16(p.slice(0, -4)) &&
    conta["01"] === "66730393000105" &&
    c["54"] === valor.toFixed(2) &&
    c["53"] === "986"
  );
}

module.exports = async function (site) {
  A.grupo("Funcional: Pix, garantia, placa e checklist");
  const antiga = A.ordem(5, "Cliente Antigo", {
    status: "paga",
    data: A.diasAtras(200),
    garantia: undefined,
    checklist: undefined,
  });
  delete antiga.garantia;
  const vencida = A.ordem(6, "Cliente Vencido", {
    status: "concluida",
    data: A.diasAtras(120),
    concluidaEm: A.diasAtras(100),
  });
  const valendo = A.ordem(7, "Cliente Valendo", {
    status: "paga",
    data: A.diasAtras(20),
    concluidaEm: A.diasAtras(10),
  });
  const nf = A.nota(3, "Cliente Nota", 414, "receber");
  const { navegador, ctx, pg, erros } = await A.abrir(site, {
    dados: A.dadosLocais({
      os: [antiga, vencida, valendo],
      notas: [nf],
      perfis: A.PERFIS,
    }),
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);

  // Lista: etiquetas de garantia
  await A.vai(pg, "oslist");
  const etq = (id) =>
    pg.$eval('[data-osopen="' + id + '"]', (e) => e.innerText);
  confere2(
    "OS antiga (sem campo garantia) não inventa garantia",
    !/garantia/i.test(await etq("os5")),
  );
  confere2(
    "OS concluída há 100 dias com 90 dias aparece FORA da garantia",
    /Fora da garantia desde/.test(await etq("os6")),
  );
  confere2(
    "OS concluída há 10 dias aparece EM garantia (80 dias)",
    /Em garantia até .*\(80 dias\)/.test(await etq("os7")),
  );
  confere2("Placa aparece na lista", /TST1007/.test(await etq("os7")));
  await pg.fill("#os_q", "tst1006");
  await pg.waitForTimeout(150);
  confere2(
    "Busca pela placa acha a OS",
    (await pg.$$("[data-osopen]")).length === 1,
  );
  await pg.fill("#os_q", "");

  // Nova OS pelo editor
  await A.clica(pg, "#os_new");
  confere2(
    "OS nova começa com garantia de 90 dias",
    (await pg.inputValue("#os_gar")) === "90",
  );
  await pg.fill("#os_cliente", "Cliente Novo");
  await pg.fill("#os_veic", "Motorhome Teste");
  await pg.fill("#os_placa", "abc1d23");
  await pg.selectOption("#os_gar", "30");
  await pg.$eval("#os_ck", (d) => (d.open = true));
  const cks = await pg.$$("#os_ckitens select");
  confere2(
    "Checklist mostra os itens do config.js",
    cks.length >= 10,
    cks.length + " itens",
  );
  await cks[0].selectOption("ok");
  await cks[1].selectOption("defeito");
  await pg.fill("#os_ckobs", "Risco na porta");
  await A.clica(pg, "#os_addp");
  const ultP = "#os_prods > *:last-child";
  const campos = await pg.$$(ultP + " input");
  await campos[0].fill("Fusível");
  await campos[campos.length - 1].fill("100");
  await pg.dispatchEvent(ultP + " input", "input");
  await A.clica(pg, "#os_save", 500);
  const salva = await pg.evaluate(() =>
    os.find((o) => o.cliente === "Cliente Novo"),
  );
  confere2(
    "Placa salva em maiúsculas",
    salva && salva.placa === "ABC1D23",
    salva && salva.placa,
  );
  confere2("Garantia escolhida foi salva", salva && salva.garantia === 30);
  confere2(
    "Checklist salvo (OK, defeito e observação)",
    salva &&
      salva.checklist.itens.Bateria === "ok" &&
      Object.values(salva.checklist.itens).includes("defeito") &&
      salva.checklist.obs === "Risco na porta",
  );
  confere2(
    "OS aberta ainda não tem data de conclusão",
    salva && !salva.concluidaEm,
  );

  // Documento da OS
  await A.vai(pg, "oslist");
  await A.clica(pg, '[data-osopen="' + salva.id + '"]', 400);
  const doc = await pg.innerText("#ospaper");
  confere2(
    "Documento mostra PLACA e GARANTIA",
    /PLACA\s+ABC1D23/.test(doc) && /GARANTIA\s+30 dias/.test(doc),
  );
  confere2(
    "Documento mostra o checklist de entrada",
    /CHECKLIST DE ENTRADA/.test(doc) &&
      /com defeito/.test(doc) &&
      /Risco na porta/.test(doc),
  );
  const total = await pg.evaluate(
    (id) => osTotals(os.find((o) => o.id === id)).total,
    salva.id,
  );
  const pixDoc = await pg
    .$eval(".osp-pix code", (e) => e.textContent)
    .catch(() => "");
  confere2(
    "Documento tem QR Pix e copia e cola válido (CRC, chave CNPJ, valor)",
    pixDoc && pixValido(pixDoc, total) && (await pg.$(".osp-pix svg")),
    "R$ " + total,
  );
  await A.clica(pg, "#os_pix", 300);
  const copiado = await pg
    .evaluate(() => navigator.clipboard.readText())
    .catch(() => "");
  confere2("Botão Copiar Pix copia o mesmo código", copiado === pixDoc);

  // Situação: concluída inicia a garantia; paga some o Pix; aberta limpa
  await A.vai(pg, "oslist");
  await A.clica(pg, '[data-osst="' + salva.id + '"]', 400);
  let o = await pg.evaluate((id) => os.find((x) => x.id === id), salva.id);
  confere2(
    "Ao concluir, a garantia começa hoje",
    o.status === "concluida" && o.concluidaEm === A.ISO(new Date()),
  );
  confere2(
    "Lista mostra 'Em garantia até' após concluir",
    /Em garantia até/.test(await etq(salva.id)),
  );
  await A.clica(pg, '[data-osst="' + salva.id + '"]', 400);
  await A.clica(pg, '[data-osopen="' + salva.id + '"]', 400);
  confere2("OS paga não mostra Pix", !(await pg.$(".osp-pix")));
  await A.vai(pg, "oslist");
  await A.clica(pg, '[data-osst="' + salva.id + '"]', 400);
  o = await pg.evaluate((id) => os.find((x) => x.id === id), salva.id);
  confere2(
    "Voltando para aberta, a data de conclusão é limpa",
    o.status === "aberta" && !o.concluidaEm,
  );

  // OS antiga abre sem erro
  await A.clica(pg, '[data-osopen="os5"]', 400);
  confere2(
    "OS antiga abre (Sem garantia, sem checklist)",
    /GARANTIA\s+Sem garantia/.test(await pg.innerText("#ospaper")) &&
      !/CHECKLIST/.test(await pg.innerText("#ospaper")),
  );

  // Cobrança da nota com Pix
  await A.vai(pg, "notas");
  const cob = await pg.$("[data-cobrar]");
  if (cob) {
    await cob.click();
    await pg.waitForTimeout(300);
    const msg = await pg.inputValue("#txin");
    const pix = (
      msg.split("\n").find((l) => l.startsWith("000201")) || ""
    ).trim();
    confere2(
      "Cobrança traz chave CNPJ e Pix copia e cola com o valor da nota",
      /CNPJ 66\.730\.393\/0001-05/.test(msg) && pixValido(pix, 414),
    );
    await A.clica(pg, '#txbtns [data-a="pix"]', 300);
    confere2(
      "Botão 'Copiar só o Pix' na cobrança",
      (await pg.evaluate(() => navigator.clipboard.readText())) === pix,
    );
  } else confere2("Botão de cobrança encontrado", false);

  confere2("Nenhum erro de JavaScript", erros.length === 0, erros.join(" | "));
  await navegador.close();

  function confere2(n, ok, d) {
    A.confere(n, ok, d);
  }
};
