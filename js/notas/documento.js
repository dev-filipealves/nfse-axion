/**
 * AXION · Notas · Documento personalizado
 *
 * Monta a nota com a identidade AXION (com QR Code de validação), ajusta à tela e gera o PDF
 * para baixar ou compartilhar.
 *
 * Depende de: notas/leitor.js
 */
"use strict";

try {
  if (window.claude && claude.use) {
    claude
      .use("downloads")
      .then((d) => {
        downloads = d;
        if (!d) $("#dl").title = "Download indisponível nesta visualização";
      })
      .catch(() => {});
  }
} catch (e) {}
const F = (l, v, c = "") =>
  `<div class="f ${c}"><label>${esc(l)}</label><div>${esc(v)}</div></div>`;
/** Desenha a nota personalizada na tela e gera o QR Code de validação. */
function render(d) {
  const chv = String(d.chave || "").replace(/\D/g, "");
  const qrData =
    "https://www.nfse.gov.br/ConsultaPublica/" +
    (chv.length >= 40 ? "?tpc=1&chave=" + chv : "");
  const qr = qrcode(0, "M");
  qr.addData(qrData);
  qr.make();
  const qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  const money = (v) => (v && v !== "-" ? v : "R$ 0,00");
  const info = d.info && d.info !== "-" ? d.info : "-";
  $("#paper").innerHTML = `
<div class="hd">
  <img class="logo" src="${LOGO}" alt="AXION">
  <div class="t"><div class="fan">${esc(FANTASIA)}</div><div class="sub">${esc(d.p.nome)} · CNPJ ${esc(d.p.doc)}</div></div>
  <div class="doc"><b>NOTA FISCAL DE SERVIÇO ELETRÔNICA</b><span>NFS-e · ${esc(d.municipioDoc || d.p.mun)}</span></div>
</div>
<div class="stripe"></div>
<div class="body" contenteditable="true" spellcheck="false">
  <div class="top">
    <div class="sec" style="flex:1">
      <h3>Identificação da nota</h3>
      <div class="g c3">
        ${F("Número da NFS-e", d.numero)}${F("Competência", d.competencia)}${F("Emissão da NFS-e", d.emissao)}
        ${F("Nº da DPS", d.dps)}${F("Série da DPS", d.serie)}${F("Situação", d.situacao)}
        <div class="f span3"><label>Chave de acesso</label><div class="key">${esc(d.chave)}</div></div>
      </div>
    </div>
    <div class="qr">${qrSvg}<span>Validar NFS-e nº ${esc(d.numero)}<br>nfse.gov.br</span></div>
  </div>

  <div class="sec"><h3>Prestador do serviço</h3>
    <div class="g c4">
      ${F("Nome fantasia", FANTASIA, "span4")}
      ${F("Razão social / Nome empresarial", d.p.nome, "span2")}${F("CNPJ / CPF", d.p.doc, "")}${F("Inscrição municipal", d.p.im)}
      ${F("Endereço", d.p.end, "span2")}${F("Município / UF", d.p.mun)}${F("CEP (IBGE / CEP)", d.p.cep)}
      ${F("E-mail", d.p.email, "span2")}${F("Telefone", d.p.tel)}${F("Emitente", d.emitente)}
      ${F("Simples Nacional", d.p.regime, "span4")}
    </div>
  </div>

  <div class="sec"><h3>Tomador do serviço</h3>
    <div class="g c4">
      ${F("Razão social / Nome empresarial", d.t.nome, "span2")}${F("CNPJ / CPF", d.t.doc, "")}${F("Inscrição municipal", d.t.im)}
      ${F("Endereço", d.t.end, "span2")}${F("Município / UF", d.t.mun)}${F("CEP (IBGE / CEP)", d.t.cep)}
      ${F("E-mail", d.t.email, "span3")}${F("Telefone", d.t.tel)}
    </div>
  </div>

  <div class="sec"><h3>Discriminação do serviço</h3>
    <div class="g c3">
      ${F("Cód. tributação nacional / municipal", d.s.trib)}${F("Código NBS", d.s.nbs)}${F("Local da prestação", d.s.local)}
    </div>
    <div class="desc">${esc(d.s.desc)}</div>
  </div>

  <div class="sec"><h3>Tributação municipal (ISSQN)</h3>
    <div class="g c3">
      ${F("Tipo de tributação", d.iss.tipo)}${F("Município de incidência", d.iss.inc)}${F("Retenção do ISSQN", d.iss.ret)}
      ${F("Base de cálculo", d.iss.bc)}${F("Alíquota aplicada", d.iss.aliq)}${F("ISSQN apurado", d.iss.val)}
    </div>
  </div>

  <div class="sec"><h3>Valores</h3>
    <div class="tot">
      ${F("Valor do serviço", d.v.op)}${F("Desconto incondicionado", d.v.di)}${F("Desconto condicionado", d.v.dc)}
      ${F("Retenções (ISSQN / federais)", d.v.ret)}${F("Total IBS / CBS", money(d.v.ibs))}
      <div class="f big"><label>Valor líquido da NFS-e</label><div>${esc(d.v.liq)}</div></div>
    </div>
  </div>

  <div class="sec"><h3>Informações complementares</h3><div class="desc">${esc(info)}</div></div>
</div>
<div class="ft">
  <div style="max-width:430px">Documento auxiliar personalizado, gerado a partir do DANFSe oficial. A autenticidade da NFS-e deve ser conferida no Portal Nacional da NFS-e pela <b>chave de acesso</b>.<br><b>${esc(FANTASIA)}</b></div>
  <div class="sig">Data de ciência / assinatura</div>
</div>`;
  hideAll();
  $("#fit").hidden = false;
  $("#hint").hidden = false;
  $("#dl").disabled = false;
  $("#sharebtn").disabled = false;
  $("#launchbtn").disabled = false;
  fit();
}
/** Ajusta a escala da nota para caber na largura da tela. */
function fit() {
  const p = $("#paper"),
    w = $("#fit");
  if (w.hidden) return;
  const s = Math.min(1, (w.clientWidth - 12) / 794);
  p.style.transform = `scale(${s})`;
  w.style.height = p.offsetHeight * s + 8 + "px";
}
/**
 * Reajusta a nota e a ordem de serviço quando a LARGURA da tela muda.
 * No celular, a barra de endereço aparece e some durante a rolagem e dispara
 * "resize" só com mudança de altura: isso é ignorado, e no máximo um ajuste
 * por quadro é feito (evita travadas ao rolar).
 */
