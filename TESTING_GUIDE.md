# Guia de Testes

Este documento explica como configurar e executar testes para garantir que suas rotas funcionem corretamente.

## 🚀 Configuração Inicial

### 1. Configurar Banco de Dados de Teste

Primeiro, inicie o banco PostgreSQL para testes:

```bash
# Iniciar banco de teste
docker-compose -f docker-compose.test.yml up -d

# Verificar se está rodando
docker ps
```

### 2. Executar Migrations no Banco de Teste

```bash
# Definir DATABASE_URL para o banco de teste
export DATABASE_URL="postgresql://test:test@localhost:5433/test_db"

# Executar migrations
npm run db:migrate
```

## 🧪 Executando Testes

### Comandos Disponíveis

```bash
# Executar todos os testes uma vez
npm test

# Executar testes em modo watch (reexecuta quando arquivos mudam)
npm run test:watch

# Executar testes com interface visual
npm run test:ui

# Executar testes com cobertura
npm run test:coverage
```

### Executar Testes Específicos

```bash
# Executar apenas testes de autenticação
npx vitest run tests/routes/auth.test.ts

# Executar apenas testes de demands
npx vitest run tests/routes/demands.test.ts

# Executar testes que contenham "auth" no nome
npx vitest run --grep="auth"
```

## 📁 Estrutura dos Testes

```
tests/
├── setup.ts                 # Configuração global dos testes
├── utils/
│   ├── test-database.ts      # Utilitário para gerenciar BD de teste
│   ├── test-auth.ts          # Utilitário para autenticação em testes
│   └── create-test-app.ts    # Factory para criar instância do app
├── fixtures/                 # Arquivos de exemplo para testes
└── routes/
    ├── auth.test.ts          # Testes das rotas de autenticação
    ├── demands.test.ts       # Testes das rotas de demandas
    └── ...                   # Outros testes de rotas
```

## ✍️ Escrevendo Testes

### Exemplo Básico

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { testDb } from '../setup.js'
import { TestAuth } from '../utils/test-auth.js'
import { createTestApp } from '../utils/create-test-app.js'
import { minhaRota } from '../../src/http/routes/minha-rota.js'

describe('Minha Rota', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>

  beforeEach(async () => {
    // Limpa o banco antes de cada teste
    await testDb.clearDatabase()
    
    // Inicializa utilitários
    testAuth = new TestAuth(testDb)
    app = createTestApp()
    
    // Registra a rota
    await app.register(minhaRota)
    await app.ready()
  })

  it('deve fazer algo específico', async () => {
    // Arrange (preparar)
    const { user } = await testAuth.createTestUser()
    const token = testAuth.generateJwtToken(user.id, app)

    // Act (executar)
    const response = await app.inject({
      method: 'GET',
      url: '/minha-rota',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    // Assert (verificar)
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('data')
  })
})
```

### Testando Rotas com Autenticação

```typescript
it('deve retornar erro 401 sem token', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/rota-protegida',
  })

  expect(response.statusCode).toBe(401)
})

it('deve funcionar com token válido', async () => {
  const { user } = await testAuth.createTestUser()
  const token = testAuth.generateJwtToken(user.id, app)

  const response = await app.inject({
    method: 'GET',
    url: '/rota-protegida',
    headers: {
      authorization: `Bearer ${token}`,
    },
  })

  expect(response.statusCode).toBe(200)
})
```

### Testando Validação de Entrada

```typescript
it('deve validar campos obrigatórios', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/criar-algo',
    payload: {
      // dados inválidos ou faltando
    },
  })

  expect(response.statusCode).toBe(400)
  const body = JSON.parse(response.body)
  expect(body).toHaveProperty('message')
})
```

### Testando Upload de Arquivos

```typescript
it('deve fazer upload de arquivo', async () => {
  const form = new FormData()
  form.append('file', new Blob(['conteúdo do arquivo']), 'test.txt')

  const response = await app.inject({
    method: 'POST',
    url: '/upload',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: form,
  })

  expect(response.statusCode).toBe(201)
})
```

## 🛠️ Utilitários Disponíveis

### TestDatabase

```typescript
const testDb = new TestDatabase()

// Configurar banco
await testDb.setup()

// Limpar todas as tabelas
await testDb.clearDatabase()

// Fechar conexão
await testDb.teardown()

// Acessar instância do Drizzle
testDb.db.select().from(users)
```

### TestAuth

```typescript
const testAuth = new TestAuth(testDb)

// Criar usuário de teste
const { user, password, organizationId } = await testAuth.createTestUser({
  email: 'test@example.com',
  name: 'Test User',
  password: 'password123',
})

