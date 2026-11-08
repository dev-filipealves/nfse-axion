/**
 * AXION · Interface comum
 *
 * Peças de tela usadas por todas as ferramentas: atalho $, mensagens de status, janela de
 * opções (askText), download de arquivos e abertura de links.
 *
 * Depende de: base/utils.js
 */
"use strict";

const $ = (s) => document.querySelector(s);
/** Recurso de download do app Claude (quando a página roda dentro dele). */
let downloads = null;
/** Mostra uma mensagem de status (ou erro) abaixo dos botões. */
function say(t, err) {
  const m = $("#msg");
  m.textContent = t || "";
  m.className = err ? "err" : "";
}
/** Baixa um arquivo (recurso do app Claude ou download comum do navegador). */
async function saveBlob(blob, filename) {
  if (downloads) {
    await downloads.save({ filename: filename, data: blob });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
/** Janela de texto: mostra um campo editável e botões; devolve { acao, texto }. */
function askText(o) {
  return new Promise((res) => {
    const m = $("#txmodal"),
      t = $("#txin"),
      b = $("#txbtns");
    $("#txtitle").textContent = o.titulo || "";
    t.value = o.texto || "";
    t.placeholder = o.placeholder || "";
    t.hidden = !!o.semTexto; // menu de botões, sem campo de texto
    b.innerHTML = (o.botoes || [])
      .map(
        (x) =>
          '<button class="btn' +
          (x.sec ? " sec" : "") +
          '" data-a="' +
          x.id +
          '" style="width:100%">' +
          x.rotulo +
          "</button>",
      )
      .join("");
    m.hidden = false;
    setTimeout(() => t.focus(), 50);
    b.onclick = (ev) => {
      const bt = ev.target.closest("[data-a]");
      if (!bt) return;
      m.hidden = true;
      b.onclick = null;
      res({ acao: bt.getAttribute("data-a"), texto: t.value });
    };
  });
}
/** Abre um link (WhatsApp, e-mail) em outra aba. */
function abrir(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
