/**
 * Versão automática do rodapé: 1.0.N
 * N = BASE + (envios ao GitHub feitos depois de RELEASE_DATE, menos o primeiro).
 * O primeiro envio depois da data é a própria publicação desta versão (BASE).
 * Se o GitHub não responder, mostra a última versão conhecida ou a fixa do rodapé.
 */
(function () {
  "use strict";
  var BASE = 20;
  var RELEASE_DATE = "2026-10-29T22:31:37Z";
  var CACHE_KEY = "axion_versao";
  var CACHE_MS = 10 * 60 * 1000; // consulta o GitHub no máximo a cada 10 min
  var el = document.getElementById("appVersion");
  if (!el || !window.fetch) return;

  function mostrar(versao) {
    el.textContent = "v" + versao;
  }
  function lerCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }
  function gravarCache(versao) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ v: versao, t: Date.now() }),
      );
    } catch (e) {}
  }

  // Só funciona em GitHub Pages: usuario.github.io/repositorio/
  var partes = location.pathname.split("/").filter(Boolean);
  if (!/\.github\.io$/.test(location.hostname) || !partes[0]) {
    var antigo = lerCache();
    if (antigo) mostrar(antigo.v);
    return;
  }
  var dono = location.hostname.split(".")[0];
  var repo = partes[0];

  var cache = lerCache();
  if (cache) mostrar(cache.v);
  if (cache && Date.now() - cache.t < CACHE_MS) return;

  var url =
    "https://api.github.com/repos/" +
    dono +
    "/" +
    repo +
    "/commits?per_page=1&since=" +
    encodeURIComponent(RELEASE_DATE);
  fetch(url, { headers: { Accept: "application/vnd.github+json" } })
    .then(function (r) {
      if (!r.ok) throw new Error("GitHub " + r.status);
      var link = r.headers.get("Link");
      var m = link && link.match(/[?&]page=(\d+)>;\s*rel="last"/);
      if (m) return parseInt(m[1], 10);
      return r.json().then(function (lista) {
        return lista.length;
      });
    })
    .then(function (envios) {
      var versao = "1.0." + (BASE + Math.max(0, envios - 1));
      mostrar(versao);
      gravarCache(versao);
    })
    .catch(function () {
      /* sem internet ou limite de consultas: mantém o que já está na tela */
    });
})();
