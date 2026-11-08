/**
 * AXION · Ordem de serviço · Documento
 *
 * Documento da OS no layout AXION, PDF, compartilhar e lançar no financeiro.
 *
 * Depende de: os/editor.js, financas/perfis.js
 */
"use strict";

/** HTML da ordem de serviço no layout do documento (sempre em fundo claro). */
function osPaperHtml(o) {
  const T = osTotals(o);
  const tabProd = o.prods.length
    ? '<div class="osp-h">PEÇAS / PRODUTOS</div><table class="osp-t"><thead><tr><th>Descrição</th><th class="r">Qtd</th><th class="r">Valor unit.</th><th class="r">Total</th></tr></thead><tbody>' +
      o.prods
        .map(
          (p) =>
            "<tr><td>" +
            esc(p.nome) +
            '</td><td class="r">' +
            esc(String(p.qtd).replace(".", ",")) +
            '</td><td class="r">' +
            brl(p.valor) +
            '</td><td class="r">' +
            brl(r2(p.qtd * p.valor)) +
            "</td></tr>",
        )
        .join("") +
      '</tbody><tfoot><tr><td colspan="3">Total de peças</td><td class="r">' +
      brl(T.prod) +
      "</td></tr></tfoot></table>"
    : "";
  const tabServ = o.servs.length
    ? '<div class="osp-h">SERVIÇOS REALIZADOS</div><table class="osp-t"><thead><tr><th>Descrição</th><th class="r">Horas</th><th class="r">Valor/hora</th><th class="r">Total</th></tr></thead><tbody>' +
      o.servs
        .map(
          (s) =>
            "<tr><td>" +
            esc(s.nome) +
            '</td><td class="r">' +
            (s.modo === "hora" ? esc(fmtHoras(s.horas)) : "—") +
            '</td><td class="r">' +
            (s.modo === "hora" ? brl(s.vh) : "—") +
            '</td><td class="r">' +
            brl(osServTotal(s)) +
            "</td></tr>",
        )
        .join("") +
      '</tbody><tfoot><tr><td colspan="3">Mão de obra</td><td class="r">' +
      brl(T.serv) +
      "</td></tr></tfoot></table>"
    : "";
  // Quadro do cliente: CLIENTE | CONTATO  /  VEÍCULO/MODELO | DATA
  const veiculo =
    [o.veiculo, o.placa ? "Placa " + o.placa : ""]
      .filter(Boolean)
      .join(" · ") || "—";
  const campo = (rot, val, forte) =>
    "<div><label>" +
    rot +
    "</label>" +
    (forte ? "<strong>" : "<span>") +
    esc(val) +
    (forte ? "</strong>" : "</span>") +
    "</div>";
  return (
    '<div class="osp-head"><div><div class="osp-name">' +
    esc(OS_EMPRESA.nome) +
    '</div><div class="osp-slogan">' +
    esc(OS_EMPRESA.slogan) +
    '</div><div class="osp-razao">' +
    esc(OS_EMPRESA.razao) +
    "<br>" +
    esc(OS_EMPRESA.cnpj) +
    '</div></div><img class="osp-logo" alt="" src="' +
    LOGO +
    '" /></div><div class="osp-stripe"></div>' +
    '<div class="osp-body"><div class="osp-title"><span>ORDEM DE SERVIÇO</span><b>Nº ' +
    osNum(o) +
    "</b></div>" +
    '<div class="osp-client">' +
    campo("CLIENTE", o.cliente, true) +
    campo("CONTATO", fmtTel(o.tel) || "—") +
    campo("VEÍCULO/MODELO", veiculo) +
    campo("DATA", dataBR(o.data)) +
    "</div>" +
    tabProd +
    tabServ +
    '<div class="osp-line"></div><div class="osp-sum"><span>Tempo de serviço: ' +
    (T.horas ? fmtHoras(T.horas) : "—") +
    "</span><span>Mão de obra: " +
    brl(T.serv) +
    "</span></div>" +
    (T.desc
      ? '<div class="osp-sum"><span>Desconto</span><span>− ' +
        brl(T.desc) +
        "</span></div>"
      : "") +
    '<div class="osp-total"><span>TOTAL GERAL</span><b>' +
    brl(T.total) +
    "</b></div>" +
    '<div class="osp-foot">Forma de pagamento: ' +
    esc(o.pagamento || "a definir") +
    "</div>" +
    '<div class="osp-foot">Observações: ' +
    (o.obs ? esc(o.obs) : '<span class="osp-ul"></span>') +
    "</div></div>"
  );
}
/** Ajusta a escala do documento à largura da tela. */
function fitOs() {
  const p = $("#ospaper"),
    w = $("#osfit");
  if (!w || $("#osview").hidden) return;
  const s = Math.min(1, (w.clientWidth - 12) / 794);
  p.style.transform = "scale(" + s + ")";
  w.style.height = p.offsetHeight * s + 8 + "px";
}
/** Mostra uma ordem de serviço como documento. */
function osMostrar(id) {
  const o = os.find((x) => x.id === id);
  if (!o) return;
  osAtual = o;
  hideAll();
  $("#osview").hidden = false;
  $("#ospaper").innerHTML = osPaperHtml(o);
  fitOs();
  window.scrollTo({ top: 0 });
}
/** Gera o PDF da ordem (várias páginas, se for longa). */
async function osGerarPdf() {
  const canvas = await html2canvas($("#ospaper"), {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    onclone: (doc) => {
      doc.getElementById("ospaper").style.transform = "none";
      const w = doc.getElementById("osfit");
      w.style.height = "auto";
      w.style.overflow = "visible";
      w.style.padding = "0";
      w.style.maxWidth = "none";
    },
  });
  const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const W = 210,
    H = (canvas.height * W) / canvas.width,
    img = canvas.toDataURL("image/jpeg", 0.95);
  for (let y = 0, pg = 0; y < H - 0.5; y += 297, pg++) {
    if (pg) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, -y, W, H);
  }
  return pdf.output("blob");
}
const osArquivo = (o) =>
  "OS-" +
  osNum(o) +
  "-" +
  String(o.cliente)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 14) +
  ".pdf";
