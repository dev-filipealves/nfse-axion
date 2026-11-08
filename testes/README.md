# 🧪 Testes automáticos

Abrem o site num navegador de verdade (Chromium, via Playwright) e conferem tudo sozinhos.
Usam **dados inventados** e um **GitHub falso** em memória: nenhum dado real é lido ou enviado.

## Rodar

**No GitHub (automático):** a cada envio para `main`, a aba **Actions** roda tudo e marca o commit com ✅ ou ❌.
Também dá para rodar na mão em **Actions › Testes › Run workflow**.

**No computador** (precisa do Node.js 20+):

```bash
cd testes
npm install
npx playwright install chromium
npm test                     # tudo
node rodar.js seguranca      # só um grupo: funcional | seguranca | estabilidade | desempenho
```

## O que é testado

| Arquivo           | O que confere                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `funcional.js`    | Pix da OS e da cobrança (CRC, chave CNPJ e valor válidos; botão copiar), garantia (em garantia / fora da garantia / começa ao concluir), placa (maiúsculas, lista, busca), checklist de entrada e OS antigas sem esses campos.                                                                                                                    |
| `seguranca.js`    | Token só criptografado (nunca em texto puro), senha não guardada, senha errada e limite de 5 tentativas, bloqueio automático em 10 min, sem cópia dos dados com senha, token só no cabeçalho para `api.github.com`, textos maliciosos (XSS) em todas as telas, CSP (script injetado, eval, outro site) e SRI (biblioteca adulterada é bloqueada). |
| `estabilidade.js` | Dados corrompidos no aparelho, GitHub com erro 401/403/500, JSON inválido, sem internet, sem resposta, conflito 409 entre aparelhos (sem perder dados), bibliotecas do CDN fora do ar e 600 toques aleatórios (celular e computador).                                                                                                             |
| `desempenho.js`   | Abertura do site, tamanho baixado e velocidade das telas com 1000 notas, 500 OS, 2000 lançamentos e 300 serviços num celular simulado 4× mais lento; travadas na rolagem.                                                                                                                                                                         |

`apoio.js` tem as peças comuns (servidor local, navegador, GitHub falso e dados de exemplo).
