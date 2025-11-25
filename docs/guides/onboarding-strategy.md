# 🎯 Estratégia de Onboarding e Planos - Sistema Atualizado

## 📋 Visão Geral

O sistema funciona com **escolha de plano sob demanda** via Stripe Checkout:

1. ✅ Usuário se registra e cria organização
2. ❌ **SEM subscription** = acesso bloqueado a funcionalidades pagas
3. 🎯 Ao tentar usar funcionalidade, recebe mensagem: "Sem plano ativo"
4. 💳 Usuário escolhe plano via **Stripe Checkout**
5. ✅ Após pagamento confirmado, subscription é criada e acesso liberado

---

## 🚀 Fluxo Completo do Usuário

### 1️⃣ Registro e Criação de Organização

```typescript
// Usuário se registra
POST /auth/register
{
  "name": "João Silva",
  "email": "joao@clinica.com",
  "password": "senha123"
}

// Cria organização
POST /organizations
{
  "name": "Clínica Central"
}

// ✅ Retorna:
{
  "organization": {
    "id": "org-123",
    "name": "Clínica Central",
    "slug": "clinica-central"
  }
}

// ⚠️ Nenhuma subscription foi criada!
```

**Estado após criação:**
- ✅ Usuário registrado e autenticado
- ✅ Organização criada
- ✅ Usuário é ADMIN da organização
- ❌ **Sem subscription ativa** (organization.stripe_customer_id = null)

---

### 2️⃣ Tentativa de Usar Funcionalidade Paga

```typescript
// Usuário tenta criar unidade
POST /organizations/clinica-central/units
{
  "name": "Unidade Centro",
  "location": "Av. Principal, 100"
}

// ❌ Middleware checkResourceLimit bloqueia:
{
  "message": "Organização não possui assinatura ativa",
  "code": "NO_ACTIVE_SUBSCRIPTION",
  "action": "SELECT_PLAN"
}
```

**Frontend deve:**
1. Interceptar erro 403 com código `NO_ACTIVE_SUBSCRIPTION`
2. Redirecionar para página de seleção de planos
3. Mostrar modal explicativo

---

### 3️⃣ Escolha de Plano e Checkout

```typescript
// Frontend lista planos disponíveis
GET /stripe/products

// Resposta:
[
  {
    "id": "prod_free",
    "name": "Gratuito",
    "description": "Plano gratuito permanente",
    "default_price": {
      "id": "price_free",
      "unit_amount": 0, // R$ 0,00
      "currency": "brl",
      "recurring": { interval: "month" }
    },
    "metadata": {
      "max_members": "5",
      "max_units": "2",
      "max_applicants": "50",
      "max_storage_gb": "1"
    }
  },
  {
    "id": "prod_basic",
    "name": "Básico",
    "description": "Para pequenas equipes",
    "default_price": {
      "id": "price_basic",
      "unit_amount": 9900, // R$ 99,00
      "currency": "brl",
      "recurring": { 
        "interval": "month",
        "trial_period_days": 14 // ← Trial configurado no Stripe
      }
    },
    "metadata": {
      "max_members": "20",
      "max_units": "5",
      "max_applicants": "200",
      "max_storage_gb": "10"
    }
  },
  // ... outros planos
]
```

**Usuário escolhe um plano, frontend cria checkout:**

```typescript
// Cria sessão de checkout
POST /stripe/checkout
{
  "priceId": "price_free", // ou price_basic, price_pro, etc
  "successUrl": "https://app.clinica.com/dashboard?success=true",
  "cancelUrl": "https://app.clinica.com/plans",
  "customerEmail": "joao@clinica.com",
  "metadata": {
    "organization_id": "org-123",
    "plan_id": "plan-free-id" // ID do plano no seu banco
  }
}

// Resposta:
{
  "sessionId": "cs_test_123",
  "url": "https://checkout.stripe.com/c/pay/cs_test_123"
}
```

**Frontend redireciona para `url` do Stripe:**
- Stripe exibe página de checkout hospedada
- Usuário preenche dados (se necessário)
- Para plano Free: confirmação imediata (sem cartão)
- Para planos pagos: pode adicionar cartão e ativar trial

---

### 4️⃣ Webhook - Criação da Subscription

Quando checkout é completado, Stripe envia webhook:

```typescript
// Evento: checkout.session.completed
{
  "id": "evt_123",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_123",
      "mode": "subscription",
      "subscription": "sub_123",
      "customer": "cus_123",
      "customer_email": "joao@clinica.com",
      "metadata": {
        "organization_id": "org-123",
        "plan_id": "plan-free-id"
      }
    }
  }
}
```

**Sistema processa webhook automaticamente:**

