/**
 * AXION · Painel inicial
 *
 * Tela inicial: cartão Visão geral, cartões do painel (faturamento, últimas notas, ações,
 * categorias) e números dos quadrados das ferramentas.
 *
 * Depende de: notas, financas, os
 */
"use strict";

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
  $("#hBar").style.width =
    Math.min(100, (ano / LIMITE_MEI) * 100).toFixed(1) + "%";
  $("#tbMes").textContent =
    "Faturado em " +
    now.toLocaleDateString("pt-BR", { month: "long" }) +
    " · " +
    brl(mes);
  renderDash();
  renderHubs();
}
/** Cartões do painel: faturamento, últimas notas, ação necessária e categorias. */
function renderDash() {
  if (!$("#dFluxo")) return;
  const now = new Date(),
    ano = now.getFullYear(),
    mk = mesKey(now);
  /* 1) faturamento mês a mês contra o limite mensal do MEI */
  const meses = Array(12).fill(0);
  let totalAno = 0;
  notes.forEach((n) => {
    if (!ativa(n)) return;
    const x = ndate(n);
    if (x && x.y === ano) {
      meses[x.m - 1] += vOf(n);
      totalAno += vOf(n);
    }
  });
  const meta = LIMITE_MEI / 12,
    topo = Math.max.apply(null, meses.concat([meta * 1.25])) * 1.05;
  const eixo = [1, 0.75, 0.5, 0.25, 0]
    .map((f) => "<span>" + (f ? brlCurto(topo * f) : "0") + "</span>")
    .join("");
  $("#dFluxo").innerHTML =
    '<div class="fl"><div class="fl-axis">' +
    eixo +
    '</div><div class="fl-bars">' +
    meses
      .map(
        (v, i) =>
          '<div class="fl-col' +
          (i === now.getMonth() ? " cur" : "") +
          '"><div class="fl-plot">' +
          '<div class="fl-trk" style="height:' +
          ((meta / topo) * 100).toFixed(1) +
          '%"></div>' +
          '<div class="fl-fil" title="' +
          brl(v) +
          '" style="height:' +
          (v > 0 ? Math.max(3, (v / topo) * 100).toFixed(1) : 0) +
          '%"></div>' +
          "</div><i>" +
          MESES_CURTOS[i] +
          "</i></div>",
      )
      .join("") +
    "</div></div>";
  $("#dFluxoSub").textContent =
    brl(totalAno) +
    " no ano · " +
    Math.round((totalAno / LIMITE_MEI) * 100) +
    "% do limite";
  /* 2) últimas notas */
  const ult = notes
    .slice()
    .sort((x, y) => String(y.nome).localeCompare(String(x.nome)))
    .slice(0, 5);
  $("#dUltimas").innerHTML = ult.length
    ? ult
        .map((n) => {
          const st =
            n.status === "cancelada"
              ? '<span class="badge off">🚫 Cancelada</span>'
              : n.status === "recebida"
                ? '<span class="badge ok">✅ Recebida</span>'
                : '<span class="badge wait">⏳ A receber</span>';
          return (
            '<button class="lrow" type="button" data-opennote="' +
            esc(n.id) +
            '"><span class="av">' +
            esc(inicial(n.d.t.nome)) +
            '</span><span class="lmain"><b>' +
            esc(n.d.t.nome) +
            "</b><small>NFS-e " +
            esc(n.nome) +
            '</small></span><span class="lval"><b>' +
            esc(n.d.v.op) +
            "</b>" +
            st +
            "</span></button>"
          );
        })
        .join("")
    : '<div class="small">Nenhuma nota ainda. Toque em “Lançar nota”.</div>';
  /* 3) ação necessária: cobranças, ordens concluídas sem pagamento e despesas a pagar */
  const receber = notes
    .filter((n) => ativa(n) && (n.status || "receber") === "receber")
    .map((n) => ({ n: n, dias: diasDesde(n) }))
    .sort((x, y) => y.dias - x.dias);
  const osPend = os.filter((o) => o.status === "concluida");
  const pagar = fin
    .filter(
      (x) =>
        x.tipo === "despesa" &&
        x.pago === false &&
        String(x.data).slice(0, 7) === mk,
    )
    .sort((x, y) => String(x.data).localeCompare(String(y.data)));
  const ac = [];
  receber.slice(0, 3).forEach((r) =>
    ac.push({
      at: 'data-dcobrar="' + esc(r.n.id) + '"',
      ic: "💬",
      t: "Cobrar " + r.n.d.t.nome,
      s: "NFS-e " + r.n.nome + " · há " + r.dias + " dia(s)",
      v: vOf(r.n),
      late: r.dias > 30,
    }),
  );
  osPend.slice(0, 2).forEach((o) =>
    ac.push({
      at: 'data-dos="' + esc(o.id) + '"',
      ic: "🛠",
      t: "Receber OS " + osNum(o),
      s: o.cliente,
      v: osTotals(o).total,
    }),
  );
  pagar.slice(0, 3).forEach((x) =>
    ac.push({
      at: 'data-dpagar="' + esc(x.ledger) + '"',
      ic: "💸",
      t: "Pagar " + x.nome,
      s: nomePerfil(x.ledger) + " · " + dataBR(x.data).slice(0, 5),
      v: x.valor,
    }),
  );
  const nPend = receber.length + osPend.length + pagar.length;
  $("#dAcaoN").textContent = nPend;
  $("#tbPend").textContent =
    "⏳ " + nPend + (nPend === 1 ? " pendência" : " pendências");
  $("#dAcao").innerHTML = ac.length
    ? ac
        .slice(0, 6)
        .map(
          (x) =>
            '<button class="lrow" type="button" ' +
            x.at +
            '><span class="av ico2">' +
            x.ic +
            '</span><span class="lmain"><b>' +
            esc(x.t) +
            "</b><small>" +
            esc(x.s) +
            '</small></span><span class="lval"><b' +
            (x.late ? ' class="late"' : "") +
            ">" +
            brl(x.v) +
            "</b></span></button>",
        )
        .join("")
    : '<div class="small">Tudo em dia ✅</div>';
  /* 4) principais categorias de despesa do mês (PJ + PF) */
  const mc = {};
  fin
    .filter((x) => x.tipo === "despesa" && String(x.data).slice(0, 7) === mk)
    .forEach((x) => {
      const k = x.cat || "Outros";
      mc[k] = (mc[k] || 0) + x.valor;
    });
  const cats = Object.keys(mc)
    .map((k) => ({ nome: k, v: mc[k] }))
    .sort((x, y) => y.v - x.v);
  if (!cats.length) {
    $("#dCateg").innerHTML =
      '<div class="small">Sem despesas neste mês. Lance em Finanças.</div>';
    return;
  }
  const cor = ["#2f6bff", "#6fa0ff", "#2e9e5b"],
    pos = [
      [100, 100],
      [222, 76],
      [208, 150],
    ],
    tot = cats.reduce((s, c) => s + c.v, 0);
  const bolhas = cats
    .slice(0, 3)
    .map((c, i) => {
      const r = Math.max(30, 70 * Math.sqrt(c.v / cats[0].v));
      return (
        '<circle cx="' +
        pos[i][0] +
        '" cy="' +
        pos[i][1] +
        '" r="' +
        r.toFixed(0) +
        '" fill="' +
        cor[i] +
        '" opacity="0.92"></circle><text x="' +
        pos[i][0] +
        '" y="' +
        (pos[i][1] - 2) +
        '" class="bt1">' +
        brlCurto(c.v) +
        '</text><text x="' +
        pos[i][0] +
        '" y="' +
        (pos[i][1] + 13) +
        '" class="bt2">' +
        esc(c.nome.slice(0, 13)) +
        "</text>"
      );
    })
    .join("");
  $("#dCateg").innerHTML =
    '<svg class="bubbles" viewBox="0 0 320 185" role="img" aria-label="Principais categorias">' +
    bolhas +
    "</svg>" +
    '<div class="stack">' +
    cats
      .slice(0, 3)
      .map(
        (c, i) =>
          '<i style="width:' +
          ((c.v / tot) * 100).toFixed(1) +
          "%;background:" +
          cor[i] +
          '"></i>',
      )
      .join("") +
    '</div><div class="legend">' +
    cats
      .slice(0, 3)
      .map(
        (c, i) =>
          '<span><i class="dot" style="background:' +
          cor[i] +
          '"></i> ' +
          esc(c.nome) +
          " · " +
          ((c.v / tot) * 100).toFixed(0) +
          "%</span>",
      )
      .join("") +
    "</div>";
}
/** Atualiza os números que aparecem nos quadrados das subferramentas. */
function renderHubs() {
  if (!$("#hubNotas")) return;
  const now = new Date(),
    mk = mesKey(now);
  let mesNf = 0;
  notes.forEach((n) => {
    const x = ndate(n);
    if (
      ativa(n) &&
      x &&
      x.y === now.getFullYear() &&
      x.m === now.getMonth() + 1
    )
      mesNf += vOf(n);
  });
  $("#hubNotas").textContent =
    notes.length + (notes.length === 1 ? " nota salva" : " notas salvas");
  $("#hubNfRel").textContent = "Faturado no mês · " + brl(mesNf);
  const abertas = os.filter((o) => (o.status || "aberta") === "aberta").length;
  const mesOs = os
    .filter((o) => String(o.data || "").slice(0, 7) === mk)
    .reduce((s, o) => s + osTotals(o).total, 0);
  $("#hubOsNova").textContent =
    "Próxima: Nº " + String(osProximo()).padStart(5, "0");
  $("#hubOsLista").textContent =
    os.length + " ordem(ns) · " + abertas + " aberta(s)";
  $("#hubCat").textContent =
    catalogo.dados.length + " serviço(s) cadastrado(s)";
  $("#hubOsRel").textContent = "No mês · " + brl(mesOs);
}
