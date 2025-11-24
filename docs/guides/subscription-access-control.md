# Controle de Acesso por Assinatura

## 🎯 Visão Geral

Sistema completo de controle de acesso baseado em planos de assinatura. Bloqueia funcionalidades quando:
- ❌ Organização não tem assinatura ativa
- ❌ Assinatura expirou
- ❌ Limites do plano foram atingidos

## 🗄️ Estrutura de Dados

### Planos Disponíveis

```typescript
// Exemplo de planos no banco de dados
{
  name: "Básico",
  slug: "basic",
  price: "49.90",
  max_members: 20,      // Limite de membros
  max_units: 3,         // Limite de unidades
  max_demands: 100,     // Limite de demandas por mês
  max_storage_gb: 10,   // Limite de armazenamento
}

{
  name: "Profissional",
  max_members: 100,
  max_units: 10,
  max_demands: 1000,
  max_storage_gb: 100,
}

{
  name: "Enterprise",
  max_members: null,    // null = ilimitado
  max_units: null,
  max_demands: null,
  max_storage_gb: 1024,
}
```

### Status de Assinatura

```typescript
type SubscriptionStatus = 
  | 'active'      // ✅ Ativa e paga
  | 'trialing'    // 🎁 Em período de teste
  | 'past_due'    // ⚠️ Pagamento atrasado
  | 'canceled'    // ❌ Cancelada
  | 'unpaid'      // 💳 Não paga

// Estados que permitem acesso:
const allowedStatuses = ['active', 'trialing']
```

## 🔒 Middlewares de Controle

### 1. Verificar Assinatura Ativa

Bloqueia qualquer acesso se a organização não tem assinatura:

```typescript
// src/http/middlewares/billing.ts

export async function requireActiveSubscription(
  request: FastifyRequest<{ Params: { organizationId: string } }>,
  reply: FastifyReply
) {
  const { organizationId } = request.params
  
  // Busca assinatura ativa
  const subscription = await billingService.getActiveSubscription(organizationId)
  
  if (!subscription) {
    return reply.code(403).send({
      message: 'Organização não possui assinatura ativa',
      code: 'NO_ACTIVE_SUBSCRIPTION',
      action: 'REDIRECT_TO_PLANS', // Frontend deve redirecionar
    })
  }
  
  // Verifica se não expirou
  const now = new Date()
  if (subscription.current_period_end < now && subscription.status !== 'trialing') {
    return reply.code(403).send({
      message: 'Assinatura expirada',
      code: 'SUBSCRIPTION_EXPIRED',
      expired_at: subscription.current_period_end,
      action: 'REDIRECT_TO_BILLING',
    })
  }
  
  // Adiciona subscription ao request para uso posterior
  request.subscription = subscription
}
```

### 2. Verificar Limites de Recursos

Bloqueia criação de novos recursos se limite foi atingido:

```typescript
// Middleware genérico para qualquer recurso
export function checkResourceLimit(
  resourceType: 'member' | 'unit' | 'demand'
) {
  return async (request, reply) => {
    const { organizationId } = request.params
    
    const result = await billingService.canCreateResource(
      organizationId, 
      resourceType
    )
    
    if (!result.allowed) {
      return reply.code(403).send({
        message: result.reason || 'Limite do plano atingido',
        code: 'RESOURCE_LIMIT_EXCEEDED',
        resource_type: resourceType,
        current_count: result.current,
        limit: result.limit,
        action: 'UPGRADE_PLAN', // Frontend sugere upgrade
      })
    }
  }
}
```

### 3. Verificar Limite de Armazenamento

Bloqueia upload se limite de storage foi atingido:

```typescript
export async function checkStorageLimit(
  request: FastifyRequest<{ 
    Params: { organizationId: string }
    Body: { file_size?: number }
  }>,
  reply: FastifyReply
) {
  const { organizationId } = request.params
  const fileSize = request.body?.file_size || 0
  
  const subscription = await billingService.getActiveSubscription(organizationId)
  
  if (!subscription) {
    return reply.code(403).send({
      message: 'Sem assinatura ativa',
      code: 'NO_ACTIVE_SUBSCRIPTION',
    })
  }
  
  const usage = await billingService.getCurrentUsage(subscription.id)
  
  // Verifica limite
  if (usage.limits.max_storage_gb) {
    const currentGB = parseFloat(usage.usage.storage_used_gb)
    const fileSizeGB = fileSize / (1024 * 1024 * 1024)
    const maxGB = usage.limits.max_storage_gb
    
    if (currentGB + fileSizeGB > maxGB) {
      return reply.code(403).send({
        message: 'Limite de armazenamento atingido',
        code: 'STORAGE_LIMIT_EXCEEDED',
        current_usage_gb: currentGB,
        limit_gb: maxGB,
        percentage: Math.round((currentGB / maxGB) * 100),
        action: 'UPGRADE_PLAN',
      })
    }
  }
}
```

