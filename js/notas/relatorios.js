/**
 * AXION · Notas · Relatórios
 *
 * Relatório por período: resumo, gráfico mês a mês com projeção do ano, clientes, exportação
 * em CSV e PDF.
 *
 * Depende de: notas/lista.js
 */
"use strict";

/** Define o período escolhido no relatório (y = ano de referência do gráfico). */
function repRange(sel) {
  const v = sel || $("#r_per").value,
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
    '<div class="rcols"><div class="rcol"><div class="sect">Resumo · ' +
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
    '</div><div class="rcol"><div class="sect">Por cliente</div>' +
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
      .join("") || '<div class="small">Nenhuma.</div>') +
    "</div></div>";
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
