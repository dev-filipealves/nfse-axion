/**
 * AXION · Utilitários
 *
 * Funções puras de formatação e conversão: moeda, números, datas, horas, telefone, CSV. Não
 * mexem na tela.
 *
 * Depende de: base/config.js
 */
"use strict";

/** Escapa texto para inserir com segurança no HTML. */
const esc = (s) =>
  String(s ?? "-").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
/** Texto normalizado para comparar rótulos (sem diferenciar maiúsculas). */
const normRot = (s) =>
  String(s || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
// limite anual do MEI (confirmado para 2026); altere aqui se a lei mudar
/** Formata número como moeda brasileira. */
function brl(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
/** Converte "R$ 1.466,67" em número. */
function toNum(s) {
  const m = String(s || "").match(/[\d.]+,\d{2}|\d+/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/\./g, "").replace(",", ".")) || 0;
}
/** Protege um valor para uso em CSV (separador ponto e vírgula). */
function csvCell(s) {
  s = String(s == null ? "" : s);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
// id do perfil financeiro aberto
const pad2 = (n) => String(n).padStart(2, "0");
/** Chave do mês: "2026-10". */
function mesKey(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
}
/** Soma (ou subtrai) meses de uma chave "AAAA-MM". */
function somaMes(key, delta) {
  const p = key.split("-").map(Number);
  return mesKey(new Date(p[0], p[1] - 1 + delta, 1));
}
/** "2026-10" -> "Outubro/2026". */
function nomeMes(key) {
  const p = key.split("-");
  return MESES[+p[1] - 1] + "/" + p[0];
}
/** Data de hoje no formato AAAA-MM-DD. */
function hojeISO() {
  const d = new Date();
  return (
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
  );
}
/** "2026-10-05" -> "05/10/2026". */
function dataBR(iso) {
  const m = String(iso || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}
/** "05/10/2026" -> "2026-10-05". */
function isoDeBR(br) {
  const m = String(br || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
}
/** Lê um valor digitado ("1.466,67" ou "1466.67"); devolve NaN se inválido. */
function parseValor(s) {
  s = String(s || "").replace(/[^\d,.\-]/g, "");
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  const v = parseFloat(s);
  return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
}
/** Identificador único para um item novo. */
const novoId = () =>
  "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** Valor abreviado para eixos e bolhas: R$ 1,2k, R$ 45k. */
function brlCurto(v) {
  if (v >= 1000)
    return (
      "R$ " + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",") + "k"
    );
  return "R$ " + Math.round(v);
}
/** Primeira letra do nome, para o avatar. */
const inicial = (s) =>
  String(s || "?")
    .trim()
    .charAt(0)
    .toUpperCase() || "?";
/** Arredonda para 2 casas decimais (centavos). */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** Lê horas digitadas: "1,5", "2" ou "1h30". */
function parseHoras(s) {
  s = String(s || "")
    .trim()
    .toLowerCase();
  const m = s.match(/^(\d+)\s*h\s*(\d{1,2})?\s*(?:min|m)?$/);
  if (m) return +m[1] + (+m[2] || 0) / 60;
  const v = parseValor(s);
  return v > 0 ? v : 0;
}
/** Telefone legível: 51991513460 -> (51) 99151-3460. Outros formatos ficam como digitados. */
function fmtTel(t) {
  const s = String(t || "").trim(),
    n = s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11)
    return "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7);
  if (n.length === 10)
    return "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6);
  return s;
}
/** Horas decimais em texto: 5.6667 -> "5h40". */
function fmtHoras(h) {
  const t = Math.round(h * 60),
    H = Math.floor(t / 60),
    M = t % 60;
  return H + "h" + (M ? pad2(M) : "");
}
/** Número para campo de texto: 2.5 -> "2,5" (vazio quando zero). */
const fmtNum = (n) => (n ? String(r2(n)).replace(".", ",") : "");
