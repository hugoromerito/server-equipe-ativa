#!/bin/bash

# Script para deploy no Heroku
# Uso: ./deploy-heroku.sh [app-name]

set -e

APP_NAME=${1:-""}
REQUIRED_VARS=(
    "JWT_SECRET"
    "AWS_ACCESS_KEY_ID" 
    "AWS_SECRET_ACCESS_KEY"
    "AWS_BUCKET_NAME"
    "OPENAI_API_KEY"
    "GOOGLE_OAUTH_CLIENT_ID"
    "GOOGLE_OAUTH_CLIENT_SECRET"
)

echo "🚀 Iniciando deploy no Heroku..."

# Verificar se Heroku CLI está instalado
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI não encontrado. Instale: https://cli.heroku.com/"
    exit 1
fi

# Verificar se está logado no Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Não está logado no Heroku. Execute: heroku login"
    exit 1
fi

# Criar app se nome foi fornecido
if [ ! -z "$APP_NAME" ]; then
    echo "📱 Criando aplicação: $APP_NAME"
    heroku create $APP_NAME || echo "App já existe ou nome não disponível"
    heroku git:remote -a $APP_NAME
fi

# Verificar se tem remote heroku
if ! git remote get-url heroku &> /dev/null; then
    echo "❌ Remote heroku não encontrado. Execute: heroku git:remote -a seu-app-name"
    exit 1
fi

# Adicionar PostgreSQL se não existir
echo "🗄️  Configurando PostgreSQL..."
heroku addons:create heroku-postgresql:essential-0 || echo "PostgreSQL já existe"

# Configurar variáveis de ambiente básicas
echo "⚙️  Configurando variáveis de ambiente..."
heroku config:set NODE_ENV=production
heroku config:set AWS_REGION=us-east-1
heroku config:set JWT_EXPIRES_IN=7d
heroku config:set MAX_FILE_SIZE=10485760
heroku config:set MAX_FILES_PER_UPLOAD=5

# Verificar variáveis obrigatórias
echo "🔍 Verificando variáveis obrigatórias..."
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! heroku config:get $var &> /dev/null || [ -z "$(heroku config:get $var)" ]; then
        MISSING_VARS+=($var)
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Variáveis obrigatórias não configuradas:"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Configure com: heroku config:set VARIAVEL=valor"
    echo ""
    echo "Exemplo:"
    echo "heroku config:set JWT_SECRET=\$(openssl rand -base64 32)"
    echo "heroku config:set AWS_ACCESS_KEY_ID=sua_access_key"
    echo "heroku config:set AWS_SECRET_ACCESS_KEY=sua_secret_key"
    echo "heroku config:set AWS_BUCKET_NAME=seu-bucket"
    echo "heroku config:set OPENAI_API_KEY=sua_openai_key"
    echo "heroku config:set GOOGLE_OAUTH_CLIENT_ID=seu_google_client_id"
    echo "heroku config:set GOOGLE_OAUTH_CLIENT_SECRET=seu_google_client_secret"
    exit 1
fi

# Fazer deploy
echo "🚀 Fazendo deploy..."
git push heroku main

# Aguardar deploy
echo "⏳ Aguardando deploy..."
sleep 10

# Verificar status
echo "✅ Verificando status..."
heroku ps

# Mostrar URLs
APP_URL=$(heroku info -s | grep web_url | cut -d= -f2)
echo ""
echo "🎉 Deploy concluído!"
echo "📍 URL da API: $APP_URL"
echo "📚 Documentação: ${APP_URL}docs"
echo "🏥 Health Check: ${APP_URL}health"
echo ""
echo "📊 Para ver logs: heroku logs --tail"
echo "🔧 Para ver config: heroku config"
echo "📱 Para abrir app: heroku open"