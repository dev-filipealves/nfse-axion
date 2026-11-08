/**
 * AXION · Ordem de serviço · Cadastro de serviços
 *
 * Serviços salvos com preço (servicos.json): tela do cadastro, janela de edição e sugestões de
 * nome na OS.
 *
 * Depende de: os/banco.js
 */
"use strict";

const catalogo = criarBanco(SERVICOS_PATH, LS_SERVICOS, () => {
  renderCat();
  atualizarListaSvc();
  renderHubs();
});
/** Serviço do cadastro com esse nome (sem diferenciar maiúsculas). */
function acharServico(nome) {
  const n = String(nome || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  return n
    ? catalogo.dados.find((s) => s.nome.toLocaleLowerCase("pt-BR") === n)
    : null;
}
/** Preço do serviço em texto: "R$ 60,88/h" ou "R$ 50,00 fixo". */
const precoSvc = (s) =>
  s.modo === "hora" ? brl(s.valor) + "/h" : brl(s.valor) + " fixo";
/** Sugestões de nome na OS (lista do cadastro). */
function atualizarListaSvc() {
  const dl = $("#svc-list");
  if (dl)
    dl.innerHTML = catalogo.dados
      .map((s) => '<option value="' + esc(s.nome) + '"></option>')
      .join("");
}
/** Desenha a lista do cadastro de serviços. */
function renderCat() {
  const box = $("#cat_items");
  if (!box) return;
  const q = (($("#cat_q") && $("#cat_q").value) || "").toLowerCase().trim();
  const arr = catalogo.dados
    .filter((s) => !q || s.nome.toLowerCase().includes(q))
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  box.innerHTML = arr.length
    ? arr
        .map(
          (s) =>
            '<div class="item" data-svc="' +
            esc(s.id) +
            '"><div style="flex:1;min-width:0"><div class="nm">' +
            esc(s.nome) +
            '</div><div class="svc-sub">' +
            (s.modo === "hora" ? "Por hora · " : "Valor fixo · ") +
            precoSvc(s) +
            '</div></div><button class="badge" data-svcedit="' +
            esc(s.id) +
            '">✏️ Editar</button></div>',
        )
        .join("")
    : '<div class="small" style="margin-top:12px">' +
      (catalogo.dados.length
        ? "Nenhum serviço encontrado."
        : "Nenhum serviço cadastrado. Toque em “Novo serviço”.") +
      "</div>";
}
/** Abre a tela do cadastro de serviços. */
async function showCat() {
  if (!(await prepararOs())) return;
  hideAll();
  $("#catbox").hidden = false;
  renderCat();
  window.scrollTo({ top: 0 });
}
/** Janela para criar ou editar um serviço do cadastro. Devolve { acao, dados }. */
function abrirServico(s) {
  return new Promise((res) => {
    const m = $("#svcmodal");
    const lbl = () => {
      $("#sv_vlbl").textContent =
        $("#sv_modo").value === "hora" ? "Valor/hora (R$)" : "Valor (R$)";
    };
    $("#sv_title").textContent = s ? "✏️ Editar serviço" : "➕ Novo serviço";
    $("#sv_nome").value = s ? s.nome : "";
    $("#sv_modo").value = s ? s.modo : "hora";
    $("#sv_valor").value = s ? String(s.valor).replace(".", ",") : "";
    $("#sv_err").textContent = "";
    $("#sv_del").hidden = !s;
    lbl();
    $("#sv_modo").onchange = lbl;
    m.hidden = false;
    setTimeout(() => $("#sv_nome").focus(), 50);
    const fim = (r) => {
      m.hidden = true;
      $("#sv_save").onclick =
        $("#sv_del").onclick =
        $("#sv_cancel").onclick =
          null;
      res(r);
    };
    $("#sv_cancel").onclick = () => fim({ acao: "cancelar" });
    $("#sv_del").onclick = () => fim({ acao: "excluir" });
    $("#sv_save").onclick = () => {
      const nome = $("#sv_nome").value.replace(/\s+/g, " ").trim(),
        valor = parseValor($("#sv_valor").value);
      if (!nome || !(valor > 0)) {
        $("#sv_err").textContent = "Preencha o nome e um valor maior que zero.";
        return;
      }
      const outro = acharServico(nome);
      if (outro && (!s || outro.id !== s.id)) {
        $("#sv_err").textContent = "Já existe um serviço com esse nome.";
        return;
      }
      fim({
        acao: "salvar",
        dados: { nome: nome, modo: $("#sv_modo").value, valor: valor },
      });
    };
  });
}
/** Cria ou edita um serviço do cadastro. */
async function editarServico(id) {
  const s = id ? catalogo.dados.find((x) => x.id === id) : null;
  const r = await abrirServico(s);
  if (r.acao === "cancelar") return;
  if (r.acao === "excluir") {
    let ok = true;
    try {
      ok = confirm(
        'Excluir o serviço "' +
          s.nome +
          '" do cadastro? As ordens já salvas não mudam.',
      );
    } catch (e) {}
    if (ok)
      await catalogo.sync(
        (arr) => {
          const i = arr.findIndex((x) => x.id === id);
          if (i >= 0) arr.splice(i, 1);
        },
        "Serviço excluído",
        "OS: excluir serviço " + s.nome,
      );
    return;
  }
  await catalogo.sync(
    (arr) => {
      const x = s && arr.find((y) => y.id === s.id);
      if (x) Object.assign(x, r.dados);
      else
        arr.push(
          Object.assign({ id: novoId(), criadoEm: Date.now() }, r.dados),
        );
    },
    "Serviço " + r.dados.nome + " salvo",
    "OS: serviço " + r.dados.nome,
  );
}
$("#cat_new").addEventListener("click", () => editarServico(null));
$("#cat_q").addEventListener("input", renderCat);
$("#cat_items").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-svc]");
  if (b) editarServico(b.getAttribute("data-svc"));
});
