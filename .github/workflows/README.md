# GitHub Actions - Deploy Automático

Este diretório contém os workflows do GitHub Actions para deploy automático do MDReader.

## Workflow: FTP Deploy

O workflow `ftp-deploy.yml` faz deploy automático via FTP para os ambientes de produção e desenvolvimento.

### Ambientes

- **Produção** (branch `main`): `/www/md.zaiden.eng.br`
- **Desenvolvimento** (branch `develop`): `/www/md-dev.zaiden.eng.br`

### Configuração dos Secrets

Para que o deploy funcione, você precisa configurar os seguintes secrets no GitHub:

1. Acesse o repositório no GitHub
2. Vá em **Settings** > **Secrets and variables** > **Actions**
3. Clique em **New repository secret**
4. Adicione os seguintes secrets:

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `FTP_SERVER` | Endereço do servidor FTP | `ftp.zaiden.eng.br` |
| `FTP_USERNAME` | Usuário FTP | `seu-usuario` |
| `FTP_PASSWORD` | Senha FTP | `sua-senha-segura` |

### Como Funciona

1. **Trigger**: O workflow é executado automaticamente quando há um push para `main` ou `develop`
2. **Checkout**: Baixa o código do repositório
3. **Define ambiente**: Determina o ambiente (produção/desenvolvimento) baseado na branch
4. **Gera version.json**: Cria arquivo com informações do deploy (versão, commit, data, etc.)
5. **Deploy FTP**: Envia os arquivos para o servidor via FTP
6. **Resumo**: Exibe informações do deploy concluído

### Arquivos Excluídos do Deploy

Os seguintes arquivos/pastas NÃO são enviados ao servidor:

- `.git*` - Arquivos do Git
- `node_modules/` - Dependências Node.js (se houver)
- `.github/` - Workflows do GitHub Actions
- `tests/` - Testes automatizados
- `*.md` - Arquivos markdown (README, CLAUDE.md, etc.)
- `.gitignore`
- `deploy-info/` - Logs locais de deploy
- `.vscode/` - Configurações do VS Code
- `.editorconfig`

### Arquivo version.json

Após cada deploy, um arquivo `version.json` é criado na raiz do projeto com as seguintes informações:

```json
{
  "version": "2026.01.19-123045",
  "commit": "abc123def456...",
  "branch": "main",
  "deployed_at": "2026-01-19T12:30:45Z",
  "deployed_by": "usuario-github",
  "environment": "Produção"
}
```

Você pode usar este arquivo para exibir informações de versão no app.

### Testando o Deploy

1. Faça um commit em uma branch local
2. Crie a branch `develop` se ainda não existir:
   ```bash
   git checkout -b develop
   git push origin develop
   ```
3. Faça um push para testar o deploy em desenvolvimento:
   ```bash
   git push origin develop
   ```
4. Acesse a aba **Actions** no GitHub para ver o progresso
5. Após o deploy, acesse `https://md-dev.zaiden.eng.br` para verificar

### Deploy para Produção

Para fazer deploy em produção:

```bash
git checkout main
git merge develop
git push origin main
```

Ou crie um Pull Request de `develop` para `main` e faça merge.

### Troubleshooting

Se o deploy falhar, verifique:

1. **Secrets configurados corretamente**: Vá em Settings > Secrets and variables > Actions
2. **Servidor FTP acessível**: Teste a conexão FTP manualmente
3. **Permissões de pasta**: Certifique-se que o usuário FTP tem permissão de escrita nas pastas de destino
4. **Logs do Actions**: Veja os logs detalhados na aba Actions do GitHub

### Executar Deploy Manual

Você pode executar o workflow manualmente:

1. Vá em **Actions** no GitHub
2. Selecione **Deploy FTP Automático**
3. Clique em **Run workflow**
4. Escolha a branch (main ou develop)
5. Clique em **Run workflow**
