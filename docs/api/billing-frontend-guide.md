# API de Billing e Controle de Uso - Guia Frontend

## 🎯 Rotas Disponíveis

### 1. Listar Produtos/Planos do Stripe

**Endpoint:** `GET /stripe/products`

**Autenticação:** Não requerida

**Headers:** Nenhum

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "prod_xxx",
    "name": "Plano Básico",
    "description": "Ideal para pequenas equipes",
    "active": true,
    "metadata": {
      "features": "20 membros, 3 unidades",
      "popular": "false"
    },
    "default_price": {
      "id": "price_xxx",
      "unit_amount": 4990,
      "currency": "brl",
      "recurring": {
        "interval": "month",
        "interval_count": 1
      }
    }
  },
  {
    "id": "prod_yyy",
    "name": "Plano Profissional",
    "description": "Para equipes em crescimento",
    "active": true,
    "default_price": {
      "id": "price_yyy",
      "unit_amount": 14990,
      "currency": "brl",
      "recurring": {
        "interval": "month"
      }
    }
  }
]
```

**Exemplo de Uso:**
```typescript
async function loadPlans() {
  const response = await fetch('https://api.equipeativa.com/stripe/products')
  const plans = await response.json()
  return plans
}
```

---

### 2. Listar Preços do Stripe

**Endpoint:** `GET /stripe/prices`

**Autenticação:** Não requerida

**Headers:** Nenhum

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "price_monthly_basic",
    "unit_amount": 4990,
    "currency": "brl",
    "recurring": {
      "interval": "month",
      "interval_count": 1
    },
    "product": {
      "id": "prod_xxx",
      "name": "Plano Básico"
    }
  },
  {
    "id": "price_yearly_basic",
    "unit_amount": 49900,
    "currency": "brl",
    "recurring": {
      "interval": "year",
      "interval_count": 1
    },
    "product": {
      "id": "prod_xxx",
      "name": "Plano Básico"
    }
  }
]
```

---

### 3. Criar Sessão de Checkout

**Endpoint:** `POST /stripe/checkout`

