# 📋 Estrutura do Projeto - Equipe Ativa API

Este documento descreve a organização aprimorada do projeto seguindo as melhores práticas de desenvolvimento.

## 📁 Estrutura de Diretórios

```
server-equipe-ativa/
├── docs/                           # 📚 Documentação organizada
│   ├── api/                       # Documentação de APIs
│   ├── guides/                    # Guias de implementação
│   ├── deployment/                # Guias de deploy
│   ├── testing/                   # Documentação de testes
│   └── analysis/                  # Análises técnicas
│
├── src/
│   ├── config/                    # ⚙️ Configurações
│   │   ├── constants/            # Constantes organizadas por domínio
│   │   │   ├── http.ts          # Status HTTP, rate limiting, Swagger
│   │   │   ├── validation.ts    # Regras de validação
│   │   │   ├── business.ts      # Regras de negócio
│   │   │   └── index.ts         # Barrel export
│   │   ├── env.ts               # Variáveis de ambiente
│   │   ├── plugins.ts           # Configuração de plugins Fastify
│   │   ├── routes.ts            # Registro centralizado de rotas
│   │   ├── hooks.ts             # Hooks do Fastify
│   │   └── index.ts             # Barrel export
│   │
│   ├── db/                        # 💾 Banco de dados
│   │   ├── schema/               # Schemas Drizzle ORM
│   │   │   ├── auth.ts
│   │   │   ├── organization.ts
│   │   │   ├── demands.ts
│   │   │   ├── billings.ts
│   │   │   └── index.ts         # Barrel export
│   │   ├── migrations/           # Migrações
│   │   ├── connection.ts
│   │   └── seed.ts
│   │
│   ├── http/                      # 🌐 Camada HTTP
│   │   ├── routes/               # Rotas organizadas por domínio
│   │   │   ├── auth/
│   │   │   ├── organizations/
│   │   │   ├── demands/
│   │   │   ├── members/
│   │   │   └── _errors/
│   │   ├── middlewares/          # Middlewares
│   │   │   ├── auth.ts
│   │   │   ├── rate-limit.ts
│   │   │   ├── metrics.ts
│   │   │   └── index.ts         # Barrel export
│   │   ├── schemas/              # Schemas de validação Zod
│   │   │   └── index.ts         # Barrel export
│   │   └── utils/
│   │
│   ├── services/                  # 🔧 Serviços
│   │   ├── billing.ts
│   │   ├── cache.ts
│   │   ├── storage.ts
│   │   ├── stripe.ts
│   │   └── index.ts              # Barrel export
│   │
│   ├── types/                     # 📝 Tipos TypeScript
│   │   ├── domain/               # Tipos de domínio
│   │   │   ├── auth.ts
│   │   │   ├── organization.ts
│   │   │   ├── demand.ts
│   │   │   ├── billing.ts
│   │   │   ├── job-title.ts
│   │   │   ├── attachment.ts
│   │   │   └── index.ts         # Barrel export
│   │   ├── fastify.d.ts         # Extensões Fastify
│   │   └── socket.ts
│   │
│   ├── utils/                     # 🛠️ Utilitários
│   │   ├── logger.ts
│   │   ├── validation.ts
│   │   ├── pagination.ts
│   │   └── index.ts              # Barrel export
│   │
│   ├── lib/                       # 📚 Bibliotecas
│   │   └── socket-server.ts
│   │
│   └── server.ts                  # 🚀 Servidor principal (refatorado)
│
├── tests/                         # 🧪 Testes
│   ├── routes/
│   ├── permissions/
│   ├── fixtures/
│   └── utils/
│
├── scripts/                       # 📜 Scripts auxiliares
├── docker/                        # 🐳 Configurações Docker
├── .editorconfig                  # Configuração do editor
├── .nvmrc                         # Versão do Node.js (22.0.0)
├── biome.jsonc                    # Configuração Biome
├── tsconfig.json                  # Configuração TypeScript
├── vitest.config.ts               # Configuração Vitest
├── drizzle.config.ts              # Configuração Drizzle ORM
└── package.json                   # Dependências e scripts organizados
```

## 🎯 Princípios Aplicados

### 1. **Separation of Concerns (SoC)**
- Cada módulo tem uma responsabilidade única e bem definida
- Configurações separadas em arquivos específicos (plugins, routes, hooks)
- Server.ts limpo e focado apenas em inicialização

### 2. **Barrel Exports**
- Arquivos `index.ts` em cada diretório principal
- Imports limpos e organizados: `import { User } from '@/types/domain'`
- Facilita refatoração e manutenção

### 3. **Domain-Driven Design (DDD)**
- Types organizados por domínio de negócio
- Constants separadas por contexto (HTTP, Validation, Business)
- Estrutura que reflete o modelo de negócio

### 4. **Clean Architecture**
- Camadas bem definidas: Config → Services → HTTP → Routes
- Dependências apontam para o centro (domain types)
- Fácil testabilidade e manutenção

### 5. **Convention over Configuration**
- Padrões consistentes de nomenclatura
- Estrutura previsível e fácil de navegar
- EditorConfig para consistência de código

## 📝 Scripts Organizados

Os scripts do `package.json` estão organizados por categoria:

```json
{
  "// Development": "Scripts de desenvolvimento",
  "dev": "Desenvolvimento com hot-reload",
  "start:dev": "Iniciar em modo desenvolvimento",
  
  "// Production": "Scripts de produção",
  "start": "Iniciar servidor",
  "start:prod": "Iniciar em produção",
  
  "// Database": "Scripts de banco de dados",
  "db:migrate": "Executar migrações",
  "db:seed": "Popular banco de dados",
  
  "// Testing": "Scripts de testes",
  "test": "Executar testes",
  "test:coverage": "Cobertura de testes",
  
  "// Code Quality": "Scripts de qualidade",
  "lint": "Verificar código",
  "type-check": "Verificar tipos"
}
```

## 🔧 Imports Recomendados

### Antes (imports longos)
```typescript
import { env } from '../../../config/env.ts'
import { SWAGGER_CONFIG } from '../../../config/constants.ts'
import { logger } from '../../../utils/logger.ts'
```

### Depois (imports limpos)
```typescript
import { env, SWAGGER_CONFIG } from '@/config'
import { logger } from '@/utils'
```

## 📚 Documentação

Toda documentação foi reorganizada em `docs/`:

- **API**: Documentação de endpoints e APIs
- **Guides**: Guias de implementação e uso
- **Deployment**: Guias de deploy (Heroku, Railway, etc)
- **Testing**: Relatórios e guias de testes
- **Analysis**: Análises técnicas e decisões de arquitetura

Consulte `docs/README.md` para índice completo.

## 🚀 Próximos Passos

Para migrar código existente para a nova estrutura:

1. **Atualizar imports** para usar barrel exports
2. **Mover constantes** para os arquivos específicos em `config/constants/`
3. **Utilizar tipos de domínio** de `types/domain/`
4. **Documentar** novas features em `docs/`

## 🤝 Contribuindo

Ao adicionar novos módulos:

1. ✅ Crie um diretório com responsabilidade única
2. ✅ Adicione `index.ts` para barrel exports
3. ✅ Documente em `docs/` se necessário
4. ✅ Mantenha a convenção de nomenclatura
5. ✅ Adicione testes correspondentes

---

**Versão**: 1.0.0  
**Última atualização**: Novembro 2025
