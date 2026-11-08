/**
 * AXION · Ordem de serviço · Relatórios
 *
 * Relatório de ordens por período: totais, situação, clientes, CSV e PDF.
 *
 * Depende de: os/banco.js
 */
"use strict";

/** Ordens do período escolhido, com totais por situação e por cliente. */
function osRepData() {
  const R = repRange($("#or_per").value);
  const lista = os
    .filter((o) => {
      const p = String(o.data || "").split("-");
      return p.length === 3 && R.f({ y: +p[0], m: +p[1], d: +p[2] });
    })
    .sort(
      (x, y) => (parseInt(x.numero, 10) || 0) - (parseInt(y.numero, 10) || 0),
    );
  const T = { total: 0, prod: 0, serv: 0, horas: 0, desc: 0 },
    st = { aberta: 0, concluida: 0, paga: 0 },
    cl = {};
  lista.forEach((o) => {
    const t = osTotals(o);
    T.total += t.total;
    T.prod += t.prod;
    T.serv += t.serv;
    T.horas += t.horas;
    T.desc += t.desc;
    st[o.status || "aberta"] += t.total;
    const k = o.cliente || "-";
    const c = (cl[k] = cl[k] || { nome: k, q: 0, v: 0 });
    c.q++;
    c.v += t.total;
  });
  return {
    R: R,
    lista: lista,
    T: T,
    st: st,
    cli: Object.values(cl).sort((x, y) => y.v - x.v),
  };
}
/** Desenha o relatório de ordens de serviço. */
function renderOsRep() {
  const D = osRepData(),
    pc = (v) => (D.T.total ? ((v / D.T.total) * 100).toFixed(0) + "%" : "0%");
  $("#or_out").innerHTML =
    '<div class="rcols"><div class="rcol"><div class="sect">Resumo · ' +
    esc(D.R.t) +
    "</div>" +
    '<div class="row"><span>Ordens no período</span><b>' +
    D.lista.length +
    "</b></div>" +
    '<div class="row"><span>Peças / produtos</span><b>' +
    brl(D.T.prod) +
    "</b></div>" +
    '<div class="row"><span>Mão de obra' +
    (D.T.horas ? " · " + fmtHoras(D.T.horas) : "") +
    "</span><b>" +
    brl(D.T.serv) +
    "</b></div>" +
    (D.T.desc
      ? '<div class="row"><span>Descontos</span><b>− ' +
        brl(D.T.desc) +
        "</b></div>"
      : "") +
    '<div class="row total"><span>TOTAL</span><b>' +
    brl(D.T.total) +
    "</b></div>" +
    '<div class="fcards"><div class="fcard"><span>🛠 Abertas</span><b>' +
    brl(D.st.aberta) +
    "</b></div>" +
    '<div class="fcard"><span>✔️ A receber</span><b>' +
    brl(D.st.concluida) +
    "</b></div>" +
    '<div class="fcard pos"><span>✅ Pagas</span><b>' +
    brl(D.st.paga) +
    "</b></div></div>" +
    '</div><div class="rcol"><div class="sect">Por cliente</div>' +
    (D.cli
      .map(
        (c) =>
          '<div class="row"><span>' +
          esc(c.nome) +
          '<br><span class="small">' +
          c.q +
          " ordem(ns) · " +
          pc(c.v) +
          "</span></span><b>" +
          brl(c.v) +
          "</b></div>",
      )
      .join("") || '<div class="small">Sem ordens no período.</div>') +
    '<div class="sect">Ordens do período</div>' +
    (D.lista
      .map(
        (o) =>
          '<div class="row"><span>OS ' +
          osNum(o) +
          " · " +
          esc(o.cliente) +
          '<br><span class="small">' +
          dataBR(o.data) +
          " · " +
          OS_SIT[o.status || "aberta"] +
          "</span></span><b>" +
          brl(osTotals(o).total) +
          "</b></div>",
      )
      .join("") || '<div class="small">Nenhuma.</div>') +
    "</div></div>";
}
/** Abre os relatórios de ordens de serviço. */
async function showOsRep() {
  if (!(await prepararOs())) return;
  hideAll();
  $("#osrep").hidden = false;
  renderOsRep();
  window.scrollTo({ top: 0 });
}
$("#or_per").addEventListener("change", renderOsRep);
$("#or_csv").addEventListener("click", async () => {
  const D = osRepData();
  const rows = [
    [
      "OS",
      "Data",
      "Cliente",
      "Veículo",
      "Situação",
      "Peças",
      "Mão de obra",
      "Horas",
      "Desconto",
      "Total",
    ],
  ].concat(
    D.lista.map((o) => {
      const t = osTotals(o),
        n = (v) => v.toFixed(2).replace(".", ",");
      return [
        osNum(o),
        dataBR(o.data),
        o.cliente,
        o.veiculo || "",
        OS_SIT[o.status || "aberta"],
        n(t.prod),
        n(t.serv),
        t.horas ? fmtHoras(t.horas) : "",
        n(t.desc),
        n(t.total),
      ];
    }),
  );
  try {
    await saveBlob(
      new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
      "relatorio-os-" + D.R.s + ".csv",
    );
    say("CSV gerado.");
  } catch (e) {
    say("Erro ao gerar o CSV: " + ((e && e.message) || e), true);
  }
});
$("#or_pdf").addEventListener("click", async () => {
  try {
    const D = osRepData(),
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
      "Relatório de ordens de serviço · " +
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
      doc.text(String(a).slice(0, 60), 14, y);
      if (c) doc.text(String(c), 140, y);
      doc.text(String(b), 196, y, { align: "right" });
      y += 5.5;
    };
    head("Resumo");
    row("Ordens no período", String(D.lista.length));
    row("Peças / produtos", brl(D.T.prod));
    row(
      "Mão de obra" + (D.T.horas ? " (" + fmtHoras(D.T.horas) + ")" : ""),
      brl(D.T.serv),
    );
    if (D.T.desc) row("Descontos", "- " + brl(D.T.desc));
    row("Total", brl(D.T.total));
    row(
      "Abertas / A receber / Pagas",
      brl(D.st.aberta) + " / " + brl(D.st.concluida) + " / " + brl(D.st.paga),
    );
    head("Por cliente");
    D.cli.forEach((c) => row(c.nome + " (" + c.q + ")", brl(c.v)));
    head("Ordens do período");
    D.lista.forEach((o) =>
      row(
        "OS " + osNum(o) + " · " + o.cliente,
        brl(osTotals(o).total),
        dataBR(o.data) + " · " + OS_SIT[o.status || "aberta"],
      ),
    );
    await saveBlob(doc.output("blob"), "relatorio-os-" + D.R.s + ".pdf");
    say("PDF do relatório gerado.");
  } catch (e) {
    say("Erro ao gerar o PDF: " + ((e && e.message) || e), true);
  }
});