```typescript
// src/http/routes/stripe-webhook.ts
async function handleCheckoutSessionCompleted(session) {
  const { organization_id, plan_id } = session.metadata
  const stripeSubscriptionId = session.subscription
  
  // Busca subscription do Stripe
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  
  // Cria subscription no banco de dados
  await db.insert(subscriptions).values({
    organization_id,
    plan_id,
    stripe_subscription_id: stripeSubscriptionId,
    status: mapStripeStatus(stripeSub.status), // 'active' ou 'trialing'
    current_period_start: new Date(stripeSub.current_period_start * 1000),
    current_period_end: new Date(stripeSub.current_period_end * 1000),
    trial_end: stripeSub.trial_end 
      ? new Date(stripeSub.trial_end * 1000) 
      : null
  })
  
  // Atualiza organização com customer ID
  await db.update(organizations)
    .set({ stripe_customer_id: session.customer })
    .where(eq(organizations.id, organization_id))
}
```

**Resultado:**
- ✅ Subscription criada no banco
- ✅ Organização vinculada ao customer Stripe
- ✅ Status: `active` (plano Free) ou `trialing` (planos pagos)

---

### 5️⃣ Acesso Liberado

```typescript
// Usuário tenta criar unidade novamente
POST /organizations/clinica-central/units
{
  "name": "Unidade Centro",
  "location": "Av. Principal, 100"
}

// Middleware verifica:
const subscription = await billingService.getActiveSubscription('org-123')

// ✅ Subscription encontrada:
{
  "status": "active", // ou "trialing"
  "plan": {
    "max_members": 5,
    "max_units": 2,
    "max_demands": 50,
    "max_storage_gb": 1
  }
}

// ✅ Verifica limites
const limitCheck = await usageTrackingService.canCreateResource('org-123', 'unit')
// { allowed: true, current: 0, limit: 2 }

// ✅ Unidade criada com sucesso!
{
  "unit": {
    "id": "unit-123",
    "name": "Unidade Centro",
    "slug": "unidade-centro"
  }
}
```

---

## 🎁 Planos Disponíveis

### 1. Plano Gratuito (Free)

**Configuração:**
```typescript
{
  name: 'Gratuito',
  slug: 'free',
  price: '0.00',
  trial_days: 0, // Não tem trial, é permanente
  max_members: 5,
  max_units: 2,
  max_demands: 50,
  max_storage_gb: 1
}
```

**No Stripe:**
- Preço: R$ 0,00/mês
- Sem trial
- Ativado via checkout (sem cartão)
- Subscription status: `active` (permanente)

**Características:**
- ✅ Acesso permanente gratuito
- ✅ Ideal para teste e pequenas clínicas
- ✅ Pode fazer upgrade a qualquer momento
- ✅ Sem necessidade de cartão de crédito

---

### 2. Plano Básico

**Configuração:**
```typescript
{
  name: 'Básico',
  slug: 'basic',
  price: '99.00',
  trial_days: 14, // Configurável no Stripe
  max_members: 20,
  max_units: 5,
  max_demands: 200,
  max_storage_gb: 10
}
```

**No Stripe:**
- Preço: R$ 99,00/mês
- Trial: 14 dias (opcional, configurado no Stripe)
- Requer cartão de crédito
- Durante trial: status = `trialing`
- Após trial: status = `active` (se pago) ou `past_due` (se falhou)

**Fluxo com Trial:**
```
Dia 0: Checkout → Trial começa (status: trialing)
Dia 1-14: Acesso completo ao plano (sem cobrança)
Dia 14: Trial termina → Stripe cobra R$ 99,00
  └─> Se OK: status = active
  └─> Se falha: status = past_due (acesso bloqueado)
```

---

### 3. Plano Profissional

**Configuração:**
```typescript
{
  name: 'Profissional',
  slug: 'professional',
  price: '299.00',
  trial_days: 14,
  max_members: 100,
  max_units: 20,
  max_demands: 1000,
  max_storage_gb: 50
}
```

---

### 4. Plano Empresarial

**Configuração:**
```typescript
{
  name: 'Empresarial',
  slug: 'enterprise',
  price: '999.00',
  trial_days: 30,
  max_members: null, // ilimitado
  max_units: null,
  max_demands: null,
  max_storage_gb: 500
}
```

---

## 💡 Cenários de Uso

### Cenário 1: Clínica Pequena (Plano Free)

**Fluxo:**
1. Usuário se registra e cria organização
2. Tenta criar unidade → bloqueado
3. Escolhe Plano Gratuito
4. Stripe checkout sem pagamento
5. Webhook cria subscription com status `active`
6. Acesso liberado com limites do Free

