# MDReader

> Editor de Markdown moderno, focado em privacidade, que roda inteiramente no navegador — sem instalação, sem servidores, sem rastreamento.

## Funcionalidades

- Editor baseado no Monaco Editor (o mesmo motor do VS Code) com realce de sintaxe Markdown completo
- Visualização em tempo real do resultado renderizado via Marked.js com blocos de código destacados pelo Prism.js
- Suporte a múltiplas abas para trabalhar em vários documentos simultaneamente
- Integração com a File System Access API para abrir e salvar arquivos diretamente no computador do usuário (Chrome, Edge e Opera)
- Temas claro e escuro com paletas OKLCH para máximo conforto visual
- Scroll sincronizado entre o painel do editor e o painel de preview
- Instalável como Progressive Web App (PWA) — funciona offline após a primeira visita
- Compartilhamento de documentos via URL (backend PHP gera um slug único)
- Exportação para HTML limpo
- Atalhos de teclado completos para todas as operações principais
- Barra de status com contagem de palavras e posição do cursor
- Sistema de notificações toast
- Dados 100% locais: nenhum arquivo é enviado a servidores externos

## Tecnologias

- Vanilla JavaScript (ES Modules, sem etapa de build)
- Monaco Editor (carregado via `monaco-loader.js` com AMD loader)
- Marked.js (renderização de Markdown)
- Prism.js (highlight de código no preview)
- DOMPurify (sanitização de HTML para segurança)
- FontAwesome 6 (ícones)
- CSS com variáveis OKLCH (sistema de temas)
- Service Worker (cache offline / PWA)
- PHP (backend opcional para compartilhamento via `api/save.php` e `api/load.php`)
- GitHub Actions (deploy automático via FTP ao fazer push na branch `main`)

## Pré-requisitos

- Um navegador moderno baseado em Chromium (Chrome, Edge ou Opera) para uso completo da File System Access API
- Para desenvolvimento local: qualquer servidor HTTP estático (Node.js `serve` ou Python `http.server`)
- Para o recurso de compartilhamento de documentos: servidor web com suporte a PHP
- Não há `package.json`, `node_modules` ou etapa de build — todas as bibliotecas externas são carregadas via CDN ou embutidas

## Instalação / Deploy

**Opção 1 — Uso local (sem instalação):**

Abra o arquivo `index.html` diretamente em um navegador. Para habilitar ES Modules, Service Worker e a File System Access API, sirva com um servidor HTTP local:

```bash
# Com Node.js
npx serve .

# Com Python
python -m http.server 8080
```

Acesse em `http://localhost:8080`.

**Opção 2 — Deploy em servidor web:**

Faça upload de todos os arquivos para o servidor. O deploy é automático via GitHub Actions ao fazer push na branch `main` (FTP deploy configurado em `.github/workflows/ftp-deploy.yml`).

O arquivo `version.json` é gerado automaticamente pelo GitHub Actions durante o deploy — não o crie ou commite manualmente.

**Forçar atualização do cache do Service Worker em desenvolvimento:**

Abra DevTools → Application → Service Workers → ative "Update on reload". Para invalidar o cache de usuários existentes em produção, incremente a constante de versão do cache em `sw.js` antes de fazer o deploy.

## Uso

**Abrir um arquivo local:**
- Pressione `Ctrl + O` ou use o botão de abertura de arquivo na interface
- O arquivo é lido diretamente do sistema de arquivos, sem upload

**Salvar:**
- `Ctrl + S` — salva no arquivo original (se aberto via File System Access API) ou faz download
- `Ctrl + Shift + S` — "Salvar como" (escolhe o local de destino)

**Gerenciar abas:**
- `Ctrl + T` — nova aba
- `Ctrl + W` — fechar aba atual
- `Ctrl + Tab` / `Ctrl + Shift + Tab` — navegar entre abas

**Compartilhar um documento:**
- Clique no botão de compartilhamento — o conteúdo é enviado ao servidor PHP e um link único é gerado
- O destinatário abre o link e o documento é carregado automaticamente

**Dicas de performance:**
- Mantenha menos de 10 abas abertas para melhor desempenho
- Desative o Scroll Sync em documentos muito longos se notar lentidão
- Use Chrome ou Edge para a melhor experiência com a File System Access API (Firefox e Safari não suportam essa API)

## Arquitetura

Aplicação de página única (SPA) sem framework ou bundler. O `index.html` é o único ponto de entrada.

```
MDReader/
  index.html              # Ponto de entrada da aplicação
  styles.css              # UI com variáveis OKLCH para temas
  monaco-loader.js        # Inicialização do Monaco (AMD loader)
  sw.js                   # Service Worker — cache offline / PWA
  manifest.json           # Configuração PWA
  src/
    app.js                # Bootstrap principal — conecta todos os módulos
    core/
      constants.js        # Constantes globais (atalhos, padrões)
      editor.js           # Inicialização e configuração do Monaco
      state.js            # Estado global (abas abertas, file handle ativo)
    features/
      autosave.js         # Auto-save (localStorage + File System Access API)
      files.js            # Abertura e salvamento de arquivos
      preview.js          # Renderização Markdown + scroll sincronizado
      sharing.js          # Compartilhamento via API PHP (save/load por slug)
      tabs.js             # Gerenciamento de abas
      theme.js            # Alternância claro/escuro (variáveis OKLCH)
    ui/
      setup.js            # Inicialização do DOM e binding de eventos
      statusBar.js        # Barra de status (contagem de palavras, cursor)
      toast.js            # Sistema de notificações toast
  api/
    save.php              # Backend PHP: salva documento e retorna slug
    load.php              # Backend PHP: carrega documento por slug
  documents/              # Documentos compartilhados gerados pelo servidor
                          # (*.md e *.json são gitignored)
```

**Fluxo de compartilhamento:** o usuário clica em compartilhar → `api/save.php` armazena o documento no servidor e retorna um slug UUID → uma URL compartilhável é gerada. Ao abrir a URL, `api/load.php?id=<slug>` recupera o documento.

**Privacidade:** todos os arquivos editados ficam exclusivamente no navegador do usuário. Configurações e abas abertas são persistidas no `localStorage`. Nenhum rastreamento, cookie ou analytics.

## Licença

MIT
