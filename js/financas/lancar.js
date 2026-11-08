/**
 * AXION · Finanças · Lançar notas
 *
 * Lança uma nota fiscal no financeiro (perfil e tipo à escolha) e oferece replicar a receita
 * em outro perfil.
 *
 * Depende de: financas/perfis.js, notas/lista.js
 */
"use strict";

/** Depois de lançar uma receita, oferece copiá-la para outro perfil (se houver mais de um). */
async function oferecerReplica(rec) {
  if (rec.tipo !== "entrada" || !fin.some((x) => x.id === rec.id)) return;
  const outros = perfis.dados.filter((p) => p.id !== rec.ledger);
  if (!outros.length) return;
  const r = await askText({
    titulo:
      "👤 Replicar em outro perfil? · " + rec.nome + " · " + brl(rec.valor),
    semTexto: true,
    botoes: outros
      .map((p) => ({
        id: p.id,
        rotulo: "👤 Replicar em " + esc(p.nome) + " (mesmo valor)",
      }))
      .concat([{ id: "nao", rotulo: "Não replicar", sec: true }]),
  });
  if (r.acao === "nao") return;
  const copia = Object.assign({}, rec, {
    id: novoId(),
    ledger: r.acao,
    criadoEm: Date.now(),
  });
  await finSync(
    (arr) => {
      arr.push(copia);
    },
    "Receita replicada em " + nomePerfil(r.acao),
    "Replicar em " + nomePerfil(r.acao) + ": " + rec.nome,
  );
}
/** Botão "Lançar" da nota; mostra onde ela já foi lançada. */
function lancarBadge(n) {
  if (n.status === "cancelada") return "";
  const onde = [];
  fin.forEach((x) => {
    if (x.notaId !== n.id) return;
    const t = nomePerfil(x.ledger) + (x.tipo === "despesa" ? " (despesa)" : "");
    if (onde.indexOf(t) < 0) onde.push(t);
  });
  return (
    '<button class="badge' +
    (onde.length ? " ok" : "") +
    '" data-lancar="' +
    esc(n.id) +
    '">' +
    (onde.length ? "✅ Lançada: " + esc(onde.join(", ")) : "💸 Lançar") +
    "</button>"
  );
}
/** Menu para lançar o valor da nota no financeiro (PJ ou PF, entrada ou despesa). */
async function lancarNota(id) {
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  const esc2 = await escolherPerfil(
    "💸 Lançar no financeiro · " + n.nome + " · " + n.d.v.op,
    ["entrada", "despesa"],
  );
  if (!esc2) return;
  const ledger = esc2.ledger,
    tipo = esc2.tipo;
  const rec = {
    id: novoId(),
    ledger: ledger,
    tipo: tipo,
    nome: "NFS-e " + n.nome,
    valor: vOf(n),
    data: isoDeBR(n.pagoEm) || hojeISO(),
    cat: tipo === "entrada" ? "Serviço" : "Outros",
    pago: tipo === "entrada" ? n.status === "recebida" : true,
    rec: false,
    notaId: n.id,
    criadoEm: Date.now(),
  };
  let dup = false;
  await finSync(
    (arr) => {
      if (
        arr.some(
          (x) => x.notaId === n.id && x.ledger === ledger && x.tipo === tipo,
        )
      )
        dup = true;
      else arr.push(rec);
    },
    "Nota lançada em " + nomePerfil(ledger) + " (" + tipo + ")",
    "Lançar " + n.nome + " em " + nomePerfil(ledger),
  );
  refreshList();
  if (dup) {
    say(
      "Esta nota já foi lançada em " +
        nomePerfil(ledger) +
        " como " +
        tipo +
        ".",
      true,
    );
    return;
  }
  finMes = rec.data.slice(0, 7);
  finLedger = ledger;
  await oferecerReplica(rec);
  refreshList();
}
$("#launchbtn").addEventListener("click", () => {
  if (!current) return;
  const id = noteName(current);
  if (!notes.some((x) => x.id === id)) {
    say("Aguarde a nota ser salva e tente de novo.", true);
    return;
  }
  lancarNota(id);
});