## 🛠️ Aplicando nas Rotas

### Exemplo 1: Proteger Rota de Criação

```typescript
// src/http/routes/members.ts

app.post('/organizations/:organizationId/members', {
  preHandler: [
    authPreHandler,                    // 1. Verifica autenticação
    requireActiveSubscription,         // 2. Verifica assinatura ativa
    checkResourceLimit('member'),      // 3. Verifica limite de membros
  ],
}, async (request, reply) => {
  // Se chegou aqui, pode criar o membro
  const newMember = await createMember(...)
  return reply.send(newMember)
})
```

### Exemplo 2: Proteger Upload de Arquivos

```typescript
// src/http/routes/attachments.ts

app.post('/organizations/:organizationId/attachments', {
  preHandler: [
    authPreHandler,
    requireActiveSubscription,
    checkStorageLimit,              // Verifica storage antes do upload
  ],
}, async (request, reply) => {
  const file = await request.file()
  // Upload permitido
})
```

### Exemplo 3: Rotas sem Limite

```typescript
// Algumas rotas não precisam verificar limites (apenas assinatura ativa)

app.get('/organizations/:organizationId/dashboard', {
  preHandler: [
    authPreHandler,
    requireActiveSubscription,  // Só verifica se tem assinatura
  ],
}, async (request, reply) => {
  // Visualizar dados não conta para limite
})
```

## 📊 Lógica de Verificação de Limites

### Serviço de Billing

```typescript
// src/services/billing.ts

export class BillingService {
  /**
   * Verifica se organização pode criar novo recurso
   */
  async canCreateResource(
    organizationId: string,
    resourceType: 'member' | 'unit' | 'demand'
  ): Promise<{
    allowed: boolean
    reason?: string
    current?: number
    limit?: number
  }> {
    // 1. Busca assinatura ativa
    const subscription = await this.getActiveSubscription(organizationId)
    
    if (!subscription) {
      return {
        allowed: false,
        reason: 'Organização sem assinatura ativa',
      }
    }
    
    // 2. Busca limites do plano
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.id, subscription.plan_id))
      .limit(1)
    
    if (!plan[0]) {
      return { allowed: false, reason: 'Plano não encontrado' }
    }
    
    // 3. Verifica limite específico
    const limitKey = `max_${resourceType}s` as keyof typeof plan[0]
    const limit = plan[0][limitKey] as number | null
    
    // null = ilimitado
    if (limit === null) {
      return { allowed: true }
    }
    
    // 4. Conta recursos atuais
    let currentCount = 0
    
    switch (resourceType) {
      case 'member':
        const members = await db
          .select({ count: sql<number>`count(*)` })
          .from(membersTable)
          .where(eq(membersTable.organization_id, organizationId))
        currentCount = members[0]?.count || 0
        break
        
      case 'unit':
        const units = await db
          .select({ count: sql<number>`count(*)` })
          .from(unitsTable)
          .where(eq(unitsTable.organization_id, organizationId))
        currentCount = units[0]?.count || 0
        break
        
      case 'demand':
        // Conta demandas do mês atual
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        
        const demands = await db
          .select({ count: sql<number>`count(*)` })
          .from(demandsTable)
          .innerJoin(unitsTable, eq(demandsTable.unit_id, unitsTable.id))
          .where(
            and(
              eq(unitsTable.organization_id, organizationId),
              gte(demandsTable.created_at, startOfMonth)
            )
          )
        currentCount = demands[0]?.count || 0
        break
    }
    
    // 5. Verifica se atingiu limite
    if (currentCount >= limit) {
      return {
        allowed: false,
        reason: `Limite de ${resourceType}s atingido (${currentCount}/${limit})`,
        current: currentCount,
        limit,
      }
    }
    
    return {
      allowed: true,
      current: currentCount,
      limit,
    }
  }
  
  /**
   * Obtém assinatura ativa da organização
   */
  async getActiveSubscription(organizationId: string) {
    const result = await db
      .select()
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.plan_id, plans.id))
      .where(
        and(
          eq(subscriptions.organization_id, organizationId),
          inArray(subscriptions.status, ['active', 'trialing'])
        )
      )
      .limit(1)
    
    return result[0]?.subscriptions || null
  }
  
  /**
   * Obtém uso atual da assinatura
   */
  async getCurrentUsage(subscriptionId: string) {
    const usage = await db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.subscription_id, subscriptionId))
      .orderBy(desc(usageRecords.created_at))
      .limit(1)
    
    const subscription = await db
      .select()
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.plan_id, plans.id))
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
    
    return {
      usage: usage[0] || {
        members_count: 0,
        units_count: 0,
        demands_count: 0,
        storage_used_gb: '0',
      },
      limits: {
        max_members: subscription[0]?.plans?.max_members,
        max_units: subscription[0]?.plans?.max_units,
        max_demands: subscription[0]?.plans?.max_demands,
        max_storage_gb: subscription[0]?.plans?.max_storage_gb,
      },
    }
  }
}
```

