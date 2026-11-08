/**
 * AXION · Notas · Minhas notas
 *
 * Lista de notas: busca, filtros, situação (recebida, cancelada), observações, cobrança por
 * WhatsApp/e-mail e painel do limite do MEI.
 *
 * Depende de: notas/documento.js
 */
"use strict";

/** Uma nota cancelada fica no histórico, mas não entra em totais, limite e relatórios. */
function ativa(n) {
  return n.status !== "cancelada";
}
/** Dias desde a emissão da nota (0 se a data for inválida). */
function diasDesde(n) {
  const x = ndate(n);
  if (!x) return 0;
  const t = new Date(x.y, x.m - 1, x.d).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}
/** Painel de faturamento do mês/ano e barra do limite anual do MEI. */
function renderResumo() {
  const el = $("#resumo");
  if (!el) return;
  const now = new Date(),
    ano = now.getFullYear(),
    mes = now.getMonth() + 1;
  let tm = 0,
    ta = 0;
  notes.forEach((n) => {
    if (!ativa(n)) return;
    const m = String((n.d && n.d.emissao) || "").match(
      /(\d{2})\/(\d{2})\/(\d{4})/,
    );
    if (!m) return;
    const vv = n.d.v || {};
    const v = toNum(vv.liq && vv.liq !== "-" ? vv.liq : vv.op);
    if (+m[3] === ano) {
      ta += v;
      if (+m[2] === mes) tm += v;
    }
  });
  const pct = Math.min(100, (ta / LIMITE_MEI) * 100),
    cor =
      ta >= LIMITE_MEI
        ? "#d23b3b"
        : ta >= LIMITE_MEI * 0.8
          ? "#e0a100"
          : "#2f6bff";
  el.innerHTML =
    '<div class="resumo"><div class="small">Faturamento das notas salvas aqui</div>' +
    '<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;margin-top:4px"><span>' +
    String(mes).padStart(2, "0") +
    "/" +
    ano +
    ": <b>" +
    brl(tm) +
    "</b></span><span>" +
    ano +
    ": <b>" +
    brl(ta) +
    "</b></div>" +
    '<div class="bar2"><i style="width:' +
    pct.toFixed(1) +
    "%;background:" +
    cor +
    '"></i></div>' +
    '<div class="small">' +
    pct.toFixed(0) +
    "% do limite anual do MEI (" +
    brl(LIMITE_MEI) +
    ")" +
    (ta >= LIMITE_MEI * 0.8 ? " ⚠️ atenção" : "") +
    "</div></div>";
}
let stFilter = "todas";
/** Valor líquido (ou do serviço) de uma nota, em número. */
function vOf(n) {
  const vv = (n.d && n.d.v) || {};
  return toNum(vv.liq && vv.liq !== "-" ? vv.liq : vv.op);
}
/** Extrai dia, mês e ano da data de emissão da nota. */
function ndate(n) {
  const m = String((n.d && n.d.emissao) || "").match(
    /(\d{2})\/(\d{2})\/(\d{4})/,
  );
  return m ? { d: +m[1], m: +m[2], y: +m[3] } : null;
}
/** HTML de uma nota na lista: status, cobrança, observação, cancelamento e PDF. */
function itemHtml(n) {
  const st = n.status || "receber",
    id = esc(n.id),
    dias = diasDesde(n);
  let badges;
  if (st === "cancelada") {
    badges = '<span class="badge off">🚫 Cancelada</span>';
  } else if (st === "recebida") {
    badges =
      '<button class="badge ok" data-st="' +
      id +
      '">✅ Recebida' +
      (n.pagoEm ? " em " + esc(n.pagoEm) : "") +
      "</button>";
  } else {
    badges =
      '<button class="badge ' +
      (dias > 30 ? "late" : "wait") +
      '" data-st="' +
      id +
      '">⏳ A receber · ' +
      dias +
      (dias === 1 ? " dia" : " dias") +
      "</button>" +
      '<button class="badge" data-cobrar="' +
      id +
      '">💬 Cobrar</button>';
  }
  return (
    '<div class="item' +
    (st === "cancelada" ? " cancel" : "") +
    '" data-id="' +
    id +
    '">' +
    '<div style="flex:1;min-width:0"><div class="nm">' +
    esc(n.nome) +
    "</div>" +
    '<div class="sb">' +
    esc(n.d.t.nome) +
    " · " +
    esc(n.d.v.op) +
    "</div>" +
    (n.obs ? '<div class="obs">📝 ' + esc(n.obs) + "</div>" : "") +
    '<div class="acts">' +
    badges +
    '<button class="badge" data-obs="' +
    id +
    '">📝 ' +
    (n.obs ? "Editar obs." : "Observação") +
    "</button>" +
    lancarBadge(n) +
    '<button class="badge" data-cancel="' +
    id +
    '">' +
    (st === "cancelada" ? "↩ Reativar" : "🚫 Cancelar") +
    "</button>" +
    (n.pdf
      ? '<button class="badge" data-pdf="' +
        esc(n.pdf) +
        '">📎 PDF original</button>'
      : "") +
    "</div></div>" +
    '<button class="x" data-del="' +
    id +
    '" aria-label="Excluir nota">🗑</button></div>'
  );
}
/** Redesenha a lista de notas conforme busca, filtro e totais. */
function refreshList() {
  const box = $("#items");
  if (!box) return;
  renderResumo();
  const q = (($("#q") && $("#q").value) || "").toLowerCase().trim(),
    qd = q.replace(/\D/g, "");
  const arr = notes
    .filter((n) => {
      if (stFilter !== "todas" && (n.status || "receber") !== stFilter)
        return false;
      if (!q) return true;
      const vv = (n.d && n.d.v) || {},
        val = String(vv.liq && vv.liq !== "-" ? vv.liq : vv.op || "");
      const num = val.replace(/^[^\d]*/, "");
      const hay = (
        n.nome +
        " " +
        ((n.d && n.d.t && n.d.t.nome) || "") +
        " " +
        (n.obs || "") +
        " " +
        val +
        " " +
        num +
        " " +
        num.replace(/\./g, "") +
        " " +
        num.replace(/\./g, "").replace(",", ".")
      ).toLowerCase();
      return (
        hay.includes(q) ||
        (qd.length >= 2 && val.replace(/\D/g, "").includes(qd))
      );
    })
    .sort((a, b) => String(b.nome).localeCompare(String(a.nome)));
  const ativas = arr.filter(ativa);
  $("#tot").textContent =
    arr.length +
    " nota(s) · Total " +
    brl(ativas.reduce((s, n) => s + vOf(n), 0)) +
    (arr.length > ativas.length ? " (canceladas ficam fora do total)" : "");
  box.innerHTML = arr.length
    ? arr.map(itemHtml).join("")
    : '<div class="small" style="margin-top:12px">Nenhuma nota encontrada.</div>';
}
/** Monta uma mensagem de cobrança editável e abre o WhatsApp ou o e-mail. */
async function cobrar(id) {
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  const d = n.d,
    data = String(d.emissao || "").slice(0, 10);
  const msg =
    "Olá! Segue a NFS-e nº " +
    d.numero +
    " (emitida em " +
    data +
    "), no valor de " +
    d.v.op +
    ", referente a: " +
    String((d.s && d.s.desc) || "serviço prestado").slice(0, 120) +
    ".\nFico no aguardo da confirmação do pagamento. Obrigado!\n\nAXION | Sistemas Embarcados e Energia";
  const r = await askText({
    titulo: "💬 Cobrar · " + n.nome,
    texto: msg,
    botoes: [
      { id: "wpp", rotulo: "WhatsApp" },
      { id: "email", rotulo: "E-mail" },
      { id: "cancelar", rotulo: "Cancelar", sec: true },
    ],
  });
  if (r.acao === "wpp") {
    const tel = String((d.t && d.t.tel) || "").replace(/\D/g, "");
    const num = tel.length >= 10 ? (tel.length <= 11 ? "55" + tel : tel) : "";
    abrir("https://wa.me/" + num + "?text=" + encodeURIComponent(r.texto));
  } else if (r.acao === "email") {
    const em = d.t && d.t.email && d.t.email !== "-" ? d.t.email : "";
    abrir(
      "mailto:" +
        em +
        "?subject=" +
        encodeURIComponent("NFS-e nº " + d.numero + " — AXION") +
        "&body=" +
        encodeURIComponent(r.texto),
    );
  }
}
$("#chips").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-f]");
  if (!b) return;
  stFilter = b.getAttribute("data-f");
  document
    .querySelectorAll("#chips .chip")
    .forEach((x) => x.classList.toggle("on", x === b));
  refreshList();
});
/** Abre a tela "Minhas notas" (pede senha e sincroniza se preciso). */
async function showList() {
  if (isProt() && !(await ensureUnlocked())) {
    say("🔒 Senha necessária para ver as notas.", true);
    return;
  }
  hideAll();
  $("#listbox").hidden = false;
  refreshList();
  window.scrollTo({ top: 0 });
  const c = cfg();
  if (c.repo && c.token) {
    setSync("Sincronizando…");
    try {
      await ghLoad();
      persist();
      setSync("✅ Sincronizado com " + c.repo);
      markSync(true);
    } catch (e) {
      markSync(false);
      setSync(
        "⚠️ Não sincronizou: " +
          ((e && e.message) || e) +
          ". Mostrando as notas deste aparelho.",
      );
    }
    refreshList();
  } else
    setSync(
      "💾 Notas guardadas só neste aparelho. Toque em ⚙️ para guardar no GitHub.",
    );
}
$("#listbtn").addEventListener("click", showList);
$("#q").addEventListener("input", refreshList);
$("#items").addEventListener("click", async (ev) => {
  const st = ev.target.closest("[data-st]");
  if (st) {
    ev.stopPropagation();
    const id = st.getAttribute("data-st");
    await sync(
      (arr) => {
        const x = arr.find((n) => n.id === id);
        if (!x) return;
        if (x.status === "recebida") {
          x.status = "receber";
          x.pagoEm = "";
        } else {
          x.status = "recebida";
          x.pagoEm = new Date().toLocaleDateString("pt-BR");
        }
      },
      "Status atualizado",
      "Status " + id,
    );
    return;
  }
  const pb = ev.target.closest("[data-pdf]");
  if (pb) {
    ev.stopPropagation();
    await getPdf(pb.getAttribute("data-pdf"));
    return;
  }
  const lc = ev.target.closest("[data-lancar]");
  if (lc) {
    ev.stopPropagation();
    await lancarNota(lc.getAttribute("data-lancar"));
    return;
  }
  const cn = ev.target.closest("[data-cancel]");
  if (cn) {
    ev.stopPropagation();
    const id = cn.getAttribute("data-cancel"),
      n = notes.find((x) => x.id === id);
    if (!n) return;
    const reativar = n.status === "cancelada";
    let ok = true;
    if (!reativar) {
      try {
        ok = confirm(
          "Marcar a nota " +
            n.nome +
            " como cancelada? Ela sai dos totais e do limite do MEI.",
        );
      } catch (e) {}
    }
    if (ok)
      await sync(
        (arr) => {
          const x = arr.find((y) => y.id === id);
          if (x) {
            x.status = reativar ? "receber" : "cancelada";
            x.pagoEm = "";
          }
        },
        reativar ? "Nota reativada" : "Nota cancelada",
        (reativar ? "Reativar " : "Cancelar ") + id,
      );
    return;
  }
  const ob = ev.target.closest("[data-obs]");
  if (ob) {
    ev.stopPropagation();
    const id = ob.getAttribute("data-obs"),
      n = notes.find((x) => x.id === id);
    if (!n) return;
    const r = await askText({
      titulo: "📝 Observação · " + n.nome,
      texto: n.obs || "",
      placeholder: "Ex.: cliente pediu desconto; pago em 2x",
      botoes: [
        { id: "salvar", rotulo: "Salvar" },
        { id: "cancelar", rotulo: "Cancelar", sec: true },
      ],
    });
    if (r.acao === "salvar")
      await sync(
        (arr) => {
          const x = arr.find((y) => y.id === id);
          if (x) x.obs = r.texto.trim();
        },
        "Observação salva",
        "Observação " + id,
      );
    return;
  }
  const cb = ev.target.closest("[data-cobrar]");
  if (cb) {
    ev.stopPropagation();
    await cobrar(cb.getAttribute("data-cobrar"));
    return;
  }
  const del = ev.target.closest("[data-del]");
  if (del) {
    ev.stopPropagation();
    const id = del.getAttribute("data-del");
    const n = notes.find((x) => x.id === id);
    let ok = true;
    try {
      ok = confirm("Excluir a nota " + (n ? n.nome : "") + "?");
    } catch (e) {}
    if (ok)
      await sync(
        (arr) => {
          const i = arr.findIndex((x) => x.id === id);
          if (i >= 0) arr.splice(i, 1);
        },
        "Nota excluída",
        "Excluir NFS-e " + (n ? n.nome : ""),
      );
    return;
  }
  const it = ev.target.closest(".item");
  if (!it) return;
  const n = notes.find((x) => x.id === it.getAttribute("data-id"));
  if (!n) return;
  current = n.d;
  render(current);
  say("Nota " + n.nome + " aberta. Toque em Baixar PDF para imprimir de novo.");
  window.scrollTo({ top: 0 });
});
/* busca da barra superior (computador): abre Minhas notas já filtrada */
$("#gsearch").addEventListener("keydown", async (ev) => {
  if (ev.key !== "Enter") return;
  const v = ev.target.value;
  await showList();
  $("#q").value = v;
  refreshList();
});
