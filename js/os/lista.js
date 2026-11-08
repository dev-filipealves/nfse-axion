/**
 * AXION · Ordem de serviço · Minhas OS
 *
 * Lista de ordens com busca, resumo por situação e ações (situação, editar, excluir).
 *
 * Depende de: os/banco.js
 */
"use strict";

/** Desenha a lista de ordens de serviço, com busca e resumo. */
function renderOsList() {
  const box = $("#os_items");
  if (!box) return;
  const q = (($("#os_q") && $("#os_q").value) || "").toLowerCase().trim();
  const arr = os
    .filter(
      (o) =>
        !q ||
        (
          osNum(o) +
          " " +
          o.cliente +
          " " +
          (o.veiculo || "") +
          " " +
          (o.placa || "")
        )
          .toLowerCase()
          .includes(q),
    )
    .sort(
      (x, y) => (parseInt(y.numero, 10) || 0) - (parseInt(x.numero, 10) || 0),
    );
  const soma = (st) =>
    os
      .filter((o) => o.status === st)
      .reduce((a, o) => a + osTotals(o).total, 0);
  $("#os_sum").innerHTML =
    '<div class="fcards"><div class="fcard"><span>🛠 Abertas</span><b>' +
    brl(soma("aberta")) +
    "</b></div>" +
    '<div class="fcard"><span>✔️ A receber</span><b>' +
    brl(soma("concluida")) +
    "</b></div>" +
    '<div class="fcard pos"><span>✅ Pagas</span><b>' +
    brl(soma("paga")) +
    "</b></div></div>";
  box.innerHTML = arr.length
    ? arr
        .map((o) => {
          const T = osTotals(o),
            id = esc(o.id);
          const cls =
            o.status === "paga"
              ? "ok"
              : o.status === "concluida"
                ? "info"
                : "wait";
          return (
            '<div class="item" data-osopen="' +
            id +
            '"><div style="flex:1;min-width:0"><div class="nm">OS ' +
            osNum(o) +
            " · " +
            esc(o.cliente) +
            '</div><div class="sb">' +
            esc(
              [o.veiculo, dataBR(o.data), brl(T.total)]
                .filter(Boolean)
                .join(" · "),
            ) +
            "</div>" +
            '<div class="acts"><button class="badge ' +
            cls +
            '" data-osst="' +
            id +
            '">' +
            OS_STATUS_TXT[o.status || "aberta"] +
            "</button>" +
            '<button class="badge" data-osedit="' +
            id +
            '">✏️ Editar</button></div></div>' +
            '<button class="x" data-osdel="' +
            id +
            '" aria-label="Excluir ordem">🗑</button></div>'
          );
        })
        .join("")
    : '<div class="small" style="margin-top:12px">Nenhuma ordem ainda. Toque em “Nova OS”.</div>';
}
/** Abre a lista de ordens (pede a senha e sincroniza, se preciso). */
async function showOs() {
  if (isProt() && !(await ensureUnlocked())) {
    say("🔒 Senha necessária para abrir as ordens de serviço.", true);
    return;
  }
  hideAll();
  $("#oslist").hidden = false;
  renderOsList();
  window.scrollTo({ top: 0 });
  const c = cfg();
  if (c.repo && c.token) {
    setSync("Sincronizando…");
    try {
      await osLoad();
      persistOs();
      await catalogo.load();
      catalogo.persist();
      atualizarListaSvc();
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
    renderOsList();
    renderHome();
  } else
    setSync(
      "💾 Dados guardados só neste aparelho. Toque em ⚙️ para guardar no GitHub.",
    );
}
$("#os_new").addEventListener("click", () => osEditor(null));
$("#os_q").addEventListener("input", renderOsList);
$("#os_items").addEventListener("click", async (ev) => {
  const st = ev.target.closest("[data-osst]");
  if (st) {
    ev.stopPropagation();
    const id = st.getAttribute("data-osst"),
      ordem = ["aberta", "concluida", "paga"];
    await osSync(
      (arr) => {
        const x = arr.find((y) => y.id === id);
        if (x) x.status = ordem[(ordem.indexOf(x.status || "aberta") + 1) % 3];
      },
      "Situação atualizada",
      "OS situação " + id,
    );
    return;
  }
  const ed = ev.target.closest("[data-osedit]");
  if (ed) {
    ev.stopPropagation();
    const o = os.find((x) => x.id === ed.getAttribute("data-osedit"));
    if (o) osEditor(o);
    return;
  }
  const dl = ev.target.closest("[data-osdel]");
  if (dl) {
    ev.stopPropagation();
    const id = dl.getAttribute("data-osdel"),
      o = os.find((x) => x.id === id);
    let ok = true;
    try {
      ok = confirm("Excluir a OS " + (o ? osNum(o) : "") + "?");
    } catch (e) {}
    if (ok)
      await osSync(
        (arr) => {
          const i = arr.findIndex((y) => y.id === id);
          if (i >= 0) arr.splice(i, 1);
        },
        "Ordem excluída",
        "Excluir OS " + id,
      );
    return;
  }
  const op = ev.target.closest("[data-osopen]");
  if (op) osMostrar(op.getAttribute("data-osopen"));
});
