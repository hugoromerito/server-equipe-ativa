# 🚀 Equipe Ativa API

Uma API REST robusta e bem organizada para gerenciamento de equipes ativas, desenvolvida com **TypeScript**, **Fastify** e **PostgreSQL**. Sistema completo para gestão de organizações, unidades, membros, demandas e muito mais.

## ✨ Destaques

- 🏗️ **Arquitetura limpa e modular** seguindo princípios SOLID e Clean Architecture
- 📦 **Barrel exports** para imports organizados
- 🎯 **Types de domínio** bem definidos
- 📚 **Documentação completa** em `docs/`
- ✅ **100% TypeScript** com type safety
- 🧪 **Testes abrangentes** com Vitest
- 🔒 **Segurança robusta** com JWT e CASL
- 🚀 **Performance otimizada** com caching e paginação

## 📖 Documentação

| Documento | Descrição |
|-----------|-----------|
| **[QUICK_START.md](./QUICK_START.md)** | 🚀 Guia rápido para começar |
| **[STRUCTURE.md](./STRUCTURE.md)** | 🏗️ Estrutura do projeto |
| **[BEST_PRACTICES.md](./BEST_PRACTICES.md)** | 📖 Guia de boas práticas |
| **[EXAMPLE.ts](./EXAMPLE.ts)** | 💡 Exemplos de código |
| **[CHANGELOG.md](./CHANGELOG.md)** | 📋 Histórico de mudanças |
| **[docs/](./docs/)** | 📚 Documentação detalhada |

## 🚀 Início Rápido

```bash
# 1. Clone e instale
git clone <repository-url>
cd server-equipe-ativa
nvm use  # Node.js 22.0.0
npm install

# 2. Configure ambiente
cp .env.example .env
# Edite .env com suas configurações

# 3. Inicie banco e migrações
npm run docker:up
npm run db:migrate
npm run db:seed

# 4. Inicie o servidor
npm run dev
```

🎉 API rodando em `http://localhost:3333`  
📚 Documentação em `http://localhost:3333/docs`

➡️ **Para guia completo, veja [QUICK_START.md](./QUICK_START.md)**

## ✨ Funcionalidades

### 🔐 Autenticação & Autorização
- Sistema JWT completo
- Login com senha e Google OAuth
- Recuperação de senha
- Sistema de permissões CASL
- Roles: ADMIN, MEMBER, ANALYST, BILLING

### 🏢 Gestão Organizacional
- Múltiplas organizações
- Unidades hierárquicas
- Sistema de convites
- Membros e permissões
- Cargos personalizáveis

### 📋 Sistema de Demandas
- CRUD completo de demandas
- Status workflow: pending → in_progress → completed
- Prioridades e categorias
- Auditoria de mudanças
- Atribuição de membros

### 👥 Gestão de Solicitantes
- Cadastro com validação de CPF
- Vinculação a demandas
- Histórico completo

### 📎 Upload & Anexos
- AWS S3 integration
- Múltiplos tipos: avatares, documentos
- URLs pré-assinadas
- Validação de tipos e tamanhos

### 💳 Billing & Subscriptions
- Integração Stripe
- Planos e assinaturas
- Webhooks para pagamentos
- Gestão de payment methods

### 📊 Scheduling & Availability
- Dias de trabalho configuráveis
- Disponibilidade de membros
- Geração de timesheet PDF
- Agendamento de atividades

### 🖥️ Sistema de Acesso via TV
- Códigos de 6 dígitos
- Tokens com expiração
- Validação segura

### 🔌 WebSocket
- Comunicação em tempo real
- Notificações push
- Status updates

## 🛠️ Stack Tecnológica

### Backend
- **Fastify** - Framework web performático
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM
- **Zod** - Schema validation
- **CASL** - Authorization

### Database
- **PostgreSQL** - Database principal
- **pgvector** - Vector similarity

### Serviços
- **AWS S3** - File storage
- **Stripe** - Payments
- **OpenAI** - AI classification
- **Socket.IO** - Real-time

### DevOps
- **Docker** - Containerization
- **Heroku** - Deployment
- **Biome** - Linting & formatting
- **Vitest** - Testing

## 📁 Estrutura Organizada

```
server-equipe-ativa/
├── docs/                    # 📚 Documentação completa
│   ├── api/                # Docs de APIs
│   ├── guides/             # Guias de implementação
│   ├── deployment/         # Guias de deploy
│   ├── testing/            # Docs de testes
│   └── analysis/           # Análises técnicas
│
├── src/
│   ├── config/             # ⚙️ Configurações
│   │   ├── constants/     # Por domínio (http, validation, business)
│   │   ├── plugins.ts     # Plugins Fastify
│   │   ├── routes.ts      # Registro de rotas
│   │   └── hooks.ts       # Hooks
│   │
│   ├── types/domain/       # 📝 Types organizados
│   │   ├── auth.ts
│   │   ├── organization.ts
│   │   ├── demand.ts
│   │   └── billing.ts
│   │
│   ├── services/           # 🔧 Business services
│   ├── utils/              # 🛠️ Utilities
│   ├── http/               # 🌐 HTTP layer
│   ├── db/                 # 💾 Database
│   └── server.ts           # 🚀 Entry point
│
├── tests/                   # 🧪 Testes
├── STRUCTURE.md            # Documentação da estrutura
├── BEST_PRACTICES.md       # Guia de boas práticas
└── QUICK_START.md          # Guia rápido
```

