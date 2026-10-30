# 🧾 NFS-e personalizada · AXION

**⚡ AXION | Sistemas Embarcados e Energia**

`🔒 Criptografia AES-256` · `📱 Funciona no celular` · `🆓 Sem servidor` · `🧾 Padrão DANFSe v2.0` · `📊 Relatórios e controle do MEI`

Ferramenta web que transforma o PDF da NFS-e (DANFSe) emitido no portal nacional em uma nota com a identidade visual da AXION, e ajuda a organizar as notas emitidas: histórico, recebimentos, relatórios e controle do limite anual do MEI.

Funciona direto no navegador do celular ou do computador, sem servidor próprio e sem instalação.

🌐 **Acesse:** https://dev-filipealves.github.io/nfse-axion/

---

## 📑 Sumário

- [✨ O que a ferramenta faz](#-o-que-a-ferramenta-faz)
- [🚀 Como usar](#-como-usar)
- [🔒 Segurança e privacidade](#-segurança-e-privacidade)
- [🚧 Limitações e avisos importantes](#-limitações-e-avisos-importantes)
- [🌐 Como publicar o seu próprio site](#-como-publicar-o-seu-próprio-site)
- [🔗 Como ligar o banco de notas no GitHub](#-como-ligar-o-banco-de-notas-no-github)
- [📁 Estrutura do projeto](#-estrutura-do-projeto)
- [🧰 Tecnologias](#-tecnologias)

---

## ✨ O que a ferramenta faz

### 🧾 Nota personalizada
- 📥 Lê o PDF do DANFSe (padrão nacional) e extrai os dados da nota.
- 🎨 Monta a nota com o layout e a logo da AXION, mantendo as informações obrigatórias: identificação, chave de acesso, prestador, tomador, serviço, tributação, valores e informações complementares.
- 🏷 Inclui o nome fantasia da empresa no bloco do prestador.
- 📱 Gera um **QR Code que abre a consulta pública do portal nacional** já com a chave de acesso da nota.
- 📄 Exporta a nota em **PDF** (A4).

### 💾 Banco de notas
- 💾 Cada nota enviada é salva automaticamente com o nome `número-DDMMAAAA-CLIENTE` (cliente cortado em 10 letras). Exemplo: `01-26102026-OUTSIDEVEI`.
- ☁ Notas guardadas neste aparelho ou em um **repositório privado do GitHub**, que funciona como banco de dados (arquivo `notas.json`).
- 🕒 **Indicador de última sincronização** no rodapé, com data e horário. Se a sincronização falhar, o aviso fica amarelo e mostra a última que deu certo.
- 🏷 **Versão automática** no rodapé (`1.0.N`), calculada a partir dos envios feitos ao repositório.
- Tela **📚 Minhas notas** com busca por número, data, cliente ou **valor**.
- 🔁 Qualquer nota pode ser reaberta e baixada em PDF novamente.
- 🧩 Notas com o mesmo número, data e cliente são atualizadas, sem duplicar.
- 📎 Guarda também o **PDF original** do portal (pasta `pdfs/` do repositório privado) para consulta posterior.

### 💰 Controle financeiro
- ✅ **Status de recebimento:** cada nota fica como "A receber" ou "Recebida", com a data do recebimento.
- 🔎 **Filtros** por status e **total da busca** (soma das notas exibidas).
- 📈 **Painel do limite anual do MEI:** faturamento do mês e do ano, com barra de progresso que muda de cor ao passar de 80% e de 100% do limite.

### 📊 Relatórios
- 🗓 Período à escolha: este mês, mês anterior, este ano, ano anterior ou todo o período.
- 🧮 Resumo com notas emitidas, total faturado, recebido e a receber.
- 👥 **Resumo por cliente**, com quantidade de notas, valor e porcentagem do total.
- 📤 Exportação em **CSV** (abre no Excel, separador ponto e vírgula) e em **PDF**.

---

## 🚀 Como usar

1. Baixe o DANFSe (PDF) no portal nacional da NFS-e.
2. Abra a ferramenta e toque em **Enviar NFS-e (PDF)**.
3. Confira a nota gerada e toque em **Baixar PDF**.
4. Use **Minhas notas** para consultar, buscar e marcar recebimentos, e **Relatórios** para fechar o mês ou o ano.
5. O botão **← Voltar** limpa a tela e volta ao início. A engrenagem **⚙️** abre a configuração do GitHub.

---

## 🔒 Segurança e privacidade

A ferramenta foi pensada para que dados de clientes e credenciais **não fiquem expostos**.

| 🛡 Tema | Como é tratado |
| --- | --- |
| 📄 **Processamento do PDF** | A leitura é feita **no próprio navegador**. O PDF não passa por servidor nenhum da AXION. |
| 🌍 **Site público, dados privados** | O código do site é público, mas **não contém token, notas nem dados de clientes**. Quem abre o site ou lê o código-fonte não encontra nada sensível. |
| 🗄 **Banco de notas** | Fica em um **repositório privado e separado** do site. Não use o repositório do site (público) para guardar notas. |
| 🔑 **Token do GitHub** | Criptografado com a senha do usuário usando **AES-256-GCM**, com chave derivada por **PBKDF2-SHA256 (600 mil iterações)** e salt e IV aleatórios. O token nunca é gravado em texto puro. |
| 🧠 **Senha** | **Não é guardada em lugar nenhum**, nem o hash dela. Ela só serve para abrir o token. Senha errada simplesmente falha na descriptografia, com limite de 5 tentativas por vez. |
| ⏳ **Bloqueio automático** | O token liberado fica só na memória e é descartado após **10 minutos sem uso** ou ao recarregar a página. |
| 🧹 **Cache local** | Com a senha ativa, as notas **não ficam guardadas no navegador**, apenas no repositório privado. |
| 🎯 **Escopo do token** | Recomenda-se um *fine-grained token* limitado ao repositório do banco, com permissão **Contents: Read and write** e validade definida. Em caso de perda do aparelho, basta apagar o token no GitHub. |
| 📡 **Comunicação** | Todo o tráfego com o GitHub usa HTTPS e vai diretamente do navegador para `api.github.com`. |
| 📦 **Bibliotecas externas** | Carregadas do jsDelivr com **versão fixa** e **Subresource Integrity (SRI, SHA-384)**: se o arquivo for adulterado no servidor, o navegador **bloqueia** o carregamento. |
| 🛡 **Content Security Policy (CSP)** | O `index.html` define uma política que só permite scripts do próprio site e do jsDelivr, conexões apenas com o próprio site e com `api.github.com`, e bloqueia objetos, formulários e a alteração do endereço-base da página. |

### ✅ Boas práticas recomendadas
- 🔐 Use uma senha de **8 caracteres ou mais**, sem datas ou nomes.
- 🔒 Mantenha o repositório do banco como **privado**.
- 🎫 Gere um token por aparelho e defina uma data de validade.
- 🔄 Mantenha o navegador e o sistema do celular atualizados e use bloqueio de tela.

---

## 🚧 Limitações e avisos importantes

- ⚖ **Não substitui a NFS-e oficial.** A validade fiscal é do documento emitido no portal nacional. Esta ferramenta apenas gera uma apresentação personalizada. O rodapé da nota informa que a autenticidade deve ser conferida no portal pela chave de acesso.
- 🔗 **QR Code de consulta:** usa o formato `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=…`, o mesmo adotado por bibliotecas que reproduzem o modelo oficial do DANFSe. Se o portal mudar o formato, o link pode precisar de ajuste.
- 📉 **Limite do MEI:** o painel usa **R$ 81.000** por ano (valor vigente em 2026) e não faz o ajuste proporcional para quem abriu o MEI no meio do ano. O valor fica na constante `LIMITE_MEI`, no arquivo `app.js`, e deve ser atualizado se a lei mudar.
- ➕ **Totais:** consideram apenas as notas salvas na ferramenta.
- 🔑 **Senha sem recuperação:** quem esquecer a senha precisa gerar um novo token no GitHub e configurar de novo. As notas continuam no repositório.
- 🌐 **Cada navegador tem a sua configuração:** ao trocar de aparelho ou de navegador, é preciso configurar o GitHub novamente.
- 📶 **Dependência de bibliotecas externas:** a leitura de PDF, o QR Code e a geração de PDF dependem de arquivos carregados de um CDN público (jsDelivr), então é necessário ter internet.
- 📄 A leitura do PDF depende do padrão atual do DANFSe v2.0. Se o layout oficial mudar, a leitura pode precisar de ajuste.

---

## 🌐 Como publicar o seu próprio site

1. Crie um repositório e envie os 5 arquivos na raiz: `index.html`, `styles.css`, `app.js`, `logo.js` e `version.js`.
2. No repositório, abra **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`, e salve.
4. Aguarde cerca de 1 a 2 minutos. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

> 💡 O nome do arquivo principal precisa ser exatamente `index.html`, em minúsculas.

---

## 🔗 Como ligar o banco de notas no GitHub

1. **Crie um repositório privado** só para os dados, por exemplo `nfse-dados`.
2. Em **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**, gere um token com:
   - *Repository access:* apenas o repositório do banco;
   - *Permissions → Contents:* **Read and write**;
   - uma data de validade.
3. Copie o token pelo ícone de copiar (ele só é exibido uma vez).
4. Na ferramenta, toque em **⚙️** e preencha:
   - repositório no formato `usuario/nome` (ex.: `meu-usuario/nfse-dados`);
   - o token;
   - uma senha e a confirmação.
5. Toque em **Salvar e testar**. Quando aparecer a confirmação de conexão, as próximas notas já serão guardadas no repositório.

O arquivo `notas.json` e a pasta `pdfs/` são criados automaticamente.

---

## 📁 Estrutura do projeto

```
├── index.html   # estrutura da página
├── styles.css   # identidade visual e layout (com tema claro e escuro)
├── app.js       # lógica da aplicação (comentada)
├── logo.js      # logo da AXION embutida
└── version.js   # versão automática do rodapé (1.0.N)
```

---

## 🧰 Tecnologias

- 🧱 HTML, CSS e JavaScript puros, sem etapa de compilação e sem servidor.
- 📄 [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174: leitura do PDF do DANFSe.
- 🔳 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4: geração do QR Code.
- 🖨 [html2canvas](https://html2canvas.hertzen.com/) 1.4.1 e [jsPDF](https://github.com/parallax/jsPDF) 2.5.1: geração dos PDFs.
- 🔐 Web Crypto API (PBKDF2 e AES-GCM): proteção do token.
- 🐙 API de conteúdo do GitHub: banco de notas e armazenamento dos PDFs originais.
- 🔏 CSP e SRI para controlar o que o navegador executa.
- ✨ Código formatado com [Prettier](https://prettier.io/).

---

<sub>Projeto de uso próprio da AXION | Sistemas Embarcados e Energia.</sub>
