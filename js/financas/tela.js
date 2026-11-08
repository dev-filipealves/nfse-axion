/**
 * AXION · Finanças · Tela do perfil
 *
 * Tela de um perfil: mês, totais, entradas e despesas, criar/editar/excluir, recorrentes e
 * dízimo.
 *
 * Depende de: financas/perfis.js
 */
"use strict";

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
  $("#f_title").textContent = "💰 " + nomePerfil(finLedger);
  $("#f_tabs").innerHTML = perfis.dados
    .map(
      (p) =>
        '<button class="chip' +
        (p.id === finLedger ? " on" : "") +
        '" data-l="' +
        esc(p.id) +
        '">👤 ' +
        esc(p.nome) +
        "</button>",
    )
    .join("");
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
      ? '<div class="small">⏳ A receber: <b>' + brl(T.aReceber) + "</b></div>"
      : "") +
    (T.aPagar > 0
      ? '<div class="small">⏳ A pagar: <b>' + brl(T.aPagar) + "</b></div>"
      : "");
  const cats = porCategoria(T.des);
  $("#f_lists").innerHTML =
    '<div class="fcols"><div class="fcol"><div class="sect">💰 Entradas (' +
    T.ent.length +
    ")</div>" +
    (T.ent.map(finRow).join("") ||
      '<div class="small">Nenhuma entrada neste mês.</div>') +
    '</div><div class="fcol"><div class="sect">💸 Despesas (' +
    T.des.length +
    ")</div>" +
    (T.des.map(finRow).join("") ||
      '<div class="small">Nenhuma despesa neste mês.</div>') +
    '</div><div class="fcol">' +
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
      : "") +
    "</div></div>";
}
/** Janela para criar ou editar um item; devolve { acao, dados }. */
function openItem(tipo, item) {
  return new Promise((res) => {
    const m = $("#fmodal"),
      edit = !!item;
    $("#ftitle").textContent =
      (edit ? "✏️ Editar " : "Nova ") +
      (tipo === "entrada" ? "entrada" : "despesa") +
      " · " +
      finLedger;
    const cats = tipo === "entrada" ? CATS_ENTRADA : CATS_DESPESA;
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
    "Financeiro " + nomePerfil(finLedger) + ": " + rec.nome,
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
        x.ledger === finLedger && x.rec && String(x.data).slice(0, 7) === prev,
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
    "Dízimo calculado em " + nomePerfil(ledger) + " (" + brl(valor) + ")",
    "Dízimo " + ledger + " " + finMes,
  );
}
/** Finanças: sem id abre "Meus perfis"; com id abre o perfil (pede a senha e sincroniza, se preciso). */
async function showFin(id) {
  if (isProt() && !(await ensureUnlocked())) {
    say("🔒 Senha necessária para abrir as finanças.", true);
    return;
  }
  if (typeof id === "string" && id) {
    if (!perfis.dados.length) await prepararFinancas();
    finLedger = id;
    hideAll();
    $("#finbox").hidden = false;
    renderFin();
    window.scrollTo({ top: 0 });
    return;
  }
  hideAll();
  $("#finperfis").hidden = false;
  renderPerfis();
  window.scrollTo({ top: 0 });
  const c = cfg();
  if (c.repo && c.token) {
    setSync("Sincronizando…");
    try {
      await ghLoad();
      persist();
      await finLoad();
      persistFin();
      await perfis.load();
      perfis.persist();
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
  } else
    setSync(
      "💾 Dados guardados só neste aparelho. Toque em ⚙️ para guardar no GitHub.",
    );
  await prepararPerfis();
  renderPerfis();
}
$("#finbtn").addEventListener("click", () => showFin());
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
