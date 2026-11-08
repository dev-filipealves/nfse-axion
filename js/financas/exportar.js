/**
 * AXION · Finanças · Exportar
 *
 * Resumo do mês para WhatsApp, tabela CSV e PDF.
 *
 * Depende de: financas/tela.js
 */
"use strict";

/** Texto do resumo do mês para enviar no WhatsApp. */
function resumoTexto() {
  const T = totaisFin(itensDoMes());
  const L = (x) =>
    (x.pago === false ? "❌ " : "✅ ") +
    x.nome +
    ": " +
    brl(x.valor) +
    (x.pago === false
      ? x.tipo === "entrada"
        ? " (a receber)"
        : " (a pagar)"
      : "");
  const linhas = [
    "📊 CONTROLE FINANCEIRO · " + nomePerfil(finLedger),
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
    titulo: "📤 Resumo · " + nomePerfil(finLedger) + " · " + nomeMes(finMes),
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
      say("Não consegui copiar. Toque no texto, selecione tudo e copie.", true);
    }
  }
}
/** Situação do item em texto. */
function situacao(x) {
  if (x.tipo === "entrada") return x.pago === false ? "A receber" : "Recebido";
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
      "financeiro-" + slugPerfil(finLedger) + "-" + finMes + ".csv",
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
        nomePerfil(finLedger) +
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
    // Linha de um lançamento: nome, data, situação (PAGO / A PAGAR) e valor
    const rowItem = (x) => {
      nl(6);
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(String(x.nome).slice(0, 48), 14, y);
      doc.text(dataBR(x.data), 112, y);
      const ok = x.pago !== false;
      if (ok) doc.setTextColor(46, 158, 91);
      else doc.setTextColor(210, 59, 59);
      doc.setFont("helvetica", "bold");
      doc.text(
        x.tipo === "entrada"
          ? ok
            ? "RECEBIDO"
            : "A RECEBER"
          : ok
            ? "PAGO"
            : "A PAGAR",
        140,
        y,
      );
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(brl(x.valor), 196, y, { align: "right" });
      y += 5.5;
    };
    head("Resumo");
    row("Total de entradas", brl(T.e));
    row("Total de despesas", brl(T.d));
    row("Saldo do mês", brl(T.saldo));
    if (T.aReceber > 0) row("A receber", brl(T.aReceber));
    if (T.aPagar > 0) row("A pagar", brl(T.aPagar));
    head("Entradas");
    T.ent.forEach(rowItem);
    head("Despesas");
    T.des.forEach(rowItem);
    head("Despesas por categoria");
    porCategoria(T.des).forEach((c) =>
      row(c.nome, brl(c.v), T.d ? ((c.v / T.d) * 100).toFixed(0) + "%" : ""),
    );
    await saveBlob(
      doc.output("blob"),
      "financeiro-" + slugPerfil(finLedger) + "-" + finMes + ".pdf",
    );
    say("PDF gerado.");
  } catch (e) {
    say("Erro ao gerar o PDF: " + ((e && e.message) || e), true);
  }
}
$("#f_wpp").addEventListener("click", enviarResumo);
$("#f_pdf").addEventListener("click", finPdf);
$("#f_csv").addEventListener("click", finCsv);
