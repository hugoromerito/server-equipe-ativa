# 📖 Guia de Boas Práticas - Equipe Ativa API

Este documento estabelece as boas práticas de desenvolvimento para o projeto.

## 🎯 Princípios Fundamentais

### 1. **SOLID Principles**

#### Single Responsibility Principle (SRP)
```typescript
// ❌ Ruim: Classe com múltiplas responsabilidades
class UserService {
  createUser() { }
  sendEmail() { }
  generatePDF() { }
}

// ✅ Bom: Cada classe com uma responsabilidade
class UserService {
  createUser() { }
}
class EmailService {
  sendEmail() { }
}
class PDFService {
  generatePDF() { }
}
```

#### Dependency Inversion Principle (DIP)
```typescript
// ✅ Dependa de abstrações, não de implementações
interface StorageService {
  upload(file: File): Promise<string>
}

class S3Storage implements StorageService {
  async upload(file: File) { }
}
```

### 2. **Clean Code**

#### Nomenclatura Significativa
```typescript
// ❌ Ruim: Nomes genéricos
const d = new Date()
const arr = []

// ✅ Bom: Nomes descritivos
const currentDate = new Date()
const activeUsers = []
```

#### Funções Pequenas e Focadas
```typescript
// ❌ Ruim: Função fazendo muitas coisas
async function processUser(id: string) {
  const user = await getUser(id)
  const isValid = validateUser(user)
  if (isValid) {
    await sendEmail(user)
    await updateDatabase(user)
    await logActivity(user)
  }
}

// ✅ Bom: Funções pequenas e específicas
async function processUser(id: string) {
  const user = await getUser(id)
  
  if (!isValidUser(user)) {
    return
  }
  
  await notifyUser(user)
  await persistUser(user)
  await auditUserActivity(user)
}
```

### 3. **Error Handling**

#### Sempre Trate Erros
```typescript
// ❌ Ruim: Ignorar erros
try {
  await dangerousOperation()
} catch (error) {
  // silencioso
}

// ✅ Bom: Tratar e logar erros
try {
  await dangerousOperation()
} catch (error) {
  logger.error('Failed to execute operation', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  throw new AppError('Operation failed', 500)
}
```

#### Use Custom Errors
```typescript
// ✅ Criar erros customizados
class NotFoundError extends Error {
  statusCode = 404
  constructor(resource: string) {
    super(`${resource} not found`)
    this.name = 'NotFoundError'
  }
}

// Uso
if (!user) {
  throw new NotFoundError('User')
}
```

## 📝 TypeScript Best Practices

### 1. **Use Tipos Fortes**
```typescript
// ❌ Ruim: Tipos genéricos
function getUser(id: any): any {
  return db.query('SELECT * FROM users WHERE id = ?', [id])
}

// ✅ Bom: Tipos específicos
async function getUser(id: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  
  return result[0] ?? null
}
```

### 2. **Evite `any`**
```typescript
// ❌ Ruim
const data: any = fetchData()

// ✅ Bom: Use unknown e type guards
const data: unknown = fetchData()

if (isValidData(data)) {
  // TypeScript agora sabe o tipo
  processData(data)
}
```

### 3. **Use Const Assertions**
```typescript
// ✅ Tipos mais precisos
const ROLES = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const

type Role = typeof ROLES[keyof typeof ROLES]
// Role = 'ADMIN' | 'MEMBER'
```

## 🏗️ Estrutura de Código

### 1. **Organização de Imports**
```typescript
// ✅ Ordem recomendada:
// 1. Bibliotecas externas
import { fastify } from 'fastify'
import { eq } from 'drizzle-orm'

// 2. Módulos internos da aplicação
import { env } from '@/config'
import { logger } from '@/utils'
import { User } from '@/types/domain'

// 3. Imports relativos
import { validateUser } from './validation'
```

### 2. **Barrel Exports**
```typescript
// src/services/index.ts
export * from './billing.ts'
export * from './storage.ts'
export * from './stripe.ts'

// Uso limpo
import { BillingService, StorageService } from '@/services'
```

