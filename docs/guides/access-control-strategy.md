# 🔐 Estratégia de Controle de Acesso - Sistema Equipe Ativa

## 📋 Visão Geral

O sistema implementa controle de acesso em **3 camadas sequenciais**:

```
1. AUTENTICAÇÃO → Verifica se usuário está logado
2. AUTORIZAÇÃO → Verifica permissões do role (RBAC)
3. BILLING → Verifica limites do plano contratado
```

## 🎯 Arquitetura Implementada

### Camada 1: Autenticação (authPreHandler)

**Middleware:** `authPreHandler`

**Responsabilidade:**
- Valida token JWT
- Verifica se usuário existe e está ativo
- Verifica se sessão não expirou

**Uso:**
```typescript
preHandler: [authPreHandler]
```

**Quando aplicar:** Todas as rotas protegidas

---

### Camada 2: Autorização (RBAC via CASL)

**Sistema:** Role-Based Access Control com CASL

**Roles disponíveis:**
- `ADMIN` - Administrador da organização/unidade
- `MANAGER` - RH, gerencia funcionários
- `CLERK` - Recepcionista, cadastra pacientes
- `ANALYST` - Médico, atende demandas
- `BILLING` - Faturista, processa pagamentos

**Verificação:**
```typescript
const { cannot } = getUserPermissions(userId, role)

if (cannot('create', 'Applicant')) {
  throw new UnauthorizedError('Sem permissão')
}
```

**Quando aplicar:** Após autenticação, dentro da lógica da rota

---

### Camada 3: Billing (Limites do Plano)

**Middlewares:**
- `checkResourceLimit(resourceType)` - Para recursos contáveis
- `checkStorageLimit` - Para uploads de arquivos

**Recursos monitorados:**
- `member` - Membros/funcionários da organização
- `unit` - Unidades/clínicas
- `applicant` - Pacientes/solicitantes
- `storage` - Armazenamento em GB

**Uso:**
```typescript
preHandler: [
  authPreHandler,
  checkResourceLimit('member')
]
```

**Quando aplicar:** Rotas de criação de recursos e uploads

---

## 🚀 Implementação por Rota

### ✅ Rotas Protegidas Implementadas

#### 1. Criar Unidade
```typescript
// src/http/routes/units/create-unit.ts
POST /organizations/:organizationSlug/units

preHandler: [
  authPreHandler,                    // ✅ Autenticação
  checkResourceLimit('unit'),        // ✅ Limite de unidades
]

// Dentro da rota:
if (membership.organization_role !== 'ADMIN') {
  throw new ForbiddenError()         // ✅ Autorização RBAC
}
```

#### 2. Criar Applicant (Paciente)
```typescript
// src/http/routes/applicants/create-applicant.ts
POST /organizations/:organizationSlug/applicants

preHandler: [
  authPreHandler,                    // ✅ Autenticação
  checkResourceLimit('applicant'),   // ✅ Limite de pacientes
]

// Dentro da rota:
const { cannot } = getUserPermissions(userId, role)
if (cannot('create', 'Applicant')) {
  throw new UnauthorizedError()      // ✅ Autorização RBAC
}
```

#### 3. Criar Convite (Novo Membro)
```typescript
// src/http/routes/invites/create-invite.ts
POST /organizations/:organizationSlug/invites

preHandler: [
  authPreHandler,                    // ✅ Autenticação
  checkResourceLimit('member'),      // ✅ Limite de membros
]

// Dentro da rota:
const { cannot } = getUserPermissions(userId, role)
if (cannot('create', 'Invite')) {
  throw new UnauthorizedError()      // ✅ Autorização RBAC
}
```

#### 4. Upload de Documentos
```typescript
// src/http/routes/attachments/upload-*-document.ts
POST /organizations/:organizationSlug/*/documents

preHandler: [
  authPreHandler,                    // ✅ Autenticação
  checkStorageLimit,                 // ✅ Limite de armazenamento
]
```