**Limitações:**
- Até 5 membros
- Até 2 unidades
- Até 50 atendimentos/mês
- 1 GB de storage

**Quando fazer upgrade:**
- Mais de 5 profissionais
- Mais de 2 filiais
- Mais de 50 atendimentos/mês

---

### Cenário 2: Clínica Média (Plano Básico com Trial)

**Fluxo:**
1. Usuário se registra e cria organização
2. Tenta criar recurso → bloqueado
3. Escolhe Plano Básico (R$ 99/mês)
4. Stripe checkout com trial de 14 dias
5. Adiciona cartão (não é cobrado ainda)
6. Webhook cria subscription com status `trialing`
7. **14 dias de acesso completo gratuito**
8. Após 14 dias: primeira cobrança de R$ 99

**Benefícios do trial:**
- Testa sistema completo sem custo
- Avalia se atende necessidades
- Pode cancelar antes da cobrança
- Acesso total aos recursos do plano

---

### Cenário 3: Upgrade de Plano

**Fluxo:**
1. Usuário está no Plano Free
2. Atingiu limite (ex: 5 membros)
3. Tenta adicionar 6º membro → bloqueado
4. Mensagem: "Limite atingido, faça upgrade"
5. Escolhe Plano Básico
6. Stripe processa upgrade via Customer Portal
7. Subscription atualizada automaticamente
8. Limites aumentados imediatamente

```typescript
// Frontend detecta limite atingido
if (error.code === 'RESOURCE_LIMIT_EXCEEDED') {
  showUpgradeModal({
    currentPlan: 'Gratuito',
    currentLimit: 5,
    suggestedPlan: 'Básico',
    newLimit: 20,
    price: 'R$ 99/mês'
  })
}
```

---

## 🔒 Controle de Acesso

### Status de Subscription e Acesso

| Status | Tem Acesso? | Descrição |
|--------|-------------|-----------|
| ❌ `null` | Não | Sem subscription (bloqueado) |
| ✅ `active` | Sim | Subscription ativa e paga |
| ✅ `trialing` | Sim | Em período de trial |
| ⚠️ `past_due` | Não | Pagamento atrasado |
| ❌ `canceled` | Não | Subscription cancelada |
| ❌ `unpaid` | Não | Sem pagamento |

### Middleware de Verificação

```typescript
// src/http/middlewares/billing.ts
export async function requireActiveSubscription(request, reply) {
  const { organizationId } = request.params
  
  // Busca subscription ativa
  const subscription = await billingService.getActiveSubscription(organizationId)
  
  if (!subscription) {
    return reply.status(403).send({
      message: 'Organização não possui plano ativo',
      code: 'NO_ACTIVE_SUBSCRIPTION',
      action: 'SELECT_PLAN' // Frontend redireciona para /plans
    })
  }
  
  // Verifica se não expirou
  if (subscription.current_period_end < new Date() && 
      subscription.status !== 'trialing') {
    return reply.status(403).send({
      message: 'Plano expirado',
      code: 'SUBSCRIPTION_EXPIRED',
      action: 'RENEW_PLAN'
    })
  }
  
  // ✅ Subscription válida (active ou trialing)
}
```

---

## 🎨 Implementação Frontend

### 1. Página de Planos

```typescript
// pages/plans.tsx
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export default function PlansPage() {
  const [plans, setPlans] = useState([])
  const organizationId = 'org-123' // Do contexto
  
  useEffect(() => {
    // Lista produtos do Stripe
    api.get('/stripe/products').then(res => setPlans(res.data))
  }, [])
  
  async function handleSelectPlan(priceId: string, planId: string) {
    // Cria checkout session
    const res = await api.post('/stripe/checkout', {
      priceId,
      successUrl: `${window.location.origin}/dashboard?success=true`,
      cancelUrl: `${window.location.origin}/plans`,
      customerEmail: user.email,
      metadata: {
        organization_id: organizationId,
        plan_id: planId
      }
    })
    
    // Redireciona para Stripe Checkout
    window.location.href = res.data.url
  }
  
  return (
    <div className="grid grid-cols-3 gap-6">
      {plans.map(plan => (
        <PlanCard
          key={plan.id}
          plan={plan}
          onSelect={handleSelectPlan}
        />
      ))}
    </div>
  )
}
```

---

### 2. Interceptor de Erros

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
      const { code } = response.data
      
      switch (code) {
        case 'NO_ACTIVE_SUBSCRIPTION':
          // Redireciona para seleção de planos
          window.location.href = '/plans?reason=no-subscription'
          break
          
        case 'SUBSCRIPTION_EXPIRED':
          // Modal de renovação
          showRenewalModal()
          break
          
        case 'RESOURCE_LIMIT_EXCEEDED':
          // Modal de upgrade
          showUpgradeModal(response.data)
          break
      }
    }
    
    return Promise.reject(error)
  }
)
```

---

### 3. Modal de Sem Plano

```typescript
// components/NoSubscriptionModal.tsx
'use client'

