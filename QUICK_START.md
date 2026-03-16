# 🚀 Quick Start Guide - Equipe Ativa API

Guia rápido para começar a desenvolver no projeto.

## 📋 Pré-requisitos

- Node.js 22.0.0+ (use `.nvmrc` com `nvm use`)
- PostgreSQL 14+
- Docker & Docker Compose (opcional)
- npm ou yarn

## ⚡ Instalação Rápida

```bash
# 1. Clone o repositório
git clone <repository-url>
cd server-equipe-ativa

# 2. Use a versão correta do Node
nvm use

# 3. Instale as dependências
npm install

# 4. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# 5. Inicie o banco de dados com Docker
npm run docker:up

# 6. Execute as migrações
npm run db:migrate

# 7. Popule o banco com dados iniciais
npm run db:seed

# 8. Inicie o servidor em modo desenvolvimento
npm run dev
```

## 🎯 Comandos Principais

### Desenvolvimento
```bash
npm run dev              # Desenvolvimento com hot-reload
npm run start:dev        # Desenvolvimento sem hot-reload
```

### Banco de Dados
```bash
npm run db:migrate       # Executar migrações
npm run db:generate      # Gerar migrações
npm run db:studio        # Abrir Drizzle Studio
npm run db:seed          # Popular banco de dados
npm run db:reset         # Resetar banco completamente
```

### Testes
```bash
npm test                 # Executar todos os testes
npm run test:watch       # Testes em modo watch
npm run test:coverage    # Cobertura de testes
npm run test:ui          # Interface de testes
```

### Qualidade de Código
```bash
npm run lint             # Verificar código
npm run lint:fix         # Corrigir problemas automaticamente
npm run type-check       # Verificar tipos TypeScript
npm run validate         # Lint + type-check + tests
```

### Docker
```bash
npm run docker:up        # Subir containers
npm run docker:down      # Parar containers
npm run docker:logs      # Ver logs
```

## 📁 Estrutura Rápida

```
src/
├── config/          # Configurações e constants
├── db/              # Database schemas e migrations
├── http/            # Routes, middlewares, schemas
├── services/        # Business services
├── types/           # TypeScript types
├── utils/           # Utilities e helpers
└── server.ts        # Entry point
```

## 🔧 Desenvolvimento

### 1. Criar uma Nova Rota

```typescript
// src/http/routes/users/create-user.ts
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { HTTP_STATUS } from '@/config'

export const createUserRoute: FastifyPluginCallbackZod = (app) => {
  app.post('/users', {
    schema: {
      tags: ['Users'],
      body: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
    },
  }, async (request, reply) => {
    // Sua lógica aqui
    return reply.status(HTTP_STATUS.CREATED).send({ success: true })
  })
}
```

### 2. Registrar a Rota

```typescript
// src/config/routes.ts
import { createUserRoute } from '../http/routes/users/create-user.ts'

export async function registerRoutes(app: FastifyInstance) {
  await Promise.all([
    // ... outras rotas
    app.register(createUserRoute),
  ])
}
```

### 3. Criar um Service

```typescript
// src/services/user-service.ts
import { db } from '@/db/connection'
import { users } from '@/db/schema'
import { logger } from '@/utils'
import type { User } from '@/types/domain'

export class UserService {
  async createUser(data: CreateUserInput): Promise<User> {
    logger.info('Creating user', { email: data.email })
    
    const [user] = await db
      .insert(users)
      .values(data)
      .returning()
    
    return user
  }
}
```

### 4. Adicionar Types de Domínio

```typescript
// src/types/domain/user.ts
export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}
```

## 📚 Documentação

### Onde Encontrar Informações

| Precisa de... | Consulte... |
|---------------|-------------|
| **Estrutura do projeto** | `STRUCTURE.md` |
| **Boas práticas** | `BEST_PRACTICES.md` |
| **Exemplos de código** | `EXAMPLE.ts` |
| **APIs** | `docs/api/` |
| **Guias de implementação** | `docs/guides/` |
| **Histórico de mudanças** | `CHANGELOG.md` |
| **Resumo de melhorias** | `IMPROVEMENTS_SUMMARY.md` |

### Documentação da API

```bash
# Iniciar servidor
npm run dev

# Acessar Swagger UI
http://localhost:3333/docs

# Health check
http://localhost:3333/health
```

## 🧪 Testes

### Executar Testes Específicos

```bash
# Testar um arquivo específico
npm test -- auth.test.ts

# Testar com pattern
npm test -- --grep="user"

# Modo watch para arquivo
npm run test:watch -- auth.test.ts
```

### Escrever um Teste

```typescript
// tests/routes/users.test.ts
import { describe, test, expect, beforeEach } from 'vitest'
import { createApp } from '@/server'

describe('Users Routes', () => {
  let app: FastifyInstance
  
  beforeEach(async () => {
    app = await createApp()
  })
  
  test('should create user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    })
    
    expect(response.statusCode).toBe(201)
  })
})
```

## 🐛 Debug

### VS Code Launch Configuration

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Server",
  "skipFiles": ["<node_internals>/**"],
  "program": "${workspaceFolder}/src/server.ts",
  "runtimeArgs": ["--experimental-strip-types"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Logs

```typescript
import { logger } from '@/utils'

// Info
logger.info('User created', { userId: user.id })

// Error
logger.error('Failed to create user', { error: error.message })

// Warn
logger.warn('User not found', { userId })
```

## 🔒 Segurança

### Variáveis de Ambiente Obrigatórias

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/equipe_ativa

# JWT
JWT_SECRET=your-secret-key-here

# AWS S3
AWS_BUCKET_NAME=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 📱 Endpoints Principais

```bash
# Autenticação
POST   /auth/password     # Login com senha
POST   /auth/google       # Login com Google
GET    /auth/profile      # Perfil do usuário

# Organizações
POST   /organizations     # Criar organização
GET    /organizations     # Listar organizações
GET    /organizations/:id # Detalhes da organização

# Membros
GET    /organizations/:orgId/members  # Membros da org
PATCH  /members/:id/job-title         # Atualizar cargo

# Demandas
POST   /demands           # Criar demanda
GET    /demands           # Listar demandas
PATCH  /demands/:id       # Atualizar demanda
```

## 🆘 Troubleshooting

### Erro: "Cannot find module"
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Erro: Database connection
```bash
# Verificar se PostgreSQL está rodando
npm run docker:logs

# Resetar banco
npm run db:reset
```

### Erro: Port already in use
```bash
# Mudar porta no .env
PORT=3334

# Ou matar processo
kill -9 $(lsof -t -i:3333)
```

## 🎓 Recursos de Aprendizado

- [Fastify Documentation](https://fastify.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Como Contribuir

1. Crie uma branch: `git checkout -b feature/minha-feature`
2. Faça suas alterações seguindo `BEST_PRACTICES.md`
3. Execute testes: `npm run validate`
4. Commit: `git commit -m "feat: minha nova feature"`
5. Push: `git push origin feature/minha-feature`
6. Abra um Pull Request

## 💡 Dicas

- Use `@/` para imports absolutos
- Consulte `EXAMPLE.ts` para templates
- Mantenha types em `src/types/domain/`
- Documente em `docs/` quando relevante
- Execute `npm run validate` antes de commit

## 🚀 Deploy

```bash
# Heroku
npm run deploy

# Docker
npm run build:docker
docker run -p 3333:3333 equipe-ativa-api

# Manual
npm run db:migrate
npm run start:prod
```

---

**Pronto para começar! 🎉**

Se precisar de ajuda, consulte os guias em `docs/` ou abra uma issue.
