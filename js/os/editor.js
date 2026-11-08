/**
 * AXION · Ordem de serviço · Editor
 *
 * Criar/editar uma OS: cliente, produtos, serviços por hora ou valor fixo, desconto e total
 * calculado na hora.
 *
 * Depende de: os/cadastro.js
 */
"use strict";

/** Linha de um produto: nome, quantidade e valor unitário. */
function rowProd(p, i) {
  return (
    '<div class="osrow" data-k="p" data-i="' +
    i +
    '"><input class="o-nome" type="text" placeholder="Nome do produto" autocomplete="off" value="' +
    esc(p.nome) +
    '" /><div class="osrow-n">' +
    '<label>Qtd<input class="o-qtd" type="text" inputmode="decimal" value="' +
    fmtNum(p.qtd) +
    '" /></label>' +
    '<label>Valor unit. (R$)<input class="o-val" type="text" inputmode="decimal" placeholder="0,00" value="' +
    fmtNum(p.valor) +
    '" /></label>' +
    '<div class="o-tot">' +
    brl(r2(p.qtd * p.valor)) +
    "</div></div>" +
    '<button class="x o-del" type="button" aria-label="Remover produto">🗑</button></div>'
  );
}
/** Linha de um serviço: por hora (horas × valor/hora) ou valor fixo. */
function rowServ(s, i) {
  return (
    '<div class="osrow" data-k="s" data-i="' +
    i +
    '" data-modo="' +
    s.modo +
    '"><input class="o-nome" type="text" placeholder="Nome do serviço" list="svc-list" autocomplete="off" value="' +
    esc(s.nome) +
    '" /><div class="osrow-n"><label>Cobrança<select class="o-modo"><option value="hora"' +
    (s.modo === "hora" ? " selected" : "") +
    '>Por hora</option><option value="fixo"' +
    (s.modo === "fixo" ? " selected" : "") +
    ">Valor fixo</option></select></label>" +
    '<label class="l-h">Horas<input class="o-h" type="text" inputmode="decimal" placeholder="1,5 ou 1h30" value="' +
    (s.horas ? esc(fmtHoras(s.horas)) : "") +
    '" /></label>' +
    '<label class="l-vh">Valor/hora (R$)<input class="o-vh" type="text" inputmode="decimal" placeholder="0,00" value="' +
    fmtNum(s.vh) +
    '" /></label>' +
    '<label class="l-v">Valor (R$)<input class="o-val" type="text" inputmode="decimal" placeholder="0,00" value="' +
    fmtNum(s.valor) +
    '" /></label><div class="o-tot">' +
    brl(osServTotal(s)) +
    "</div></div>" +
    '<button class="x o-del" type="button" aria-label="Remover serviço">🗑</button></div>'
  );
}
/** Redesenha as linhas de produtos e serviços do rascunho. */
function osLinhas() {
  $("#os_prods").innerHTML =
    osDraft.prods.map(rowProd).join("") ||
    '<div class="small">Nenhum produto adicionado.</div>';
  $("#os_servs").innerHTML =
    osDraft.servs.map(rowServ).join("") ||
    '<div class="small">Nenhum serviço adicionado.</div>';
}
/** Totais do rascunho, atualizados a cada digitação. */
function osAtualizarTotais() {
  const T = osTotals(osDraft);
  $("#os_tot").innerHTML =
    '<div class="row"><span>Produtos</span><b>' +
    brl(T.prod) +
    "</b></div>" +
    '<div class="row"><span>Serviços (mão de obra)' +
    (T.horas ? " · " + fmtHoras(T.horas) : "") +
    "</span><b>" +
    brl(T.serv) +
    "</b></div>" +
    (T.desc
      ? '<div class="row"><span>Desconto</span><b>− ' +
        brl(T.desc) +
        "</b></div>"
      : "") +
    '<div class="row total"><span>TOTAL GERAL</span><b>' +
    brl(T.total) +
    "</b></div>";
}
/** Abre o editor com uma ordem nova ou existente. */
function osEditor(o) {
  osDraft = o
    ? JSON.parse(JSON.stringify(o))
    : {
        id: novoId(),
        numero: osProximo(),
        data: hojeISO(),
        cliente: "",
        tel: "",
        veiculo: "",
        placa: "",
        status: "aberta",
        prods: [],
        servs: [],
        desconto: 0,
        pagamento: "A definir",
        obs: "",
        criadoEm: Date.now(),
      };
  hideAll();
  $("#oseditor").hidden = false;
  $("#os_title").textContent = o
    ? "Editar OS " + osNum(o)
    : "Nova ordem de serviço";
  $("#os_pag").innerHTML = OS_PAGAMENTOS.map(
    (p) => "<option>" + p + "</option>",
  ).join("");
  const v = osDraft;
  $("#os_cliente").value = v.cliente;
  $("#os_tel").value = v.tel || "";
  $("#os_veic").value = v.veiculo || "";
  $("#os_placa").value = v.placa || "";
  $("#os_data").value = v.data;
  $("#os_num").value = v.numero;
  $("#os_status").value = v.status || "aberta";
  $("#os_desc").value = fmtNum(v.desconto);
  $("#os_pag").value = v.pagamento || "A definir";
  $("#os_obs").value = v.obs || "";
  $("#os_err").textContent = "";
  osLinhas();
  osAtualizarTotais();
  window.scrollTo({ top: 0 });
}
/** Valida e salva a ordem do editor. */
async function osSalvar() {
  const d = osDraft,
    erro = (t) => {
      $("#os_err").textContent = t;
    };
  d.prods = d.prods.filter((p) => p.nome.trim() || p.valor > 0);
  d.servs = d.servs.filter((s) => s.nome.trim() || osServTotal(s) > 0);
  const num = parseInt(d.numero, 10);
  if (!d.cliente.trim()) return erro("Informe o nome do cliente.");
  if (!d.prods.length && !d.servs.length)
    return erro("Adicione ao menos um produto ou serviço.");
  if (
    d.prods.some((p) => !p.nome.trim()) ||
    d.servs.some((s) => !s.nome.trim())
  )
    return erro("Dê um nome a todos os itens.");
  if (!(num > 0)) return erro("Informe um número de OS válido.");
  if (os.some((o) => o.id !== d.id && parseInt(o.numero, 10) === num))
    return erro(
      "Já existe a OS " + String(num).padStart(5, "0") + ". Use outro número.",
    );
  const rec = JSON.parse(JSON.stringify(d));
  rec.numero = num;
  await osSync(
    (arr) => {
      const i = arr.findIndex((x) => x.id === rec.id);
      if (i >= 0) arr[i] = rec;
      else arr.push(rec);
    },
    "OS " + osNum(rec) + " salva",
    "OS " + osNum(rec) + ": " + rec.cliente,
  );
  if (os.some((o) => o.id === rec.id)) osMostrar(rec.id);
}
$("#os_addp").addEventListener("click", () => {
  osDraft.prods.push({ nome: "", qtd: 1, valor: 0 });
  osLinhas();
  osAtualizarTotais();
});
$("#os_adds").addEventListener("click", () => {
  osDraft.servs.push({ nome: "", modo: "hora", horas: 0, vh: 0, valor: 0 });
  osLinhas();
  osAtualizarTotais();
});
$("#os_save").addEventListener("click", osSalvar);
$("#os_cancel").addEventListener("click", () =>
  os.some((o) => o.id === osDraft.id) ? osMostrar(osDraft.id) : showOs(),
);
/* digitação no editor: atualiza o rascunho e os totais na hora */
$("#oseditor").addEventListener("input", (ev) => {
  const t = ev.target,
    row = t.closest(".osrow");
  if (row) {
    const it = (row.dataset.k === "p" ? osDraft.prods : osDraft.servs)[
      +row.dataset.i
    ];
    if (!it) return;
    if (t.classList.contains("o-nome")) {
      it.nome = t.value;
      // escolheu um serviço do cadastro: preenche cobrança e valor (só numa linha ainda sem valor)
      const cad =
        row.dataset.k === "s" && !it.vh && !it.valor && acharServico(t.value);
      if (cad) {
        Object.assign(it, {
          nome: cad.nome,
          modo: cad.modo,
          vh: cad.modo === "hora" ? cad.valor : 0,
          valor: cad.modo === "fixo" ? cad.valor : 0,
        });
        osLinhas();
        osAtualizarTotais();
        return;
      }
    } else if (t.classList.contains("o-qtd")) it.qtd = parseValor(t.value) || 0;
    else if (t.classList.contains("o-val")) it.valor = parseValor(t.value) || 0;
    else if (t.classList.contains("o-h")) it.horas = parseHoras(t.value);
    else if (t.classList.contains("o-vh")) it.vh = parseValor(t.value) || 0;
    else if (t.classList.contains("o-modo")) {
      it.modo = t.value;
      row.dataset.modo = t.value;
    }
    const tot = row.querySelector(".o-tot");
    if (tot)
      tot.textContent = brl(
        row.dataset.k === "p" ? r2(it.qtd * it.valor) : osServTotal(it),
      );
  } else {
    const map = {
      os_cliente: "cliente",
      os_tel: "tel",
      os_veic: "veiculo",
      os_placa: "placa",
      os_data: "data",
      os_num: "numero",
      os_status: "status",
      os_pag: "pagamento",
      os_obs: "obs",
    };
    if (map[t.id]) osDraft[map[t.id]] = t.value;
    else if (t.id === "os_desc") osDraft.desconto = parseValor(t.value) || 0;
  }
  osAtualizarTotais();
});
$("#oseditor").addEventListener("change", (ev) => {
  if (ev.target.matches("select"))
    ev.target.dispatchEvent(new Event("input", { bubbles: true }));
});
$("#oseditor").addEventListener("click", (ev) => {
  const b = ev.target.closest(".o-del");
  if (!b) return;
  const row = b.closest(".osrow");
  (row.dataset.k === "p" ? osDraft.prods : osDraft.servs).splice(
    +row.dataset.i,
    1,
  );
  osLinhas();
  osAtualizarTotais();
});
/** OS: adiciona um serviço escolhido do cadastro. */
$("#os_addcat").addEventListener("click", async () => {
  if (!catalogo.dados.length) {
    say(
      "Nenhum serviço cadastrado. Cadastre em Ordem de serviço → Cadastro de serviços.",
      true,
    );
    return;
  }
  const lista = catalogo.dados
    .slice()
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  const r = await askText({
    titulo: "📋 Escolha o serviço",
    semTexto: true,
    botoes: lista
      .map((s) => ({
        id: s.id,
        rotulo: esc(s.nome) + " · " + precoSvc(s),
        sec: true,
      }))
      .concat([{ id: "cancelar", rotulo: "Cancelar", sec: true }]),
  });
  const s = catalogo.dados.find((x) => x.id === r.acao);
  if (!s) return;
  osDraft.servs.push({
    nome: s.nome,
    modo: s.modo,
    horas: 0,
    vh: s.modo === "hora" ? s.valor : 0,
    valor: s.modo === "fixo" ? s.valor : 0,
  });
  osLinhas();
  osAtualizarTotais();
});
