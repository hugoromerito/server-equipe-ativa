# Deploy no Heroku - Guia Completo

Este guia explica como fazer o deploy da API do Equipe Ativa no Heroku, migrando do Railway.

## Pré-requisitos

1. **Conta no Heroku**: [Criar conta gratuita](https://signup.heroku.com/)
2. **Heroku CLI**: [Instalar Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. **Git**: Repositório git configurado

## Passo a Passo do Deploy

### 1. Instalar e Configurar Heroku CLI

```bash
# Instalar Heroku CLI (macOS)
brew tap heroku/brew && brew install heroku

# Instalar Heroku CLI (Ubuntu/Debian)
curl https://cli-assets.heroku.com/install.sh | sh

# Login no Heroku
heroku login
```

### 2. Criar Aplicação no Heroku

```bash
# Navegar para o diretório do projeto
cd server-equipe-ativa

# Criar aplicação (substitua 'seu-app-name' por um nome único)
heroku create seu-app-name

# Ou usar nome automático
heroku create
```

### 3. Configurar Add-ons

```bash
# Adicionar PostgreSQL
heroku addons:create heroku-postgresql:essential-0

# Verificar add-ons instalados
heroku addons
```

### 4. Configurar Variáveis de Ambiente

```bash
# Configurar variáveis obrigatórias
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# AWS S3 (obrigatório para upload de arquivos)
heroku config:set AWS_ACCESS_KEY_ID=sua_access_key
heroku config:set AWS_SECRET_ACCESS_KEY=sua_secret_key
heroku config:set AWS_REGION=us-east-1
heroku config:set AWS_BUCKET_NAME=seu-bucket-name

# OpenAI (obrigatório para classificação AI)
heroku config:set OPENAI_API_KEY=sua_openai_key

# Google OAuth (obrigatório para autenticação)
heroku config:set GOOGLE_OAUTH_CLIENT_ID=seu_google_client_id
heroku config:set GOOGLE_OAUTH_CLIENT_SECRET=seu_google_client_secret
heroku config:set GOOGLE_OAUTH_CLIENT_REDIRECT_URI=https://seu-app-name.herokuapp.com/auth/google/callback

# Configurações opcionais
heroku config:set JWT_EXPIRES_IN=7d
heroku config:set MAX_FILE_SIZE=10485760
heroku config:set MAX_FILES_PER_UPLOAD=5

# Verificar variáveis configuradas
heroku config
```

### 5. Deploy da Aplicação

```bash
# Fazer deploy
git push heroku main

# Ou se estiver em outra branch
git push heroku sua-branch:main
```

### 6. Executar Migrações e Seed (Opcional)

```bash
# As migrações são executadas automaticamente no release
# Mas você pode executar manualmente se necessário
heroku run npm run db:migrate

# Executar seed do banco (opcional)
heroku run npm run db:seed
```

### 7. Verificar Deploy

```bash
# Abrir aplicação no browser
heroku open

# Ver logs em tempo real
heroku logs --tail

# Verificar status
heroku ps
```

## URLs Importantes

Após o deploy, sua API estará disponível em:

- **API Base**: `https://seu-app-name.herokuapp.com`
- **Documentação**: `https://seu-app-name.herokuapp.com/docs`
- **Health Check**: `https://seu-app-name.herokuapp.com/health`

## Configuração de Domínio Personalizado (Opcional)

```bash
# Adicionar domínio personalizado
heroku domains:add api.seudominio.com

# Verificar configuração DNS necessária
heroku domains
```

## Monitoramento e Logs

```bash
# Ver logs
heroku logs --tail

# Ver logs de um período específico
heroku logs --num 500

# Ver métricas
heroku ps:exec
```

## Troubleshooting

### Problemas Comuns

1. **Erro de Build**:
   ```bash
   # Ver logs detalhados do build
   heroku logs --tail
   ```

2. **Erro de Variáveis de Ambiente**:
   ```bash
   # Verificar todas as variáveis
   heroku config
   
   # Verificar se DATABASE_URL foi configurada automaticamente
   heroku config:get DATABASE_URL
   ```

3. **Erro de Conexão com Banco**:
   ```bash
   # Verificar status do PostgreSQL
   heroku pg:info
   
   # Conectar ao banco para debug
   heroku pg:psql
   ```

4. **Aplicação não inicia**:
   ```bash
   # Verificar processes
   heroku ps
   
   # Reiniciar aplicação
   heroku restart
   ```

### Debug Local com Configuração Heroku

```bash
# Executar localmente com configuração Heroku
heroku local web

# Ou com variáveis do Heroku
heroku config:get DATABASE_URL | xargs -I {} env DATABASE_URL={} npm run dev
```

## Migração do Railway

### Exportar Dados do Railway (se necessário)

1. **Backup do Banco de Dados**:
   ```bash
   # No Railway, fazer backup do PostgreSQL
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Importar para Heroku**:
   ```bash
   # Importar backup para Heroku
   heroku pg:psql < backup.sql
   ```

### Variáveis de Ambiente

Compare e migre todas as variáveis de ambiente do Railway para o Heroku usando o comando `heroku config:set`.

### Arquivos S3

Se você usar AWS S3, os arquivos permanecerão acessíveis. Apenas certifique-se de que as credenciais AWS estão configuradas corretamente no Heroku.

## Diferenças entre Railway e Heroku

| Aspecto | Railway | Heroku |
|---------|---------|---------|
| Arquivo de Config | `railway.toml` | `Procfile` + `app.json` |
| Build | Nixpacks automático | Buildpacks (Node.js) |
| Banco de Dados | PostgreSQL automático | Add-on heroku-postgresql |
| Variáveis de Ambiente | Interface web | CLI ou interface web |
| Deploy | Git push automático | Git push heroku main |
| Logs | Interface web | CLI heroku logs |

## Custos

- **Heroku Eco Dyno**: $5/mês (substitui o dyno gratuito)
- **PostgreSQL Essential**: $5/mês
- **Total mínimo**: ~$10/mês

## Próximos Passos

1. ✅ Configurar monitoramento
2. ✅ Configurar backups automáticos
3. ✅ Configurar CI/CD com GitHub Actions (opcional)
4. ✅ Configurar domínio personalizado
5. ✅ Otimizar performance

---

Para mais informações, consulte a [documentação oficial do Heroku](https://devcenter.heroku.com/).