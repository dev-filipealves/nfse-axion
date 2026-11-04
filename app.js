/**
 * AXION | Sistemas Embarcados e Energia
 * Gerador de NFS-e personalizada.
 *
 * O que este arquivo faz:
 *  - lê o PDF do DANFSe e monta a nota com a identidade AXION;
 *  - salva as notas (neste aparelho ou em um repositório privado do GitHub);
 *  - controla recebimentos, relatórios e o limite anual do MEI;
 *  - protege o token do GitHub com senha (AES-256-GCM + PBKDF2).
 */
"use strict";

window.addEventListener("error", function (e) {
  var m = document.getElementById("msg");
  if (m) {
    m.textContent = "Erro: " + (e.message || "desconhecido");
    m.className = "err";
  }
});
(function () {
  const LOGO = window.AXION_LOGO;
  document.getElementById("logoEmpty").src = LOGO;
  const FANTASIA = "AXION | SISTEMAS EMBARCADOS E ENERGIA";
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "-").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  let current = null,
    downloads = null;

  /** Mostra uma mensagem de status (ou erro) abaixo dos botões. */
  function say(t, err) {
    const m = $("#msg");
    m.textContent = t || "";
    m.className = err ? "err" : "";
  }

  try {
    if (window.claude && claude.use) {
      claude
        .use("downloads")
        .then((d) => {
          downloads = d;
          if (!d) $("#dl").title = "Download indisponível nesta visualização";