**Autenticação:** Requerida (Bearer Token)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "priceId": "price_xxx",
  "customerEmail": "usuario@example.com",
  "successUrl": "https://seuapp.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://seuapp.com/plans",
  "metadata": {
    "organizationId": "uuid-da-organizacao",
    "planName": "Plano Básico"
  }
}
```

**Campos Obrigatórios:**
- `priceId` (string): ID do preço no Stripe
- `successUrl` (string): URL de redirecionamento após sucesso (incluir `{CHECKOUT_SESSION_ID}`)
- `cancelUrl` (string): URL de redirecionamento após cancelamento

**Campos Opcionais:**
- `customerEmail` (string): Email do cliente
- `metadata` (object): Dados adicionais para rastreamento

**Resposta de Sucesso (200):**
```json
{
  "sessionId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Resposta de Erro (400):**
```json
{
  "error": "priceId, successUrl e cancelUrl são obrigatórios"
}
```

**Resposta de Erro (500):**
```json
{
  "error": "Erro ao criar checkout"
}
```

**Exemplo de Uso:**
```typescript
async function createCheckout(priceId: string, email: string) {
  const token = localStorage.getItem('token')
  
  const response = await fetch('https://api.equipeativa.com/stripe/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      priceId,
      customerEmail: email,
      successUrl: `${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/plans`,
      metadata: {
        organizationId: 'org-uuid',
      },
    }),
  })
  
  const { url } = await response.json()
  
  // Redireciona para o Stripe Checkout
  window.location.href = url
}
```

---

### 4. Obter Detalhes da Sessão de Checkout

**Endpoint:** `GET /stripe/checkout/:sessionId`

**Autenticação:** Requerida (Bearer Token)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
```

**Parâmetros de URL:**
- `sessionId` (string): ID da sessão retornado na URL de sucesso

**Resposta de Sucesso (200):**
```json
{
  "id": "cs_test_xxx",
  "status": "complete",
  "payment_status": "paid",
  "customer": {
    "id": "cus_xxx",
    "email": "usuario@example.com"
  },
  "subscription": {
    "id": "sub_xxx",
    "status": "active",
    "current_period_end": 1735689600
  },
  "amount_total": 4990,
  "currency": "brl"
}
```

**Exemplo de Uso:**
```typescript
async function getCheckoutSession(sessionId: string) {
  const token = localStorage.getItem('token')
  
  const response = await fetch(
    `https://api.equipeativa.com/stripe/checkout/${sessionId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  
  return await response.json()
}
```

---

### 5. Listar Assinaturas do Cliente

**Endpoint:** `GET /stripe/subscriptions?customerEmail=<email>`

**Autenticação:** Requerida (Bearer Token)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
```

**Query Parameters:**
- `customerEmail` (string, obrigatório): Email do cliente

**Resposta de Sucesso (200):**
```json
{
  "subscriptions": [
    {
      "id": "sub_xxx",
      "status": "active",
      "current_period_start": 1732924800,
      "current_period_end": 1735689600,
      "cancel_at_period_end": false,
      "items": {
        "data": [
          {
            "id": "si_xxx",
            "price": {
              "id": "price_xxx",
              "unit_amount": 4990,
              "currency": "brl",
              "recurring": {
                "interval": "month"
              },
              "product": {
                "id": "prod_xxx",
                "name": "Plano Básico"
              }
            }
          }
        ]
      }
    }
  ]
}
```

**Resposta quando não tem assinaturas (200):**
```json
{
  "subscriptions": []
}
```

**Resposta de Erro (400):**
```json
{
  "error": "customerEmail é obrigatório"
}
```

**Exemplo de Uso:**
```typescript
async function getSubscriptions(email: string) {
  const token = localStorage.getItem('token')
  
  const response = await fetch(
    `https://api.equipeativa.com/stripe/subscriptions?customerEmail=${email}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  
  const { subscriptions } = await response.json()
  return subscriptions
}
```

---

### 6. Cancelar Assinatura

**Endpoint:** `POST /stripe/subscriptions/:subscriptionId/cancel`

**Autenticação:** Requerida (Bearer Token)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
Content-Type: application/json
```

**Parâmetros de URL:**
- `subscriptionId` (string): ID da assinatura no Stripe

**Body:**
```json
{
  "immediately": false
}
```

**Campos Opcionais:**
- `immediately` (boolean): Se `true`, cancela imediatamente. Se `false` (padrão), cancela no fim do período

**Resposta de Sucesso (200):**
```json
{
  "id": "sub_xxx",
  "status": "active",
  "cancel_at_period_end": true,
  "current_period_end": 1735689600
}
```

**Exemplo de Uso:**
```typescript
async function cancelSubscription(subscriptionId: string, immediately = false) {
  const token = localStorage.getItem('token')
  
  const response = await fetch(
    `https://api.equipeativa.com/stripe/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ immediately }),
    }
  )
  
  return await response.json()
}
```

---

### 7. Criar Portal do Cliente

**Endpoint:** `POST /stripe/customer-portal`

**Autenticação:** Requerida (Bearer Token)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "customerEmail": "usuario@example.com",
  "returnUrl": "https://seuapp.com/settings/billing"
}
```

**Campos Obrigatórios:**
- `customerEmail` (string): Email do cliente
- `returnUrl` (string): URL para onde voltar após gerenciar

**Resposta de Sucesso (200):**
```json
{
  "url": "https://billing.stripe.com/p/session/test_xxx"
}
```

**Resposta de Erro (400):**
```json
{
  "error": "customerEmail e returnUrl são obrigatórios"
}
```

**Resposta de Erro (404):**
```json
{
  "error": "Customer não encontrado"
}
```

**Exemplo de Uso:**
```typescript
async function openCustomerPortal(email: string) {
  const token = localStorage.getItem('token')
  
  const response = await fetch(
    'https://api.equipeativa.com/stripe/customer-portal',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        customerEmail: email,
        returnUrl: window.location.href,
      }),
    }
  )
  
  const { url } = await response.json()
  
  // Redireciona para o Customer Portal do Stripe
  window.location.href = url
}
```

---

### 8. Obter Uso Atual da Organização

**Endpoint:** `GET /organizations/:organizationId/usage`

**Autenticação:** Requerida (Bearer Token)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
```

**Parâmetros de URL:**
- `organizationId` (string): UUID da organização

**Resposta de Sucesso (200):**
```json
{
  "plan_name": "Plano Básico",
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
  "demands": {
    "current": 45,
    "limit": 100,
    "percentage": 45
  },
  "storage": {
    "current": 3.5,
    "limit": 10,
    "percentage": 35
  }
}
```

**Campos da Resposta:**
- `plan_name` (string): Nome do plano atual
- `members.current` (number): Número atual de membros
- `members.limit` (number | null): Limite de membros (null = ilimitado)
- `members.percentage` (number): Percentual de uso (0-100)
- Mesma estrutura para `units`, `demands` e `storage`

**Resposta de Erro (404):**
```json
{
  "message": "Organização não possui assinatura ativa",
  "code": "NO_ACTIVE_SUBSCRIPTION"
}
```

**Exemplo de Uso:**
```typescript
async function getOrganizationUsage(organizationId: string) {
  const token = localStorage.getItem('token')
  
  const response = await fetch(
    `https://api.equipeativa.com/organizations/${organizationId}/usage`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  
  if (!response.ok) {
    throw new Error('Organização sem assinatura ativa')
  }
  
  return await response.json()
}
```

---

### 9. Verificar se Pode Criar Recurso

**Endpoint:** `GET /organizations/:organizationId/can-create/:resourceType`

**Autenticação:** Requerida (Bearer Token)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
```

**Parâmetros de URL:**
- `organizationId` (string): UUID da organização
- `resourceType` (string): Tipo de recurso (`member`, `unit` ou `demand`)

**Resposta de Sucesso - Permitido (200):**
```json
{
  "allowed": true,
  "current": 15,
  "limit": 20
}
```

**Resposta de Sucesso - Bloqueado (200):**
```json
{
  "allowed": false,
  "reason": "Limite de members atingido (20/20)",
  "current": 20,
  "limit": 20
}
```

**Exemplo de Uso:**
```typescript
async function canCreateMember(organizationId: string): Promise<boolean> {
  const token = localStorage.getItem('token')
  
  const response = await fetch(
    `https://api.equipeativa.com/organizations/${organizationId}/can-create/member`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  
  const result = await response.json()
  
  if (!result.allowed) {
    alert(result.reason)
    return false
  }
  
  return true
}

// Uso no botão
async function handleCreateMember() {
  const canCreate = await canCreateMember(orgId)
  if (canCreate) {
    showCreateMemberForm()
  }
}
```

---

## 🚨 Códigos de Erro Comuns

### Erro de Assinatura

**Status:** 403

**Body:**
```json
{
  "message": "Organização não possui assinatura ativa",
  "code": "NO_ACTIVE_SUBSCRIPTION",
  "action": "REDIRECT_TO_PLANS"
}
```

**Como Tratar:**
```typescript
if (error.code === 'NO_ACTIVE_SUBSCRIPTION') {
  window.location.href = '/plans'
}
```

---

### Erro de Assinatura Expirada

**Status:** 403

**Body:**
```json
{
  "message": "Assinatura expirada",
  "code": "SUBSCRIPTION_EXPIRED",
  "expired_at": "2024-11-15T00:00:00Z",
  "action": "REDIRECT_TO_BILLING"
}
```

**Como Tratar:**
```typescript
if (error.code === 'SUBSCRIPTION_EXPIRED') {
  window.location.href = '/settings/billing'
}
```

---

### Erro de Limite Atingido

**Status:** 403

**Body:**
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

**Como Tratar:**
```typescript
if (error.code === 'RESOURCE_LIMIT_EXCEEDED') {
  showUpgradeModal({
    resourceType: error.resource_type,
    current: error.current_count,
    limit: error.limit,
  })
}
```

---

### Erro de Storage Cheio

**Status:** 403

**Body:**
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

---

## 🎨 Interceptor de Erros Global

```typescript
// lib/api.ts
import axios from 'axios'

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
          window.location.href = '/plans'
          break
          
        case 'SUBSCRIPTION_EXPIRED':
          window.location.href = '/settings/billing'
          break
          
        case 'RESOURCE_LIMIT_EXCEEDED':
          showUpgradeModal(response.data)
          break
          
        case 'STORAGE_LIMIT_EXCEEDED':
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

## 📝 Exemplos Completos

### Fluxo de Assinatura Completo

```typescript
// 1. Listar planos
const plans = await fetch('/stripe/products').then(r => r.json())

// 2. Usuário escolhe plano
const selectedPlan = plans[0]

// 3. Criar checkout
const checkoutResponse = await fetch('/stripe/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    priceId: selectedPlan.default_price.id,
    customerEmail: user.email,
    successUrl: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/plans`,
  }),
})

