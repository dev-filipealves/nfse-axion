/**
 * AXION · Pix (BR Code)
 *
 * Gera o "Pix copia e cola" e o QR Code com valor, no padrão do Banco Central (EMV/BR Code
 * estático), e o QR Code em SVG usado também na nota fiscal. A chave, o nome e a cidade ficam
 * em base/config.js (PIX). Também tem copiarTexto() (área de transferência).
 *
 * Depende de: base/config.js (PIX), biblioteca qrcode-generator
 */
"use strict";

/** Um campo EMV: id + tamanho com 2 dígitos + valor. */
function campoEmv(id, valor) {
  const v = String(valor);
  return id + String(v.length).padStart(2, "0") + v;
}
/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do BR Code. */
function crc16(texto) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
/** Texto sem acentos e só com letras, números e espaço (o BR Code aceita apenas ASCII). */
const pixTexto = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim();
/**
 * Monta o "Pix copia e cola".
 * valor: em reais (0 = o pagador digita); ident: identificação curta (ex.: "OS00021").
 */
function pixPayload(valor, ident) {
  const conta = campoEmv("00", "br.gov.bcb.pix") + campoEmv("01", PIX.chave);
  const txid = pixTexto(ident).replace(/ /g, "").slice(0, 25) || "***";
  const corpo =
    campoEmv("00", "01") +
    campoEmv("26", conta) +
    campoEmv("52", "0000") +
    campoEmv("53", "986") +
    (valor > 0 ? campoEmv("54", Number(valor).toFixed(2)) : "") +
    campoEmv("58", "BR") +
    campoEmv("59", pixTexto(PIX.nome).slice(0, 25)) +
    campoEmv("60", pixTexto(PIX.cidade).slice(0, 15)) +
    campoEmv("62", campoEmv("05", txid)) +
    "6304";
  return corpo + crc16(corpo);
}
/** QR Code (SVG) de um texto (Pix ou link da nota); vazio se a biblioteca do CDN não carregou. */
function qrSvg(texto) {
  if (typeof qrcode !== "function") return "";
  const q = qrcode(0, "M");
  q.addData(texto);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
/** Chave Pix para exibir: CNPJ formatado (ou a chave como foi cadastrada). */
function pixChaveTexto() {
  const n = String(PIX.chave).replace(/\D/g, "");
  return n.length === 14
    ? "CNPJ " +
        n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : PIX.chave;
}
/** Copia um texto para a área de transferência (com aviso na tela). */
async function copiarTexto(texto, aviso) {
  try {
    await navigator.clipboard.writeText(texto);
    say(aviso || "Copiado.");
  } catch (e) {
    say(
      "Não consegui copiar automaticamente. Selecione o texto e copie.",
      true,
    );
  }
}
