/**
 * AXION · Notas · Leitor do PDF (DANFSe)
 *
 * Lê o texto do PDF e converte nos dados da nota. Aceita os dois modelos: site (v2.0) e app
 * NFS-e Mobile (v1.0).
 *
 * Depende de: notas/banco.js
 */
"use strict";

/** Lê a 1ª página do PDF e devolve a lista de textos, na ordem em que aparecem. */
async function extract(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({
    data: await file.arrayBuffer(),
    isEvalSupported: false, // compatível com a política de segurança (CSP)
  }).promise;
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  return tc.items.map((i) => i.str.trim()).filter(Boolean);
}
/**
 * Cria um leitor que devolve o texto logo após um rótulo.
 * Aceita uma lista de rótulos alternativos (os dois modelos de DANFSe) e a ocorrência n
 * (0 = prestador, 1 = tomador, quando o mesmo rótulo se repete).
 */
function reader(items) {
  const low = items.map(normRot);
  return (labels, n = 0) => {
    for (const label of [].concat(labels)) {
      const L = normRot(label);
      let c = 0;
      for (let i = 0; i < low.length; i++) {
        if (low[i] === L || low[i].endsWith(" " + L)) {
          if (c === n) {
            const v = items[i + 1];
            return v === undefined ? "-" : v;
          }
          c++;
        }
      }
    }
    return "-";
  };
}
/** Converte os textos do DANFSe em um objeto com os dados da nota.
 *  Funciona com os dois modelos: o do site (DANFSe v2.0) e o do app NFS-e Mobile (DANFSe v1.0). */
