# MDReader - Online Sharing Feature

Esta funcionalidade permite compartilhar documentos Markdown através de links únicos online.

## 🚀 Como Funciona

### Compartilhar um Documento

1. Crie ou abra um documento no MDReader
2. Clique no botão **"Share"** na barra de ferramentas
3. O documento será salvo no servidor
4. Um link único será copiado para sua área de transferência
5. Compartilhe esse link com outras pessoas

**Exemplos de links gerados:**
```
# Documento sem título (apenas ID)
https://seu-servidor.com/mdreader?doc=a3b5c7d9

# Documento com título (slug + ID)
https://seu-servidor.com/mdreader?doc=meu-documento-a3b5c7d9
https://seu-servidor.com/mdreader?doc=guia-markdown-k8x2p9z1
```

**Formato das URLs:**
- ✅ **Curtas e limpas:** IDs com apenas 8 caracteres alfanuméricos
- ✅ **Descritivas:** Incluem o título do documento quando disponível
- ✅ **Seguras:** Validação robusta contra directory traversal
- ✅ **Flexíveis:** Funcionam com ou sem slug

### Acessar um Documento Compartilhado

Qualquer pessoa com o link pode:
1. Colar o link no navegador
2. O documento será carregado automaticamente
3. Poderá visualizar e editar (as edições são locais, não afetam o original)

## 📁 Estrutura de Arquivos

```
MDReader/
├── api/
│   ├── save.php          # API para salvar documentos
│   └── load.php          # API para carregar documentos
├── documents/
│   ├── a3b5c7d9.md       # Conteúdo do documento (ID: 8 chars)
│   ├── a3b5c7d9.json     # Metadados (título, slug, data, etc.)
│   ├── k8x2p9z1.md       # Outro documento
│   ├── k8x2p9z1.json     # Seus metadados
│   ├── .htaccess         # Proteção de acesso direto
│   └── README.md         # Documentação do diretório
```

**Formato dos arquivos:**
- **ID:** 8 caracteres alfanuméricos (ex: `a3b5c7d9`)
- **Conteúdo:** `{id}.md` - arquivo Markdown
- **Metadados:** `{id}.json` - JSON com título, slug, data de criação, tamanho

## 🔧 Requisitos do Servidor

- **PHP 7.0+**
- **Apache** com mod_rewrite (ou Nginx equivalente)
- Permissões de escrita no diretório `documents/`

### Configuração de Permissões

```bash
# No servidor, execute:
chmod 755 api/
chmod 755 documents/
chmod 644 api/*.php
chmod 644 documents/.htaccess
```

## 🔒 Segurança

### Proteções Implementadas

1. **Limite de tamanho:** 5MB máximo por documento
2. **Validação de ID:** Previne directory traversal attacks
3. **Bloqueio de acesso direto:** `.htaccess` impede acesso direto aos arquivos
4. **Sanitização:** Títulos são sanitizados antes de salvar
5. **CORS configurado:** Permite uso em diferentes domínios

### Limitações de Segurança

⚠️ **IMPORTANTE:**

- **Links são públicos:** Qualquer um com o link pode acessar o documento
- **Sem autenticação:** Não há sistema de login
- **Sem edição colaborativa:** Mudanças de um usuário não aparecem para outros
- **Sem controle de versão:** Não há histórico de alterações

### Recomendações

Para ambientes de produção, considere adicionar:

- Sistema de autenticação
- Links com senha
- Expiração automática de documentos
- Rate limiting para evitar spam
- Captcha para prevenir bots

## 📊 API Endpoints

### POST /api/save.php

Salva um documento no servidor.

**Request:**
```json
{
  "content": "# Meu Documento\n\nConteúdo em Markdown...",
  "title": "Meu Documento"
}
```

**Response (sucesso):**
```json
{
  "success": true,
  "id": "a3b5c7d9",
  "slug": "meu-documento",
  "title": "Meu Documento.md",
  "created": "2026-01-12 10:30:45",
  "url": "https://seu-servidor.com/mdreader?doc=meu-documento-a3b5c7d9"
}
```