## 🎨 Implementação no Frontend

### 1. Interceptor de Erros

```typescript
// lib/api.ts

import axios from 'axios'
import { useRouter } from 'next/navigation'

const api = axios.create({
  baseURL: 'https://api.equipeativa.com',
})

api.interceptors.response.use(
  response => response,
  error => {
    const { response } = error
    
    if (response?.status === 403) {
      const { code, action } = response.data
      
      switch (code) {
        case 'NO_ACTIVE_SUBSCRIPTION':
          // Redireciona para página de planos
          window.location.href = '/plans'
          break
          
        case 'SUBSCRIPTION_EXPIRED':
          // Redireciona para billing
          window.location.href = '/settings/billing'
          break
          
        case 'RESOURCE_LIMIT_EXCEEDED':
          // Mostra modal de upgrade
          showUpgradeModal(response.data)
          break
          
        case 'STORAGE_LIMIT_EXCEEDED':
          // Mostra aviso de storage
          showStorageAlert(response.data)
          break
      }
    }
    
    return Promise.reject(error)
  }
)
```

### 2. Componente de Limite Atingido

```tsx
// components/LimitReachedModal.tsx

'use client'

import { useState } from 'react'

interface LimitError {
  message: string
  code: string
  resource_type: string
  current_count: number
  limit: number
}

export default function LimitReachedModal({ 
  error, 
  onClose 
}: { 
  error: LimitError
  onClose: () => void
}) {
  const resourceNames = {
    member: 'membros',
    unit: 'unidades',
    demand: 'demandas',
  }
  
  const resourceName = resourceNames[error.resource_type as keyof typeof resourceNames]
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h3 className="text-xl font-bold mb-2">
            Limite Atingido
          </h3>
          
          <p className="text-gray-600 mb-4">
            Você atingiu o limite de <strong>{error.limit} {resourceName}</strong> do seu plano atual.
          </p>
          
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600 mb-2">Uso atual</div>
            <div className="text-3xl font-bold text-gray-900">
              {error.current_count} / {error.limit}
            </div>
            <div className="text-sm text-gray-500 mt-1">{resourceName}</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <a
            href="/plans"
            className="block w-full py-3 px-6 bg-blue-600 text-white text-center rounded-lg font-semibold hover:bg-blue-700"
          >
            Fazer Upgrade
          </a>
          
          <button
            onClick={onClose}
            className="block w-full py-3 px-6 border-2 border-gray-300 text-gray-700 text-center rounded-lg font-semibold hover:border-gray-400"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 3. Indicador de Uso do Plano

```tsx
// components/PlanUsageWidget.tsx

'use client'

import { useEffect, useState } from 'react'

interface Usage {
  members: { current: number; limit: number | null }
  units: { current: number; limit: number | null }
  demands: { current: number; limit: number | null }
  storage: { current: number; limit: number | null }
}

