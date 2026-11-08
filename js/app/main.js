/**
 * AXION · Inicialização
 *
 * Último arquivo carregado: prepara a tela inicial, carrega os dados do GitHub e confere as
 * bibliotecas externas.
 *
 * Depende de: todos
 */
"use strict";

document.getElementById("logoEmpty").src = LOGO;
document.getElementById("logoTop").src = LOGO;
/** Carrega notas, financeiro e ordens do GitHub em segundo plano (quando não há senha). */
async function carregarTudo() {
  try {
    await ghLoad();
    persist();
    await finLoad();
    persistFin();
    await osLoad();
    persistOs();
    await perfis.load();
    perfis.persist();
    await catalogo.load();
    catalogo.persist();
    markSync(true);
  } catch (e) {
    markSync(false);
  }
  renderHome();
}
renderHome();
if (!isProt() && cfg().repo && cfg().token) carregarTudo();
updateSyncLabel();
// Avisa se alguma biblioteca externa não carregou (internet ou bloqueio de segurança)
const faltando = [];
if (typeof pdfjsLib === "undefined") faltando.push("leitor de PDF");
if (typeof qrcode === "undefined") faltando.push("QR Code");
if (typeof html2canvas === "undefined") faltando.push("imagem da nota");
if (!window.jspdf) faltando.push("gerador de PDF");
if (faltando.length)
  say(
    "⚠️ Não carregou: " +
      faltando.join(", ") +
      ". Verifique a internet e recarregue a página.",
    true,
  );
