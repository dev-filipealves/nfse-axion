# Instruções do projeto (nfse-axion)

## Commits e envios ao GitHub
- Todo commit tem um **título curto e resumido** (até ~50 caracteres), no formato `Área: o que mudou`.
  - Exemplos: `OS: quadro do cliente`, `Desempenho: rolagem no celular`, `Notas: leitura do modelo do app`.
- Detalhes, se necessários, vão na descrição do commit (abaixo do título), nunca no título.
- Escreva os títulos em português.

## Estrutura do código
- Site estático sem compilação. `index.html` carrega `css/*.css` e `js/**/*.js` **em ordem**; não mude a ordem sem conferir as dependências (cada arquivo usa os anteriores; `js/app/main.js` é o último).
- Mapa “onde mexer” e árvore de arquivos: seção **Estrutura do projeto** do `README.md`.
- Valores fixos (empresa, limite do MEI, categorias, nomes de arquivos e chaves) ficam só em `js/base/config.js`.
- Cada arquivo começa com um cabeçalho (o que faz e do que depende); cada função tem um comentário `/** … */` de uma linha.
- CSS: do geral ao específico (`base → componentes → layout → painel → nota → financas → os → responsivo`). Regras do documento da nota ficam limitadas a `#paper` (a classe `.sec` também é usada nos botões).
- CSP no `index.html`: nada de `<script>` ou `onclick` dentro do HTML.

## Ao publicar
- Troque o número da publicação (ex.: `2026-11-08.1`) em `index.html` (todos os `?v=`), `js/base/config.js` e `js/app/versao.js`.
- Formate com Prettier (configuração padrão) antes do commit.
- Rode os testes (`cd testes && npm test`) e só publique com todos aprovados; funções novas ganham teste em `testes/`.