/** Lança o total da ordem no financeiro (PJ ou PF, como entrada). */
async function lancarOs(id) {
  const o = os.find((x) => x.id === id);
  if (!o) return;
  const T = osTotals(o);
  const esc2 = await escolherPerfil(
    "💸 Lançar OS " + osNum(o) + " · " + brl(T.total),
    ["entrada"],
  );
  if (!esc2) return;
  const r = { acao: esc2.ledger };
  const rec = {
    id: novoId(),
    ledger: r.acao,
    tipo: "entrada",
    nome: "OS " + osNum(o) + " · " + o.cliente,
    valor: T.total,
    data: o.data || hojeISO(),
    cat: "Serviço",
    pago: o.status === "paga",
    rec: false,
    osId: o.id,
    criadoEm: Date.now(),
  };
  let dup = false;
  await finSync(
    (arr) => {
      if (arr.some((x) => x.osId === o.id && x.ledger === r.acao)) dup = true;
      else arr.push(rec);
    },
    "OS lançada em " + nomePerfil(r.acao),
    "Lançar OS " + osNum(o) + " em " + nomePerfil(r.acao),
  );
  if (dup) {
    say("Esta ordem já foi lançada em " + nomePerfil(r.acao) + ".", true);
    return;
  }
  finMes = rec.data.slice(0, 7);
  finLedger = r.acao;
  await oferecerReplica(rec);
}
$("#os_edit").addEventListener("click", () => osAtual && osEditor(osAtual));
$("#os_launch").addEventListener(
  "click",
  () => osAtual && lancarOs(osAtual.id),
);
$("#os_pdf").addEventListener("click", async () => {
  if (!osAtual) return;
  say("Gerando PDF…");
  try {
    await saveBlob(await osGerarPdf(), osArquivo(osAtual));
    say("PDF salvo.");
  } catch (e) {
    say("Erro ao gerar o PDF: " + ((e && e.message) || e), true);
  }
});
$("#os_share").addEventListener("click", async () => {
  if (!osAtual) return;
  say("Preparando o PDF para compartilhar…");
  try {
    const blob = await osGerarPdf(),
      file = new File([blob], osArquivo(osAtual), {
        type: "application/pdf",
      });
    const texto =
      "Ordem de serviço " +
      osNum(osAtual) +
      " · " +
      osAtual.cliente +
      " · " +
      brl(osTotals(osAtual).total);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "OS " + osNum(osAtual),
        text: texto,
      });
      say("Compartilhado.");
    } else {
      await saveBlob(blob, osArquivo(osAtual));
      say(
        "Este navegador não compartilha arquivos. O PDF foi baixado: anexe-o na conversa.",
        true,
      );
      const tel = String(osAtual.tel || "").replace(/\D/g, "");
      abrir(
        "https://wa.me/" +
          (tel.length >= 10 ? (tel.length <= 11 ? "55" + tel : tel) : "") +
          "?text=" +
          encodeURIComponent(texto),
      );
    }
  } catch (e) {
    if (e && e.name === "AbortError") say("Compartilhamento cancelado.");
    else say("Erro ao compartilhar: " + ((e && e.message) || e), true);
  }
});