function parse(items) {
  const g = reader(items);
  const low = items.map(normRot);
  const limpa = (v) => (/^R\$\s*$/.test(String(v).trim()) ? "-" : v); // "R$" sem valor
  const chaveFb =
    items.find((t) => /^\d{40,}$/.test(t.replace(/\s/g, ""))) || "-";
  let chave = g("CHAVE DE ACESSO DA NFS-e");
  if (!/\d{20,}/.test(chave)) chave = chaveFb;
  let regime = g("Simples Nacional na Data de Competência");
  if (/Microempreendedor/i.test(regime))
    regime = "Optante – Microempreendedor Individual (MEI)";
  // Código de tributação: v2.0 traz "14.01.01 / -"; v1.0 traz o código com a descrição
  let trib = g("Código de Tributação Nacional/Municipal");
  if (trib === "-") {
    const nac = String(g("Código de Tributação Nacional")).match(
      /^\d{2}\.\d{2}\.\d{2}/,
    );
    const mun = g("Código de Tributação Municipal");
    trib = nac ? nac[0] + " / " + (mun || "-") : "-";
  }
  // NBS: v2.0 tem campo próprio; v1.0 traz "NBS: 120013110" nas informações complementares
  let nbs = g("Código da NBS");
  if (nbs === "-") {
    const raw = String(g("NBS:")).replace(/\D/g, "");
    nbs =
      raw.length === 9
        ? raw[0] +
          "." +
          raw.slice(1, 5) +
          "." +
          raw.slice(5, 7) +
          "." +
          raw.slice(7)
        : raw || "-";
  }
  // Informações complementares: junta todos os textos depois do rótulo
  const iInfo = low.indexOf(normRot("INFORMAÇÕES COMPLEMENTARES"));
  const info =
    iInfo >= 0
      ? items
          .slice(iInfo + 1)
          .join(" ")
          .trim() || "-"
      : "-";
  const d = {
    chave,
    numero: g("NÚMERO DA NFS-e"),
    competencia: g("COMPETÊNCIA DA NFS-e"),
    emissao: g("DATA E HORA DA EMISSÃO DA NFS-e"),
    dps: g("NÚMERO DA DPS"),
    serie: g("SÉRIE DA DPS"),
    situacao: g("SITUAÇÃO DA NFS-e"),
    emitente: g("EMITENTE DA NFS-e"),
    municipioDoc: "",
    p: {
      doc: g("CNPJ / CPF / NIF", 0),
      nome: g("Nome / Nome Empresarial", 0),
      tel: g("Telefone", 0),
      mun: g(["Município / Sigla UF", "Município"], 0),
      cep: g(["Código IBGE / CEP", "CEP"], 0),
      end: g("Endereço", 0),
      email: g("E-mail", 0),
      im: g(["Indicador Municipal (Inscrição)", "Inscrição Municipal"], 0),
      regime,
    },
    t: {
      doc: g("CNPJ / CPF / NIF", 1),
      nome: g("Nome / Nome Empresarial", 1),
      tel: g("Telefone", 1),
      mun: g(["Município / Sigla UF", "Município"], 1),
      cep: g(["Código IBGE / CEP", "CEP"], 1),
      end: g("Endereço", 1),
      email: g("E-mail", 1),
      im: g(["Indicador Municipal (Inscrição)", "Inscrição Municipal"], 1),
    },
    s: {
      trib,
      nbs,
      local: g(["Local da Prestação / Sigla UF / País", "Local da Prestação"]),
      desc: g("Descrição do Serviço"),
    },
    iss: {
      tipo: g(["Tipo de Tributação do ISSQN", "Tributação do ISSQN"]),
      inc: g([
        "Município / Sigla UF / País de Incidência do ISSQN",
        "Município de Incidência do ISSQN",
      ]),
      ret: g("Retenção do ISSQN"),
      bc: g("BC ISSQN"),
      aliq: g("Alíquota Aplicada"),
      val: g("ISSQN Apurado"),
    },
    v: {
      op: g(["VALOR DA OPERAÇÃO / SERVIÇO", "Valor do Serviço"]),
      liq: g("VALOR LÍQUIDO DA NFS-e"),
      ret: g("Total das Retenções (ISSQN / Federais)"),
      di: limpa(g("Desconto Incondicionado")),
      dc: limpa(g("Desconto Condicionado")),
      ibs: g("Total do IBS/CBS"),
    },
    info,
  };
  const m =
    items.find((t) => /^Município:/.test(t)) ||
    items.find((t) => /^Município de /.test(t));
  d.municipioDoc = m
    ? m.replace(/^Município(:| de)\s*/, "").replace(/\s*-\s*/, " - ")
    : "";
  if (
    d.municipioDoc &&
    !/ - [A-Z]{2}$/.test(d.municipioDoc) &&
    /[A-Z]{2}$/.test(d.p.mun)
  )
    d.municipioDoc += " - " + d.p.mun.slice(-2);
  // Confere se o PDF é mesmo um DANFSe (precisa ter chave e número)
  if (!/\d{40,}/.test(String(d.chave).replace(/\D/g, "")) || d.numero === "-")
    throw new Error(
      "este PDF não parece ser um DANFSe. Use o PDF da nota baixado do portal ou do app NFS-e Mobile.",
    );
  return d;
}
/** Processa o PDF enviado: lê, mostra a nota e salva. */
async function handleFile(f) {
  if (!f) return;
  say("Lendo a nota…");
  try {
    const items = await extract(f);
    if (items.length < 10)
      throw new Error(
        "O PDF não tem texto legível. Use o DANFSe original baixado do portal.",
      );
    current = parse(items);
    render(current);
    say("Nota gerada. Confira os dados e baixe o PDF.");
    saveNote(current, f);
  } catch (err) {
    console.error(err);
    say("Não consegui ler esse arquivo: " + (err.message || err), true);
  }
}
/** Abre o seletor de arquivos do aparelho. */
function openPicker() {
  try {
    const i = document.createElement("input");
    i.type = "file";
    i.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(i);
    i.addEventListener("change", () => {
      const f = i.files && i.files[0];
      i.remove();
      handleFile(f);
    });
    i.click();
  } catch (err) {
    say(
      "Seu navegador bloqueou o seletor. Use o campo ‘Escolher arquivo’.",
      true,
    );
  }
}
document
  .querySelectorAll(".pickbtn")
  .forEach((b) => b.addEventListener("click", openPicker));
