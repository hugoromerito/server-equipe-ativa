# Dockerfile multi-stage para otimização
FROM node:20-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache \
    libc6-compat \
    dumb-init \
    curl

# Definir diretório de trabalho
WORKDIR /app

# Configurar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# ==========================================
# Stage: Dependencies
# ==========================================
FROM base AS deps

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências de produção
RUN npm ci --only=production && npm cache clean --force

# ==========================================
# Stage: Build
# ==========================================
FROM base AS build

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar todas as dependências (incluindo dev)
RUN npm ci

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# ==========================================
# Stage: Production
# ==========================================
FROM base AS production

# Variáveis de ambiente de produção
ENV NODE_ENV=production
ENV PORT=3333

# Copiar dependências de produção do stage deps
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copiar aplicação buildada
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=build --chown=nextjs:nodejs /app/package.json ./

# Criar diretórios necessários
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# Configurar usuário não-root
USER nextjs

# Expor porta
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Comando para iniciar a aplicação
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

# ==========================================
# Stage: Development
# ==========================================
FROM base AS development

# Instalar dependências de desenvolvimento
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar código fonte
COPY . .

# Configurar usuário
USER nextjs

# Expor porta
EXPOSE 3333

# Comando para desenvolvimento
CMD ["npm", "run", "dev"]
