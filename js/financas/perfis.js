/**
 * AXION · Finanças · Perfis
 *
 * Perfis financeiros (perfis.json): criar, renomear, excluir, tela “Meus perfis” e o menu para
 * escolher o perfil de um lançamento.
 *
 * Depende de: financas/banco.js
 */
"use strict";

const perfis = criarBanco(PERFIS_PATH, LS_PERFIS, () => {
  renderPerfis();
  renderFin();
  renderHome();
});
/** Nome de um perfil a partir do id. */
function nomePerfil(id) {
  const p = perfis.dados.find((x) => x.id === id);
  return p ? p.nome : id === "PF" ? "Filipe" : String(id || "");
}
/** Nome do perfil sem acentos e espaços, para nomes de arquivo. */
const slugPerfil = (id) =>
  nomePerfil(id)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "perfil";
/**
 * Primeira vez: cria o perfil "Filipe" (no lugar do antigo PF, mantendo os lançamentos).
 * O antigo PJ só vira perfil se tiver lançamentos, para nada se perder.
 */
async function prepararPerfis() {
  if (perfis.dados.length) return;
  const novos = [{ id: "PF", nome: "Filipe", criadoEm: Date.now() }];
  if (fin.some((x) => x.ledger === "PJ"))
    novos.push({ id: "PJ", nome: "PJ", criadoEm: Date.now() });
  await perfis.sync(
    (arr) => {
      if (!arr.length) novos.forEach((n) => arr.push(n));
    },
    "Perfis financeiros criados",
    "Finanças: perfis iniciais",
  );
}
/** Garante financeiro e perfis carregados (pede a senha se preciso). */
async function prepararFinancas() {
  if (isProt() && !(await ensureUnlocked())) {
    say("🔒 Senha necessária para usar as finanças.", true);
    return false;
  }
  const c = cfg();
  if (c.repo && c.token && !perfis.carregado) {
    try {
      await finLoad();
      persistFin();
      await perfis.load();
      perfis.persist();
    } catch (e) {
      say(
        "⚠️ Não consegui carregar os perfis: " + ((e && e.message) || e),
        true,
      );
      return false;
    }
  }
  await prepararPerfis();
  return perfis.dados.length > 0;
}
/** Menu para escolher o perfil (e o tipo) do lançamento. Devolve { ledger, tipo } ou null. */
async function escolherPerfil(titulo, tipos) {
  if (!(await prepararFinancas())) return null;
  const botoes = [];
  tipos.forEach((t) =>
    perfis.dados.forEach((p) =>
      botoes.push({
        id: p.id + "|" + t,
        rotulo:
          (t === "entrada" ? "💰 " : "💸 ") +
          esc(p.nome) +
          " · " +
          (t === "entrada" ? "Entrada (receita)" : "Despesa"),
        sec: t !== "entrada",
      }),
    ),
  );
  botoes.push({ id: "cancelar", rotulo: "Cancelar", sec: true });
  const r = await askText({ titulo: titulo, semTexto: true, botoes: botoes });
  if (r.acao === "cancelar") return null;
  const i = r.acao.lastIndexOf("|");
  return { ledger: r.acao.slice(0, i), tipo: r.acao.slice(i + 1) };
}
/** Desenha os cartões dos perfis com o resumo do mês atual. */
function renderPerfis() {
  const box = $("#perfis_list");
  if (!box || $("#finperfis").hidden) return;
  const mk = mesKey(new Date());
  box.innerHTML = perfis.dados.length
    ? perfis.dados
        .map((p) => {
          const itens = fin.filter(
            (x) => x.ledger === p.id && String(x.data).slice(0, 7) === mk,
          );
          const T = totaisFin(itens),
            id = esc(p.id);
          return (
            '<div class="pcard" data-perfil="' +
            id +
            '"><div class="pc-top"><span class="av">' +
            esc(inicial(p.nome)) +
            '</span><div class="pc-name"><b>' +
            esc(p.nome) +
            "</b><small>" +
            nomeMes(mk) +
            " · " +
            itens.length +
            " lançamento(s)</small></div>" +
            '<button class="x" data-prename="' +
            id +
            '" aria-label="Renomear perfil">✏️</button>' +
            '<button class="x" data-pdel="' +
            id +
            '" aria-label="Excluir perfil">🗑</button></div>' +
            '<div class="fcards"><div class="fcard"><span>💰 Entradas</span><b>' +
            brl(T.e) +
            "</b></div>" +
            '<div class="fcard"><span>💸 Despesas</span><b>' +
            brl(T.d) +
            "</b></div>" +
            '<div class="fcard ' +
            (T.saldo >= 0 ? "pos" : "neg") +
            '"><span>Saldo</span><b>' +
            brl(T.saldo) +
            "</b></div></div>" +
            (T.aPagar > 0
              ? '<div class="small">⏳ A pagar: <b>' +
                brl(T.aPagar) +
                "</b></div>"
              : "") +
            "</div>"
          );
        })
        .join("")
    : '<div class="small">Nenhum perfil ainda. Toque em “Criar perfil financeiro”.</div>';
}
/** Pede um nome de perfil e confere se não está vazio nem repetido. */
async function pedirNomePerfil(titulo, atual, idAtual) {
  const r = await askText({
    titulo: titulo,
    texto: atual || "",
    placeholder: "Ex.: Filipe, Ari, Empresa",
    botoes: [
      { id: "ok", rotulo: "Salvar" },
      { id: "cancelar", rotulo: "Cancelar", sec: true },
    ],
  });
  if (r.acao !== "ok") return null;
  const nome = r.texto.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!nome) {
    say("Digite um nome para o perfil.", true);
    return null;
  }
  if (
    perfis.dados.some(
      (p) =>
        p.id !== idAtual &&
        p.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"),
    )
  ) {
    say("Já existe um perfil chamado " + nome + ".", true);
    return null;
  }
  return nome;
}
$("#perfil_new").addEventListener("click", async () => {
  if (!(await prepararFinancas())) return;
  const nome = await pedirNomePerfil("➕ Novo perfil financeiro");
  if (!nome) return;
  await perfis.sync(
    (arr) => {
      arr.push({ id: novoId(), nome: nome, criadoEm: Date.now() });
    },
    "Perfil " + nome + " criado",
    "Finanças: novo perfil " + nome,
  );
});
$("#perfis_list").addEventListener("click", async (ev) => {
  const rn = ev.target.closest("[data-prename]");
  if (rn) {
    ev.stopPropagation();
    const id = rn.getAttribute("data-prename"),
      p = perfis.dados.find((x) => x.id === id);
    if (!p) return;
    const nome = await pedirNomePerfil("✏️ Renomear perfil", p.nome, id);
    if (nome && nome !== p.nome)
      await perfis.sync(
        (arr) => {
          const x = arr.find((y) => y.id === id);
          if (x) x.nome = nome;
        },
        "Perfil renomeado para " + nome,
        "Finanças: renomear perfil",
      );
    return;
  }
  const dl = ev.target.closest("[data-pdel]");
  if (dl) {
    ev.stopPropagation();
    const id = dl.getAttribute("data-pdel"),
      p = perfis.dados.find((x) => x.id === id);
    if (!p) return;
    const n = fin.filter((x) => x.ledger === id).length;
    let ok = true;
    try {
      ok = confirm(
        'Excluir o perfil "' +
          p.nome +
          '"' +
          (n ? " e os seus " + n + " lançamento(s)" : "") +
          "? Isso não pode ser desfeito.",
      );
    } catch (e) {}
    if (!ok) return;
    if (n) {
      const okFin = await finSync(
        (arr) => {
          for (let i = arr.length - 1; i >= 0; i--)
            if (arr[i].ledger === id) arr.splice(i, 1);
        },
        "Lançamentos do perfil excluídos",
        "Finanças: excluir lançamentos de " + p.nome,
      );
      if (!okFin) return;
    }
    await perfis.sync(
      (arr) => {
        const i = arr.findIndex((y) => y.id === id);
        if (i >= 0) arr.splice(i, 1);
      },
      "Perfil " + p.nome + " excluído",
      "Finanças: excluir perfil " + p.nome,
    );
    return;
  }
  const pc = ev.target.closest("[data-perfil]");
  if (pc) showFin(pc.getAttribute("data-perfil"));
});