// Gerar token JWT
const token = testAuth.generateJwtToken(user.id, app)
```

## 📊 Cobertura de Testes

Para ver a cobertura dos testes:

```bash
npm run test:coverage
```

Isso gerará um relatório mostrando quais partes do código estão sendo testadas.

## 🚫 Mocks e Simulações

### Mockando Serviços Externos

```typescript
import { vi } from 'vitest'

// Mock do serviço de classificação de IA
vi.mock('../../src/http/utils/classify-demand-ai.js', () => ({
  classifyDemandAi: vi.fn().mockResolvedValue({
    priority: 'HIGH',
    category: 'SOCIAL'
  })
}))
```

### Mockando Upload S3

```typescript
vi.mock('../../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    url: 'https://example.com/file.jpg',
    key: 'uploads/file.jpg'
  })
}))
```

## 🔧 Configuração CI/CD

Para executar testes no GitHub Actions, adicione:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5433:5432

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5433/test_db
      
      - run: npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5433/test_db
          JWT_SECRET: test_secret
```

## 💡 Dicas e Boas Práticas

### 1. Isolamento de Testes
- Sempre use `beforeEach` para limpar o banco
- Cada teste deve ser independente
- Não compartilhe estado entre testes

### 2. Nomes Descritivos
```typescript
// ❌ Ruim
it('test user creation')

// ✅ Bom
it('should create user with valid data and return 201 status')
```

### 3. Padrão AAA
```typescript
it('should do something', async () => {
  // Arrange - preparar dados
  const userData = { name: 'John', email: 'john@example.com' }
  
  // Act - executar ação
  const response = await app.inject({...})
  
  // Assert - verificar resultado
  expect(response.statusCode).toBe(201)
})
```

### 4. Testes de Borda
- Teste casos de sucesso E falha
- Teste validações de entrada
- Teste permissões e autenticação
- Teste limites (dados muito grandes, muito pequenos)

### 5. Performance
- Use `test.concurrent` para testes independentes
- Evite operações desnecessárias no `beforeEach`
- Use mocks para serviços externos lentos

## 📝 Exemplos Específicos por Tipo de Rota

### Rotas de Listagem

```typescript
it('should list items with pagination', async () => {
  // Criar dados de teste
  for (let i = 0; i < 25; i++) {
    await testDb.db.insert(items).values({ name: `Item ${i}` })
  }

  const response = await app.inject({
    method: 'GET',
    url: '/items?page=2&limit=10',
    headers: { authorization: `Bearer ${token}` },
  })

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.items).toHaveLength(10)
  expect(body.pagination.page).toBe(2)
  expect(body.pagination.total).toBe(25)
})
```

### Rotas de Criação

```typescript
it('should create item and return created resource', async () => {
  const itemData = {
    name: 'New Item',
    description: 'Item description'
  }

  const response = await app.inject({
    method: 'POST',
    url: '/items',
    headers: { authorization: `Bearer ${token}` },
    payload: itemData,
  })

  expect(response.statusCode).toBe(201)
  const body = JSON.parse(response.body)
  expect(body).toHaveProperty('id')
  
  // Verificar se foi salvo no banco
  const saved = await testDb.db.query.items.findFirst({
    where: eq(items.id, body.id)
  })
  expect(saved).toBeDefined()
  expect(saved?.name).toBe(itemData.name)
})
```

### Rotas de Atualização

```typescript
it('should update existing item', async () => {
  // Criar item inicial
  const [item] = await testDb.db.insert(items).values({
    name: 'Original Name'
  }).returning()

  const updateData = { name: 'Updated Name' }

  const response = await app.inject({
    method: 'PUT',
    url: `/items/${item.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: updateData,
  })

  expect(response.statusCode).toBe(200)
  
  // Verificar se foi atualizado no banco
  const updated = await testDb.db.query.items.findFirst({
    where: eq(items.id, item.id)
  })
  expect(updated?.name).toBe('Updated Name')
})
```

### Rotas de Exclusão

```typescript
it('should delete existing item', async () => {
  // Criar item para deletar
  const [item] = await testDb.db.insert(items).values({
    name: 'To Delete'
  }).returning()

  const response = await app.inject({
    method: 'DELETE',
    url: `/items/${item.id}`,
    headers: { authorization: `Bearer ${token}` },
  })

  expect(response.statusCode).toBe(204)
  
  // Verificar se foi removido do banco
  const deleted = await testDb.db.query.items.findFirst({
    where: eq(items.id, item.id)
  })
  expect(deleted).toBeUndefined()
})
```

---

Com essa configuração, você terá um ambiente robusto de testes que garante a qualidade e confiabilidade das suas rotas! 🎉
