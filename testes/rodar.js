/**
 * AXION · Testes · Executar tudo
 *
 * Uso (dentro da pasta testes/):  npm install  →  npx playwright install chromium  →  npm test
 * Para rodar só um grupo:  node rodar.js seguranca   (funcional, seguranca, estabilidade, desempenho)
 *
 * Depende de: testes/apoio.js e os arquivos de cada grupo
 */
"use strict";

const A = require("./apoio");

const GRUPOS = ["funcional", "seguranca", "estabilidade", "desempenho"];

(async () => {
  const pedidos = process.argv.slice(2).filter((g) => GRUPOS.includes(g));
  const site = await A.servidor();
  const inicio = Date.now();
  for (const g of pedidos.length ? pedidos : GRUPOS) {
    try {
      await require("./" + g)(site);
    } catch (e) {
      A.confere(
        "Grupo " + g + " terminou sem exceção",
        false,
        String((e && e.stack) || e)
          .split("\n")
          .slice(0, 3)
          .join(" "),
      );
    }
  }
  site.fechar();
  const falhas = A.resultados.filter((r) => !r.ok);
  console.log(
    "\n" +
      (falhas.length ? "❌ " : "✅ ") +
      (A.resultados.length - falhas.length) +
      " de " +
      A.resultados.length +
      " verificações aprovadas em " +
      Math.round((Date.now() - inicio) / 1000) +
      " s",
  );
  falhas.forEach((f) =>
    console.log(
      "   ❌ [" +
        f.grupo +
        "] " +
        f.nome +
        (f.detalhe ? " — " + f.detalhe : ""),
    ),
  );
  process.exit(falhas.length ? 1 : 0);
})();
