/**
 * AXION · Navegação
 *
 * Troca de telas: esconder tudo, quadrados e menu lateral (data-go), botão Voltar (sobe um
 * nível) e busca da barra superior.
 *
 * Depende de: todos os módulos de tela
 */
"use strict";

/** Esconde todas as telas; cada tela se mostra sozinha em seguida. */
function hideAll() {
  [
    "#empty",
    "#fit",
    "#hint",
    "#listbox",
    "#cfgbox",
    "#repbox",
    "#finbox",
    "#oslist",
    "#oseditor",
    "#osview",
    "#nfhub",
    "#oshub",
    "#osrep",
    "#catbox",
    "#finperfis",
  ].forEach((s) => {
    $(s).hidden = true;
  });
}
/** Volta para a tela inicial e limpa a nota aberta. */
function irInicio() {
  current = null;
  hideAll();
  $("#paper").innerHTML = "";
  $("#fit").hidden = true;
  $("#hint").hidden = true;
  $("#empty").hidden = false;
  renderHome();
  $("#dl").disabled = true;
  $("#sharebtn").disabled = true;
  $("#launchbtn").disabled = true;
  say("");
  window.scrollTo({ top: 0 });
}
/** Qual tela está aberta agora. */
function telaAtual() {
  return [
    "fit",
    "listbox",
    "repbox",
    "nfhub",
    "oseditor",
    "osview",
    "oslist",
    "osrep",
    "catbox",
    "oshub",
    "finbox",
    "finperfis",
    "cfgbox",
  ].find((id) => !$("#" + id).hidden);
}
/** Botão Voltar: sobe um nível (subferramenta → ferramenta → início). */
function voltar() {
  const t = telaAtual();
  if (t === "fit") return showList();
  if (t === "listbox" || t === "repbox") return showNfHub();
  if (t === "oseditor" || t === "osview") return showOs();
  if (t === "oslist" || t === "osrep" || t === "catbox") return showOsHub();
  if (t === "finbox") return showFin();
  irInicio();
}
$("#cancel").addEventListener("click", voltar);
/** Abre a ferramenta Nota Fiscal (quadrados: enviar, minhas notas, relatórios). */
function showNfHub() {
  hideAll();
  $("#nfhub").hidden = false;
  renderHubs();
  say("");
  window.scrollTo({ top: 0 });
}
/** Abre a ferramenta Ordem de serviço (quadrados: nova, minhas OS, cadastro, relatórios). */
function showOsHub() {
  hideAll();
  $("#oshub").hidden = false;
  renderHubs();
  say("");
  window.scrollTo({ top: 0 });
}