Arquivos protegidos:
- ✅ `upload-demand-document.ts`
- ✅ `upload-applicant-document.ts`
- ✅ `upload-organization-document.ts`

---

## 📊 Estratégia por Tipo de Usuário

### 🆕 Usuário Novo (Sem Organização)

**Fluxo de Onboarding:**

```
1. Registro
   └─> Cria conta de usuário

2. Seleção de Plano
   └─> Escolhe plano (com trial de 14 dias)

3. Criação de Organização
   └─> Subscription status: 'trialing'
   └─> Todos os limites do plano aplicados

4. Primeira Unidade
   └─> Liberado criar 1 unidade (no trial)

5. Convite de Membros
   └─> Respeitando limite do plano
```

**Limites no Trial:**
```typescript
// Plano Gratuito (Trial - 14 dias)
max_members: 5
max_units: 1
max_applicants: 50
max_storage_gb: 1
```

---

### ✅ Usuário com Assinatura Ativa

**Verificações Automáticas:**

Toda ação de criação passa por:

```typescript
1. authPreHandler
   ├─> JWT válido? ✅
   └─> Usuário ativo? ✅

2. checkResourceLimit / checkStorageLimit
   ├─> Busca assinatura ativa
   ├─> Verifica limites do plano no Stripe
   ├─> Conta recursos atuais no banco
   └─> Compara: atual < limite? ✅

3. Verificação RBAC (dentro da rota)
   ├─> Role tem permissão? ✅
   └─> Executar ação
```

**Exemplo prático:**
```typescript
// Usuário MANAGER tenta criar membro
POST /organizations/clinica-abc/invites
{
  "email": "novo@medico.com",
  "role": "ANALYST"
}

// Sistema verifica:
✅ Usuário autenticado (JWT válido)
✅ Organização tem assinatura ativa
✅ Plano: Básico (max_members: 20)
✅ Membros atuais: 15
✅ 15 < 20 → PERMITIDO
✅ Role MANAGER pode criar convites
→ Convite criado com sucesso
```

---

### ❌ Usuário com Assinatura Expirada

**Bloqueio Total:**

```typescript
// Middleware detecta automaticamente
const subscription = await billingService.getActiveSubscription(orgId)

if (!subscription) {
  return reply.status(403).send({
    code: 'NO_ACTIVE_SUBSCRIPTION',
    message: 'Assinatura expirada ou cancelada',
    action: 'REDIRECT_TO_BILLING'
  })
}
```

**Frontend deve:**
- Interceptar erro 403 com código `NO_ACTIVE_SUBSCRIPTION`
- Redirecionar para página de pagamento
- Exibir modal explicativo

---

### ⚠️ Usuário Atingiu Limite do Plano

**Bloqueio Específico:**

```typescript
// Tentativa de criar 21º membro (limite: 20)
return reply.status(403).send({
  code: 'RESOURCE_LIMIT_EXCEEDED',
  resource_type: 'member',
  message: 'Limite de membros atingido (20/20)',
  current_count: 20,
  limit: 20,
  action: 'UPGRADE_PLAN'
})
```

**Frontend deve:**
- Exibir modal de upgrade
- Mostrar uso atual vs limite
- Botão para escolher plano superior

---

## 🎨 Integração com Frontend

### 1. Interceptor de Erros

```typescript
// lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

api.interceptors.response.use(
  response => response,
  error => {
    const { response } = error
    
    if (response?.status === 403) {
      const { code, action } = response.data
      
      switch (code) {
        case 'NO_ACTIVE_SUBSCRIPTION':
          // Redireciona para billing
          window.location.href = '/settings/billing'
          break
          
        case 'SUBSCRIPTION_EXPIRED':
          // Modal de assinatura expirada
          showExpiredModal(response.data)
          break
          
        case 'RESOURCE_LIMIT_EXCEEDED':
          // Modal de upgrade
          showUpgradeModal(response.data)
          break
          
        case 'STORAGE_LIMIT_EXCEEDED':
          // Alerta de storage cheio
          showStorageAlert(response.data)
          break
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
```

---