export default function PlanUsageWidget({ organizationId }: { organizationId: string }) {
  const [usage, setUsage] = useState<Usage | null>(null)
  
  useEffect(() => {
    fetch(`/api/organizations/${organizationId}/usage`)
      .then(res => res.json())
      .then(setUsage)
  }, [organizationId])
  
  if (!usage) return <div>Carregando...</div>
  
  const calculatePercentage = (current: number, limit: number | null) => {
    if (limit === null) return 0 // ilimitado
    return Math.min(Math.round((current / limit) * 100), 100)
  }
  
  const getColorClass = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">Uso do Plano</h3>
      
      <div className="space-y-4">
        {/* Membros */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Membros</span>
            <span>
              {usage.members.current} / {usage.members.limit || '∞'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getColorClass(calculatePercentage(usage.members.current, usage.members.limit))}`}
              style={{ width: `${calculatePercentage(usage.members.current, usage.members.limit)}%` }}
            />
          </div>
        </div>
        
        {/* Unidades */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Unidades</span>
            <span>
              {usage.units.current} / {usage.units.limit || '∞'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getColorClass(calculatePercentage(usage.units.current, usage.units.limit))}`}
              style={{ width: `${calculatePercentage(usage.units.current, usage.units.limit)}%` }}
            />
          </div>
        </div>
        
        {/* Storage */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Armazenamento</span>
            <span>
              {usage.storage.current} GB / {usage.storage.limit || '∞'} GB
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getColorClass(calculatePercentage(usage.storage.current, usage.storage.limit))}`}
              style={{ width: `${calculatePercentage(usage.storage.current, usage.storage.limit)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Aviso se próximo do limite */}
      {Object.values(usage).some(u => u.limit && calculatePercentage(u.current, u.limit) >= 80) && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
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
```

## 🚨 Cenários e Respostas

### Cenário 1: Sem Assinatura

**Request:**
```bash
POST /organizations/123/members
```

**Response: 403**
```json
{
  "message": "Organização não possui assinatura ativa",
  "code": "NO_ACTIVE_SUBSCRIPTION",
  "action": "REDIRECT_TO_PLANS"
}
```

**Frontend deve:** Redirecionar para `/plans`

### Cenário 2: Assinatura Expirada

**Response: 403**
```json
{
  "message": "Assinatura expirada",
  "code": "SUBSCRIPTION_EXPIRED",
  "expired_at": "2024-11-15T00:00:00Z",
  "action": "REDIRECT_TO_BILLING"
}
```

**Frontend deve:** Redirecionar para `/settings/billing`

### Cenário 3: Limite Atingido

**Response: 403**
```json
{
  "message": "Limite de membros atingido (20/20)",
  "code": "RESOURCE_LIMIT_EXCEEDED",
  "resource_type": "member",
  "current_count": 20,
  "limit": 20,
  "action": "UPGRADE_PLAN"
}
```

**Frontend deve:** Mostrar modal de upgrade

### Cenário 4: Storage Cheio

**Response: 403**
```json
{
  "message": "Limite de armazenamento atingido",
  "code": "STORAGE_LIMIT_EXCEEDED",
  "current_usage_gb": 9.8,
  "limit_gb": 10,
  "percentage": 98,
  "action": "UPGRADE_PLAN"
}
```

**Frontend deve:** Mostrar alerta e sugerir limpeza ou upgrade

## ✅ Checklist de Implementação

- [ ] Middlewares criados (`requireActiveSubscription`, `checkResourceLimit`, `checkStorageLimit`)
- [ ] Aplicado em todas as rotas de criação (members, units, demands, attachments)
- [ ] Frontend intercepta erros 403
- [ ] Modal de upgrade implementado
- [ ] Widget de uso do plano no dashboard
- [ ] Endpoint de uso criado (`GET /organizations/:id/usage`)
- [ ] Teste com plano gratuito (limites baixos)
- [ ] Teste com plano expirado
- [ ] Teste fluxo de upgrade

## 🔄 Fluxo Completo

```
1. Usuário tenta criar membro
   ↓
2. Backend verifica: tem assinatura?
   ↓ NÃO
   403 NO_ACTIVE_SUBSCRIPTION → Redireciona /plans
   ↓ SIM
3. Backend verifica: assinatura expirou?
   ↓ SIM
   403 SUBSCRIPTION_EXPIRED → Redireciona /billing
   ↓ NÃO
4. Backend verifica: atingiu limite?
   ↓ SIM
   403 RESOURCE_LIMIT_EXCEEDED → Modal de upgrade
   ↓ NÃO
5. ✅ Cria o membro com sucesso
```

## 📊 Endpoint de Uso (criar)

```typescript
// src/http/routes/usage.ts

app.get('/organizations/:organizationId/usage', {
  preHandler: [authPreHandler],
}, async (request, reply) => {
  const { organizationId } = request.params
  
  const subscription = await billingService.getActiveSubscription(organizationId)
  
  if (!subscription) {
    return reply.send({
      members: { current: 0, limit: 0 },
      units: { current: 0, limit: 0 },
      demands: { current: 0, limit: 0 },
      storage: { current: 0, limit: 0 },
    })
  }
  
  const usage = await billingService.getCurrentUsage(subscription.id)
  
  return reply.send({
    members: {
      current: usage.usage.members_count,
      limit: usage.limits.max_members,
    },
    units: {
      current: usage.usage.units_count,
      limit: usage.limits.max_units,
    },
    demands: {
      current: usage.usage.demands_count,
      limit: usage.limits.max_demands,
    },
    storage: {
      current: parseFloat(usage.usage.storage_used_gb),
      limit: usage.limits.max_storage_gb,
    },
  })
})
```

Pronto! Sistema completo de controle de acesso baseado em assinatura. 🚀