### 3. **Separação de Concerns**
```
routes/users/
  ├── index.ts              # Barrel exports
  ├── create-user.ts        # POST /users
  ├── get-user.ts           # GET /users/:id
  ├── update-user.ts        # PUT /users/:id
  └── delete-user.ts        # DELETE /users/:id
```

## 🧪 Testing Best Practices

### 1. **AAA Pattern**
```typescript
test('should create a new user', async () => {
  // Arrange
  const userData = {
    name: 'John Doe',
    email: 'john@example.com',
  }
  
  // Act
  const user = await createUser(userData)
  
  // Assert
  expect(user).toBeDefined()
  expect(user.email).toBe(userData.email)
})
```

### 2. **Test Isolation**
```typescript
// ✅ Cada teste deve ser independente
beforeEach(async () => {
  await cleanDatabase()
  await seedTestData()
})

afterEach(async () => {
  await cleanDatabase()
})
```

### 3. **Nomes Descritivos**
```typescript
// ❌ Ruim
test('user test', () => { })

// ✅ Bom
test('should return 404 when user does not exist', () => { })
test('should throw error when email is invalid', () => { })
```

## 📊 Performance Best Practices

### 1. **Lazy Loading**
```typescript
// ✅ Carregar apenas quando necessário
const heavyModule = await import('./heavy-module')
```

### 2. **Paginação**
```typescript
// ✅ Sempre paginar listas grandes
async function getUsers(page = 1, limit = 20) {
  return await db
    .select()
    .from(users)
    .limit(limit)
    .offset((page - 1) * limit)
}
```

### 3. **Caching**
```typescript
// ✅ Cachear dados que não mudam frequentemente
import { cache } from '@/services'

async function getOrganization(id: string) {
  const cached = await cache.get(`org:${id}`)
  if (cached) return cached
  
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id)
  })
  
  await cache.set(`org:${id}`, org, 3600) // 1 hora
  return org
}
```

## 🔒 Security Best Practices

### 1. **Validação de Input**
```typescript
// ✅ Sempre validar dados de entrada
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
})

// Uso
const validatedData = createUserSchema.parse(requestBody)
```

### 2. **Sanitização**
```typescript
// ✅ Sanitizar dados antes de usar
import { sanitizeHtml } from '@/utils'

const safeContent = sanitizeHtml(userInput)
```

### 3. **Rate Limiting**
```typescript
// ✅ Proteger endpoints críticos
app.register(rateLimitPlugin, {
  max: 5,
  timeWindow: '15 minutes'
})
```

## 📝 Documentação

### 1. **JSDoc nos Principais Métodos**
```typescript
/**
 * Creates a new user in the system
 * 
 * @param userData - User data to create
 * @returns The created user
 * @throws {ValidationError} If user data is invalid
 * @throws {ConflictError} If email already exists
 */
async function createUser(userData: CreateUserInput): Promise<User> {
  // implementação
}
```

### 2. **README em Módulos Complexos**
```markdown
# Billing Service

Handles all billing and subscription operations.

## Features
- Subscription management
- Payment processing
- Invoice generation

## Usage
\`\`\`typescript
import { BillingService } from '@/services'

await BillingService.createSubscription(orgId, planId)
\`\`\`
```

## 🔄 Git Best Practices

### 1. **Commits Semânticos**
```bash
feat: add user authentication
fix: resolve memory leak in socket server
docs: update API documentation
refactor: reorganize constants structure
test: add tests for billing service
chore: update dependencies
```

### 2. **Branches**
```bash
main              # Produção
develop           # Desenvolvimento
feature/xxx       # Novas features
fix/xxx          # Correções
hotfix/xxx       # Correções urgentes
```

## ✅ Code Review Checklist

- [ ] Código segue os princípios SOLID
- [ ] Tipos TypeScript corretos (sem `any`)
- [ ] Tratamento de erros adequado
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Performance considerada
- [ ] Segurança validada
- [ ] Logs apropriados
- [ ] Code review realizado

---

**Mantenha este guia atualizado conforme o projeto evolui!**