### 2. Widget de Uso do Plano

```typescript
// components/PlanUsageWidget.tsx
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export default function PlanUsageWidget({ organizationId }) {
  const [usage, setUsage] = useState(null)
  
  useEffect(() => {
    api.get(`/organizations/${organizationId}/usage`)
      .then(res => setUsage(res.data))
  }, [organizationId])
  
  if (!usage) return <div>Carregando...</div>
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">
        Plano: {usage.plan_name}
      </h3>
      
      {/* Membros */}
      <UsageBar
        label="Membros"
        current={usage.members.current}
        limit={usage.members.limit}
        percentage={usage.members.percentage}
      />
      
      {/* Unidades */}
      <UsageBar
        label="Unidades"
        current={usage.units.current}
        limit={usage.units.limit}
        percentage={usage.units.percentage}
      />
      
      {/* Pacientes */}
      <UsageBar
        label="Pacientes"
        current={usage.applicants.current}
        limit={usage.applicants.limit}
        percentage={usage.applicants.percentage}
      />
      
      {/* Storage */}
      <UsageBar
        label="Armazenamento"
        current={`${usage.storage.current} GB`}
        limit={`${usage.storage.limit} GB`}
        percentage={usage.storage.percentage}
      />
      
      {/* Aviso se próximo do limite */}
      {usage.members.percentage >= 80 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            ⚠️ Você está próximo do limite do seu plano.
            <a href="/plans" className="ml-1 underline font-semibold">
              Fazer upgrade
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

function UsageBar({ label, current, limit, percentage }) {
  const getColorClass = (pct) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{current} / {limit || '∞'}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getColorClass(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}
```

---

### 3. Modal de Limite Atingido

```typescript
// components/LimitReachedModal.tsx
'use client'

interface Props {
  error: {
    message: string
    resource_type: string
    current_count: number
    limit: number
  }
  onClose: () => void
}

export default function LimitReachedModal({ error, onClose }: Props) {
  const resourceNames = {
    member: 'membros',
    unit: 'unidades',
    applicant: 'pacientes',
  }
  
  const name = resourceNames[error.resource_type]
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            ⚠️
          </div>
          
          <h3 className="text-xl font-bold mb-2">
            Limite Atingido
          </h3>
          
          <p className="text-gray-600 mb-4">
            Você atingiu o limite de <strong>{error.limit} {name}</strong> do seu plano atual.
          </p>
          
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600 mb-2">Uso atual</div>
            <div className="text-3xl font-bold text-gray-900">
              {error.current_count} / {error.limit}
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <a
            href="/plans"
            className="block w-full py-3 px-6 bg-blue-600 text-white text-center rounded-lg font-semibold hover:bg-blue-700"
          >
            Ver Planos
          </a>
          
          <button
            onClick={onClose}
            className="block w-full py-3 px-6 border-2 border-gray-300 text-gray-700 text-center rounded-lg font-semibold"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 🧪 Testes

### Testar Limite de Membros

```bash
# 1. Criar organização com plano Básico (max_members: 5)
POST /organizations
{
  "name": "Clínica Teste",
  "plan_slug": "basic"
}

# 2. Criar 5 convites
for i in {1..5}; do
  POST /organizations/clinica-teste/invites
  {
    "email": "membro${i}@teste.com",
    "role": "ANALYST"
  }
done

# 3. Tentar criar 6º convite (deve falhar)
POST /organizations/clinica-teste/invites
{
  "email": "membro6@teste.com",
  "role": "ANALYST"
}

# Esperado:
# 403 RESOURCE_LIMIT_EXCEEDED
```

---

### Testar Assinatura Expirada

```bash
# 1. Cancelar assinatura
POST /subscriptions/:id/cancel

# 2. Tentar criar qualquer recurso
POST /organizations/clinica-teste/applicants