let ultimaLargura = window.innerWidth,
  ajustePendente = false;
addEventListener(
  "resize",
  () => {
    if (window.innerWidth === ultimaLargura || ajustePendente) return;
    ultimaLargura = window.innerWidth;
    ajustePendente = true;
    requestAnimationFrame(() => {
      ajustePendente = false;
      fit();
      if (typeof fitOs === "function") fitOs();
    });
  },
  { passive: true },
);
/** Nome do arquivo PDF da nota exibida na tela. */
function nomeArquivoNota() {
  return "NFSe-" + String(current.numero).replace(/\W/g, "") + "-AXION.pdf";
}
/** Gera o PDF da nota exibida na tela e devolve o Blob. */
async function gerarPdfNota() {
  const canvas = await html2canvas($("#paper"), {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    onclone: (doc) => {
      const p = doc.getElementById("paper");
      p.style.transform = "none";
      const w = doc.getElementById("fit");
      w.style.height = "auto";
      w.style.overflow = "visible";
      w.style.padding = "0";
      w.style.maxWidth = "none";
    },
  });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210,
    H = (canvas.height * W) / canvas.width;
  pdf.addImage(
    canvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    0,
    0,
    W,
    Math.min(H, 297),
  );
  return pdf.output("blob");
}
$("#dl").addEventListener("click", async () => {
  if (!current) return;
  const btn = $("#dl");
  btn.disabled = true;
  say("Gerando PDF…");
  try {
    await saveBlob(await gerarPdfNota(), nomeArquivoNota());
    say("PDF salvo.");
  } catch (err) {
    if (err && err.code === "declined") say("Download cancelado.");
    else {
      console.error(err);
      say("Erro ao gerar o PDF: " + (err.message || err.code || err), true);
    }
  } finally {
    btn.disabled = false;
  }
});
/** Compartilha o PDF da nota (WhatsApp, e-mail...) pelo menu do aparelho. */
$("#sharebtn").addEventListener("click", async () => {
  if (!current) return;
  const btn = $("#sharebtn");
  btn.disabled = true;
  say("Preparando o PDF para compartilhar…");
  try {
    const blob = await gerarPdfNota();
    const file = new File([blob], nomeArquivoNota(), {
      type: "application/pdf",
    });
    const texto =
      "NFS-e nº " +
      current.numero +
      " · " +
      current.v.op +
      " · AXION | Sistemas Embarcados e Energia";
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "NFS-e nº " + current.numero,
        text: texto,
      });
      say("Compartilhado.");
    } else {
      // Sem suporte a compartilhar arquivos: baixa o PDF e abre o WhatsApp com a mensagem
      await saveBlob(blob, nomeArquivoNota());
      say(
        "Este navegador não compartilha arquivos. O PDF foi baixado: anexe-o na conversa.",
        true,
      );
      abrir("https://wa.me/?text=" + encodeURIComponent(texto));
    }
  } catch (err) {
    if (err && err.name === "AbortError") say("Compartilhamento cancelado.");
    else say("Erro ao compartilhar: " + ((err && err.message) || err), true);
  } finally {
    btn.disabled = false;
  }
});