export default function NoSubscriptionModal({ isOpen, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            🎯
          </div>
          
          <h3 className="text-xl font-bold mb-2">
            Escolha um Plano
          </h3>
          
          <p className="text-gray-600">
            Para usar esta funcionalidade, você precisa escolher um plano.
            Temos opções desde o plano gratuito até planos para grandes clínicas.
          </p>
        </div>
        
        <div className="space-y-3">
          <a
            href="/plans"
            className="block w-full py-3 px-6 bg-blue-600 text-white text-center rounded-lg font-semibold"
          >
            Ver Planos Disponíveis
          </a>
          
          <button
            onClick={onClose}
            className="block w-full py-3 px-6 border-2 border-gray-300 text-gray-700 text-center rounded-lg"
          >
            Voltar
          </button>
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-500">
          💡 Experimente nosso plano gratuito para começar!
        </div>
      </div>
    </div>
  )
}
```

---

## 🔧 Configuração do Stripe

### 1. Criar Produtos no Stripe Dashboard

```bash
# Acesse: https://dashboard.stripe.com/products

# Produto 1: Gratuito
Nome: Gratuito
Descrição: Plano gratuito permanente
Preço: R$ 0,00/mês
Recurring: Mensal
Metadata:
  max_members: 5
  max_units: 2
  max_applicants: 50
  max_storage_gb: 1

# Produto 2: Básico
Nome: Básico
Descrição: Para pequenas equipes
Preço: R$ 99,00/mês
Recurring: Mensal
Trial: 14 dias (opcional)
Metadata:
  max_members: 20
  max_units: 5
  max_applicants: 200
  max_storage_gb: 10
```

---

### 2. Configurar Webhook

```bash
# Acesse: https://dashboard.stripe.com/webhooks

# Endpoint URL:
https://sua-api.com/webhooks/stripe

# Eventos para ouvir:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed

# Copie o Webhook Secret e adicione ao .env:
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## ✅ Vantagens desta Estratégia

### 1. **Simplicidade**
- ✅ Sem criação automática de subscription
- ✅ Usuário escolhe quando ativar
- ✅ Stripe gerencia tudo (checkout, cobrança, trial)

### 2. **Flexibilidade**
- ✅ Trial configurável no Stripe (sem deploy)
- ✅ Plano Free permanente
- ✅ Upgrade/downgrade fácil via Customer Portal

### 3. **Controle**
- ✅ Limites verificados em tempo real
- ✅ Bloqueio automático sem subscription
- ✅ Mensagens claras para o usuário

### 4. **Experiência do Usuário**
- ✅ Usuário entende exatamente o que está contratando
- ✅ Pode testar plano Free sem compromisso
- ✅ Trial oferecido para planos pagos (opcional)
- ✅ Sem surpresas de cobrança

---

## 📊 Comparação: Antes vs Agora

| Aspecto | ❌ Antes (Trial Automático) | ✅ Agora (Escolha Sob Demanda) |
|---------|----------------------------|--------------------------------|
| **Criação de org** | Cria subscription automática | Apenas cria organização |
| **Acesso inicial** | Liberado por 14 dias | Bloqueado até escolher plano |
| **Trial** | Sempre ativo | Apenas se usuário escolher plano pago |
| **Plano Free** | Não existia | Permanente, sem trial |
| **Escolha de plano** | Forçada após trial | Quando usuário quiser |
| **Cobrança** | Após trial (surpresa?) | Clara e escolhida pelo usuário |

---

## 🎯 Conclusão

**Novo fluxo implementado:**

1. ✅ Registro sem subscription
2. ✅ Bloqueio com mensagem clara
3. ✅ Escolha de plano via Stripe (incluindo Free)
4. ✅ Trial opcional em planos pagos
5. ✅ Webhook cria subscription automaticamente
6. ✅ Acesso liberado imediatamente

**Código pronto:**
- ✅ Rota de organização NÃO cria subscription
- ✅ Middleware bloqueia sem subscription
- ✅ Rota `/stripe/checkout` funcionando
- ✅ Webhook processa checkout corretamente
- ✅ Plano Free atualizado

**Próximos passos (frontend):**
- [ ] Página de seleção de planos
- [ ] Interceptor de erros 403
- [ ] Modal de "sem plano ativo"
- [ ] Integração com Stripe Checkout

---

**Última atualização:** 25 de novembro de 2025  
**Versão:** 2.0.0