const { url } = await checkoutResponse.json()

// 4. Redirecionar para Stripe
window.location.href = url

// 5. Após pagamento, na página de sucesso
const params = new URLSearchParams(window.location.search)
const sessionId = params.get('session_id')

const session = await fetch(`/stripe/checkout/${sessionId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
}).then(r => r.json())

console.log('Assinatura ativa:', session.subscription.id)
```

### Verificar Uso Antes de Criar

```typescript
async function handleCreateMember() {
  // 1. Verificar se pode criar
  const canCreate = await fetch(
    `/organizations/${orgId}/can-create/member`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  ).then(r => r.json())
  
  if (!canCreate.allowed) {
    // 2. Mostrar modal de upgrade
    showUpgradeModal({
      message: canCreate.reason,
      current: canCreate.current,
      limit: canCreate.limit,
    })
    return
  }
  
  // 3. Pode criar - mostra formulário
  showCreateMemberForm()
}
```

### Widget de Uso

```typescript
function UsageWidget({ organizationId }: { organizationId: string }) {
  const [usage, setUsage] = useState(null)
  
  useEffect(() => {
    fetch(`/organizations/${organizationId}/usage`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setUsage)
  }, [organizationId])
  
  if (!usage) return null
  
  return (
    <div>
      <h3>Plano: {usage.plan_name}</h3>
      
      <div>
        Membros: {usage.members.current} / {usage.members.limit || '∞'}
        <ProgressBar percentage={usage.members.percentage} />
      </div>
      
      <div>
        Unidades: {usage.units.current} / {usage.units.limit || '∞'}
        <ProgressBar percentage={usage.units.percentage} />
      </div>
      
      {usage.members.percentage >= 80 && (
        <Alert>
          Você está próximo do limite. <a href="/plans">Fazer upgrade</a>
        </Alert>
      )}
    </div>
  )
}
```

---

## 🔄 Fluxo de Gerenciamento

### Abrir Customer Portal

```typescript
async function openBillingPortal() {
  const email = user.email
  const token = localStorage.getItem('token')
  
  const response = await fetch('/stripe/customer-portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      customerEmail: email,
      returnUrl: window.location.href,
    }),
  })
  
  const { url } = await response.json()
  window.location.href = url
}
```

No Customer Portal, o cliente pode:
- ✅ Atualizar método de pagamento
- ✅ Mudar de plano
- ✅ Cancelar assinatura
- ✅ Ver histórico de faturas
- ✅ Baixar recibos

---

## ✅ Resumo das Rotas

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/stripe/products` | ❌ | Lista planos disponíveis |
| GET | `/stripe/prices` | ❌ | Lista preços do Stripe |
| POST | `/stripe/checkout` | ✅ | Cria sessão de checkout |
| GET | `/stripe/checkout/:id` | ✅ | Detalhes da sessão |
| GET | `/stripe/subscriptions` | ✅ | Lista assinaturas |
| POST | `/stripe/subscriptions/:id/cancel` | ✅ | Cancela assinatura |
| POST | `/stripe/customer-portal` | ✅ | Abre portal do cliente |
| GET | `/organizations/:id/usage` | ✅ | Uso atual do plano |
| GET | `/organizations/:id/can-create/:type` | ✅ | Verifica se pode criar |