# Esperado:
# 403 NO_ACTIVE_SUBSCRIPTION
```

---

## 📊 Endpoints de Uso

### Obter Estatísticas de Uso

```bash
GET /organizations/:organizationId/usage
```

**Resposta:**
```json
{
  "plan_name": "Básico",
  "members": {
    "current": 15,
    "limit": 20,
    "percentage": 75
  },
  "units": {
    "current": 2,
    "limit": 3,
    "percentage": 67
  },
  "applicants": {
    "current": 45,
    "limit": 50,
    "percentage": 90
  },
  "storage": {
    "current": 3.5,
    "limit": 10,
    "percentage": 35
  }
}
```

---

### Verificar se Pode Criar Recurso

```bash
GET /organizations/:organizationId/can-create/:resourceType
```

**Parâmetros:**
- `resourceType`: `member`, `unit`, ou `applicant`

**Resposta (Permitido):**
```json
{
  "allowed": true,
  "current": 15,
  "limit": 20
}
```

**Resposta (Bloqueado):**
```json
{
  "allowed": false,
  "reason": "Limite de members atingido (20/20)",
  "current": 20,
  "limit": 20
}
```

---

## 🔧 Configuração

### Limites Padrão dos Planos

Os limites são definidos no **metadata do produto Stripe**:

```typescript
// Produto no Stripe
{
  name: "Plano Básico",
  metadata: {
    max_members: "20",
    max_units: "3",
    max_applicants: "100",
    max_storage_gb: "10"
  }
}
```

### Como Atualizar Limites

1. **Via Stripe Dashboard:**
   - Acesse o produto
   - Edite metadata
   - Sistema detecta automaticamente

2. **Via API do Stripe:**
```typescript
await stripe.products.update('prod_xxx', {
  metadata: {
    max_members: '50',
    max_units: '10',
  }
})
```

---

## 🚨 Códigos de Erro

| Código | Status | Descrição | Ação Frontend |
|--------|--------|-----------|---------------|
| `NO_ACTIVE_SUBSCRIPTION` | 403 | Sem assinatura ativa | Redirecionar para `/settings/billing` |
| `SUBSCRIPTION_EXPIRED` | 403 | Assinatura expirou | Modal de renovação |
| `RESOURCE_LIMIT_EXCEEDED` | 403 | Limite do plano atingido | Modal de upgrade |
| `STORAGE_LIMIT_EXCEEDED` | 403 | Storage cheio | Alerta + sugerir limpeza ou upgrade |

---

## ✅ Checklist de Implementação

### Backend
- [x] Middleware `authPreHandler` (autenticação)
- [x] Middleware `checkResourceLimit` (limites do plano)
- [x] Middleware `checkStorageLimit` (limite de storage)
- [x] Sistema CASL (RBAC por role)
- [x] `usageTrackingService.canCreateResource()`
- [x] `billingService.getActiveSubscription()`
- [x] Rotas protegidas:
  - [x] `create-unit.ts`
  - [x] `create-applicant.ts`
  - [x] `create-invite.ts`
  - [x] `upload-demand-document.ts`
  - [x] `upload-applicant-document.ts`
  - [x] `upload-organization-document.ts`

### Frontend (Pendente)
- [ ] Interceptor de erros 403
- [ ] Widget de uso do plano
- [ ] Modal de limite atingido
- [ ] Modal de assinatura expirada
- [ ] Endpoint `/usage` integrado

---

## 📝 Notas Importantes

1. **Verificação em Tempo Real:** Os limites são verificados **sempre** contando direto do banco de dados, não dependem de cache ou registros pré-calculados.

2. **Limites do Stripe:** Os limites são obtidos do **metadata do produto Stripe**, permitindo mudanças sem deploy.

3. **Ordem de Execução:** Sempre seguir a ordem:
   ```
   authPreHandler → checkResourceLimit → RBAC → Ação
   ```

4. **Performance:** As queries de contagem usam índices no banco para garantir performance.

5. **Segurança:** Sempre validar no **backend**, nunca confiar apenas no frontend.

---

## 🎓 Referências

- [CASL Documentation](https://casl.js.org/)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions)
- [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/)

---

**Última atualização:** 25 de novembro de 2025  
**Versão:** 1.0.0