➡️ **Para estrutura completa, veja [STRUCTURE.md](./STRUCTURE.md)**

## 🎯 Princípios Aplicados

- ✅ **SOLID Principles**
- ✅ **Clean Architecture**
- ✅ **Domain-Driven Design**
- ✅ **Separation of Concerns**
- ✅ **Barrel Exports Pattern**
- ✅ **Convention over Configuration**

➡️ **Para boas práticas, veja [BEST_PRACTICES.md](./BEST_PRACTICES.md)**

## 📝 Scripts Principais

```bash
# Desenvolvimento
npm run dev              # Com hot-reload

# Database
npm run db:migrate       # Migrações
npm run db:seed          # Popular dados
npm run db:studio        # Drizzle Studio

# Testes
npm test                 # Executar testes
npm run test:coverage    # Cobertura

# Qualidade
npm run lint             # Verificar código
npm run type-check       # Verificar tipos
npm run validate         # Lint + type + tests

# Docker
npm run docker:up        # Subir containers
npm run docker:down      # Parar containers
```

## 🌐 Endpoints Principais

### Autenticação
```
POST   /auth/password        # Login
POST   /auth/google          # Google OAuth
GET    /auth/profile         # Perfil
POST   /auth/recover         # Recuperar senha
POST   /auth/reset           # Resetar senha
```

### Organizações
```
GET    /organizations        # Listar
POST   /organizations        # Criar
GET    /organizations/:id    # Detalhes
PATCH  /organizations/:id    # Atualizar
DELETE /organizations/:id    # Desativar
```

### Demandas
```
GET    /demands              # Listar
POST   /demands              # Criar
GET    /demands/:id          # Detalhes
PATCH  /demands/:id          # Atualizar
POST   /demands/:id/assign   # Atribuir membro
```

📚 **Documentação completa:** `http://localhost:3333/docs`

## 🧪 Testes

```bash
# Todos os testes
npm test

# Modo watch
npm run test:watch

# Com UI
npm run test:ui

# Cobertura
npm run test:coverage

# Teste específico
npm test -- auth.test.ts
```

## 🐳 Docker

```bash
# Iniciar PostgreSQL
docker-compose up -d

# Logs
docker-compose logs -f

# Parar
docker-compose down
```

## 🚀 Deploy

### Heroku
```bash
# Deploy automatizado
./deploy-heroku.sh meu-app

# Configurar variáveis
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set DATABASE_URL=...
```

📚 **Guia completo:** [docs/deployment/heroku.md](./docs/deployment/heroku.md)

## 🔒 Variáveis de Ambiente

```env
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=seu-secret-super-seguro
JWT_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-...

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

## 🤝 Contribuindo

Para contribuir com o projeto:

1. Leia [BEST_PRACTICES.md](./BEST_PRACTICES.md)
2. Consulte [STRUCTURE.md](./STRUCTURE.md)
3. Veja exemplos em [EXAMPLE.ts](./EXAMPLE.ts)
4. Crie sua branch: `git checkout -b feature/nova-feature`
5. Execute validações: `npm run validate`
6. Commit: `git commit -m "feat: nova feature"`
7. Push e abra PR

## 📊 Status do Projeto

- ✅ **Arquitetura**: Clean & modular
- ✅ **Documentação**: Completa
- ✅ **Testes**: Cobertura alta
- ✅ **Type Safety**: 100%
- ✅ **Performance**: Otimizada
- ✅ **Security**: Robusta

## 📞 Suporte

- 📖 **Documentação**: [docs/](./docs/)
- 🚀 **Quick Start**: [QUICK_START.md](./QUICK_START.md)
- 🏗️ **Estrutura**: [STRUCTURE.md](./STRUCTURE.md)
- 📋 **Boas Práticas**: [BEST_PRACTICES.md](./BEST_PRACTICES.md)

## 📝 Licença

**PROPRIETARY** - Todos os direitos reservados.

## 👨‍💻 Autor

**Hugo Queiroz** - [GitHub](https://github.com/hugoromerito)

---

<div align="center">
  
**🌟 Projeto reestruturado seguindo as melhores práticas de desenvolvimento! 🌟**

[Documentação](./docs) • [Quick Start](./QUICK_START.md) • [Estrutura](./STRUCTURE.md) • [Boas Práticas](./BEST_PRACTICES.md)

**Versão 2.0.0** • Novembro 2025

</div>