**Response (sucesso - sem título):**
```json
{
  "success": true,
  "id": "k8x2p9z1",
  "slug": "",
  "title": "Untitled",
  "created": "2026-01-12 10:35:22",
  "url": "https://seu-servidor.com/mdreader?doc=k8x2p9z1"
}
```

**Response (erro):**
```json
{
  "success": false,
  "error": "Content exceeds maximum size of 5MB"
}
```

### GET /api/load.php?id=DOC_PARAM

Carrega um documento pelo ID. Aceita formatos: `id` ou `slug-id`

**Exemplos de chamadas:**
```
/api/load.php?id=a3b5c7d9
/api/load.php?id=meu-documento-a3b5c7d9
```

**Response (sucesso):**
```json
{
  "success": true,
  "id": "a3b5c7d9",
  "content": "# Meu Documento\n\nConteúdo...",
  "title": "Meu Documento.md",
  "created": "2026-01-12 10:30:45",
  "size": 1234
}
```

**Response (erro - documento não encontrado):**
```json
{
  "success": false,
  "error": "Document not found"
}
```

## 🧹 Manutenção

### Limpeza Automática

Os documentos podem acumular no servidor. Para limpar documentos antigos:

**Script de limpeza (cron job):**
```bash
#!/bin/bash
# Remover documentos com mais de 30 dias
find /caminho/para/documents -name "doc_*" -mtime +30 -delete
```

**Adicionar ao crontab (executar diariamente às 3h):**
```bash
0 3 * * * /caminho/para/cleanup.sh
```

### Monitoramento de Espaço

```bash
# Verificar tamanho total do diretório
du -sh documents/

# Contar número de documentos
ls -1 documents/doc_*.md | wc -l
```

## 🐛 Troubleshooting

### Erro: "Failed to save document"

**Possíveis causas:**
- Permissões incorretas no diretório `documents/`
- Espaço em disco insuficiente
- PHP sem permissão de escrita

**Solução:**
```bash
chmod 755 documents/
chown www-data:www-data documents/
```

### Erro: "Document not found"

**Possíveis causas:**
- ID inválido ou documento foi deletado
- Problema com .htaccess bloqueando API

**Solução:**
- Verificar se o arquivo existe em `documents/`
- Verificar logs do servidor web

### Botão "Share" não funciona

**Possíveis causas:**
- API não está acessível (erro 404)
- CORS bloqueado
- JavaScript desabilitado

**Solução:**
- Verificar console do navegador (F12)
- Testar API diretamente: `curl -X POST http://seu-servidor/api/save.php -d '{"content":"test"}'`

## 💡 Melhorias Futuras

### Opção 2 - Intermediário
- [ ] Lista de documentos recentes
- [ ] Busca por título
- [ ] Preview de documentos antes de abrir
- [ ] Estatísticas de uso

### Opção 3 - Completo
- [ ] Sistema de autenticação
- [ ] Documentos privados/públicos
- [ ] Edição colaborativa em tempo real
- [ ] Histórico de versões
- [ ] Comentários e anotações
- [ ] Organização em pastas

## 📝 Exemplos de Uso

### Uso Básico
1. Escrever um documento
2. Clicar em "Share"
3. Enviar link por email/WhatsApp
4. Destinatário abre o link e vê o documento

### Caso de Uso: Apresentação
1. Criar apresentação em Markdown
2. Compartilhar com plateia antes da palestra
3. Todos podem acompanhar no próprio dispositivo

### Caso de Uso: Colaboração
1. Criar rascunho de documento
2. Compartilhar com colegas para feedback
3. Cada um pode fazer cópia local e editar
4. Compartilhar versões atualizadas

## 🔗 Links Relacionados

- [README principal](README.md)
- [Documentação do diretório documents](documents/README.md)
- [Guia de instalação](QUICKSTART.md)

---

**Desenvolvido para MDReader Web | Branch: feature/online-sharing**
