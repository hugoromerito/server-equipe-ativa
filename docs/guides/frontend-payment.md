# Guia de Integração de Pagamentos no Frontend

Este guia explica como integrar o sistema de pagamentos no seu frontend React/Next.js com Stripe Elements integrado.

## 🎯 Opções de Integração

O sistema suporta **3 formas** de pagamento integrado:

### 1. **Stripe Elements** (Recomendado - Pagamento Customizado)
- Pagamento totalmente integrado no seu site
- Controle total da UI/UX
- Requer mais código no frontend

### 2. **Stripe Checkout** (Mais Simples - Página Hospedada)
- Redireciona para página de pagamento do Stripe
- Menos código, mais rápido
- UI/UX padronizada do Stripe

### 3. **Billing Portal** (Gerenciamento de Assinatura)
- Portal gerenciado pelo Stripe
- Cliente pode atualizar cartão, cancelar, ver faturas

---

## 📦 Instalação no Frontend

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

---

## 🔧 Configuração Inicial

### 1. Criar Wrapper do Stripe

```typescript
// lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js'

let stripePromise: Promise<any> | null = null

export const getStripe = () => {
  if (!stripePromise) {
    // Busca a chave pública do backend
    fetch('/api/stripe/config')
      .then(res => res.json())
      .then(data => {
        stripePromise = loadStripe(data.publishableKey)
      })
  }
  return stripePromise
}
```

---

## 💳 Opção 1: Stripe Elements (Pagamento Integrado)

### Fluxo:
1. Frontend cria SetupIntent no backend
2. Frontend coleta dados do cartão com Stripe Elements
3. Frontend confirma pagamento
4. Backend salva método de pagamento
5. Frontend cria assinatura

### Passo 1: Componente de Adicionar Cartão

```tsx
// components/AddPaymentMethod.tsx
'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe'

function PaymentForm({ organizationId, onSuccess }: { 
  organizationId: string
  onSuccess: () => void 
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    try {
      // Confirma o SetupIntent
      const { error: submitError, setupIntent } = await elements.submit()
      
      if (submitError) {
        setError(submitError.message || 'Erro ao processar pagamento')
        setLoading(false)
        return
      }

      if (setupIntent) {
        // Salva o método de pagamento no backend
        await fetch('/api/stripe/confirm-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            setup_intent_id: setupIntent.id,
            payment_method_id: setupIntent.payment_method,
          }),
        })

        onSuccess()
      }
    } catch (err) {
      setError('Erro ao salvar cartão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg"
      >
        {loading ? 'Processando...' : 'Adicionar Cartão'}
      </button>
    </form>
  )
}

export default function AddPaymentMethod({ 
  organizationId, 
  onSuccess 
}: { 
  organizationId: string
  onSuccess: () => void 
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // Busca o SetupIntent ao montar
  useEffect(() => {
    fetch('/api/stripe/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }),
    })
      .then(res => res.json())
      .then(data => setClientSecret(data.client_secret))
  }, [organizationId])

  if (!clientSecret) {
    return <div>Carregando...</div>
  }

  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: { theme: 'stripe' },
        locale: 'pt-BR',
      }}
    >
      <PaymentForm organizationId={organizationId} onSuccess={onSuccess} />
    </Elements>
  )
}
```

### Passo 2: Componente de Seleção de Plano

```tsx
// components/PlanSelection.tsx
'use client'

import { useState, useEffect } from 'react'

interface Plan {
  id: string
  name: string
  slug: string
  description: string
  price: string
  interval: 'monthly' | 'quarterly' | 'yearly'
  features: string[]
  trial_days: number
}

export default function PlanSelection({ 
  organizationId,
  onSubscribed 
}: {
  organizationId: string
  onSubscribed: () => void
}) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Busca planos disponíveis
    fetch('/api/plans')
      .then(res => res.json())
      .then(data => setPlans(data.plans))
  }, [])

  const handleSubscribe = async (planId: string) => {
    setLoading(true)

    try {
      const response = await fetch('/api/stripe/create-subscription-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          plan_id: planId,
        }),
      })

      const data = await response.json()

      // Se precisa de pagamento, confirma
      if (data.client_secret) {
        const stripe = await getStripe()
        const { error } = await stripe.confirmPayment({
          clientSecret: data.client_secret,
          confirmParams: {
            return_url: `${window.location.origin}/subscription/success`,
          },
        })

        if (error) {
          alert('Erro no pagamento: ' + error.message)
        }
      } else {
        // Assinatura criada (trial ou free)
        onSubscribed()
      }
    } catch (err) {
      alert('Erro ao criar assinatura')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {plans.map(plan => (
        <div key={plan.id} className="border rounded-lg p-6">
          <h3 className="text-2xl font-bold">{plan.name}</h3>
          <p className="text-gray-600 mt-2">{plan.description}</p>
          
          <div className="mt-4">
            <span className="text-3xl font-bold">
              R$ {parseFloat(plan.price).toFixed(2)}
            </span>
            <span className="text-gray-500">/{plan.interval === 'monthly' ? 'mês' : 'ano'}</span>
          </div>

          {plan.trial_days > 0 && (
            <p className="text-sm text-green-600 mt-2">
              {plan.trial_days} dias de teste grátis
            </p>
          )}

          <ul className="mt-6 space-y-2">
            {plan.features.map((feature, idx) => (
              <li key={idx} className="flex items-center text-sm">
                <span className="mr-2">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleSubscribe(plan.id)}
            disabled={loading}
            className="w-full mt-6 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            {loading ? 'Processando...' : 'Assinar'}
          </button>
        </div>
      ))}
    </div>
  )
}
```

---

## 🚀 Opção 2: Stripe Checkout (Mais Simples)

### Fluxo:
1. Frontend chama backend para criar Checkout Session
2. Backend retorna URL do Stripe
3. Frontend redireciona usuário
4. Stripe processa pagamento
5. Redireciona de volta com sucesso/erro

### Implementação:

```tsx
// components/CheckoutButton.tsx
'use client'

export default function CheckoutButton({ 
  planId, 
  organizationId 
}: { 
  planId: string
  organizationId: string 
}) {
  const handleCheckout = async () => {
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          plan_id: planId,
          success_url: `${window.location.origin}/subscription/success`,
          cancel_url: `${window.location.origin}/subscription/cancel`,
        }),
      })

      const data = await response.json()
      
      // Redireciona para Stripe Checkout
      window.location.href = data.checkout_url
    } catch (err) {
      alert('Erro ao iniciar checkout')
    }
  }

  return (
    <button
      onClick={handleCheckout}
      className="bg-blue-600 text-white px-6 py-2 rounded-lg"
    >
      Assinar Agora
    </button>
  )
}
```

---

## 🔄 Opção 3: Billing Portal (Gerenciamento)

### Para o cliente gerenciar sua assinatura:

```tsx
// components/ManageSubscription.tsx
'use client'

export default function ManageSubscription({ 
  organizationId 
}: { 
  organizationId: string 
}) {
  const handleManage = async () => {
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          return_url: window.location.href,
        }),
      })

      const data = await response.json()
      
      // Redireciona para Billing Portal
      window.location.href = data.portal_url
    } catch (err) {
      alert('Erro ao abrir portal de gerenciamento')
    }
  }

  return (
    <button
      onClick={handleManage}
      className="bg-gray-600 text-white px-6 py-2 rounded-lg"
    >
      Gerenciar Assinatura
    </button>
  )
}
```

---

## 📊 Verificar Status da Assinatura

```tsx
// components/SubscriptionStatus.tsx
'use client'

import { useEffect, useState } from 'react'

export default function SubscriptionStatus({ 
  organizationId 
}: { 
  organizationId: string 
}) {
  const [subscription, setSubscription] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/organizations/${organizationId}/subscription`)
      .then(res => res.json())
      .then(data => setSubscription(data.subscription))
  }, [organizationId])

  if (!subscription) {
    return <div>Carregando...</div>
  }

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-xl font-bold">Assinatura Atual</h3>
      <p className="mt-2">Plano: {subscription.plan.name}</p>
      <p>Status: {subscription.status}</p>
      <p>Renovação: {new Date(subscription.current_period_end).toLocaleDateString()}</p>
    </div>
  )
}
```

---

## 🎨 Exemplo Completo de Página

```tsx
// app/billing/page.tsx
'use client'

import { useState } from 'react'
import PlanSelection from '@/components/PlanSelection'
import AddPaymentMethod from '@/components/AddPaymentMethod'
import ManageSubscription from '@/components/ManageSubscription'

export default function BillingPage() {
  const [step, setStep] = useState<'plan' | 'payment' | 'done'>('plan')
  const organizationId = 'seu-org-id' // Obtém do contexto/auth

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Gerenciar Assinatura</h1>

      {step === 'plan' && (
        <>
          <h2 className="text-xl mb-4">Selecione um Plano</h2>
          <PlanSelection
            organizationId={organizationId}
            onSubscribed={() => setStep('done')}
          />
        </>
      )}

      {step === 'payment' && (
        <>
          <h2 className="text-xl mb-4">Adicionar Método de Pagamento</h2>
          <AddPaymentMethod
            organizationId={organizationId}
            onSuccess={() => setStep('plan')}
          />
        </>
      )}

      {step === 'done' && (
        <>
          <h2 className="text-xl mb-4">Assinatura Ativa!</h2>
          <ManageSubscription organizationId={organizationId} />
        </>
      )}
    </div>
  )
}
```

---

## 🔐 APIs Disponíveis para o Frontend

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/stripe/config` | GET | Obtém chave pública |
| `/stripe/setup-intent` | POST | Cria SetupIntent para salvar cartão |
| `/stripe/create-checkout-session` | POST | Cria sessão de checkout hospedado |
| `/stripe/create-subscription-payment` | POST | Cria assinatura com pagamento |
| `/stripe/confirm-setup` | POST | Confirma SetupIntent após pagamento |
| `/stripe/create-portal-session` | POST | Cria portal de gerenciamento |
| `/plans` | GET | Lista planos disponíveis |
| `/organizations/:id/subscription` | GET | Obtém assinatura ativa |

---

## ✅ Recomendações

### Use **Stripe Elements** se:
- Quer controle total da experiência
- Precisa de UI customizada
- Tem tempo para implementar mais código

### Use **Stripe Checkout** se:
- Quer implementação rápida
- UI/UX padrão do Stripe é suficiente
- Menos código para manter

### Use **Billing Portal** para:
- Gerenciamento de assinatura
- Atualização de cartão
- Cancelamento
- Visualização de faturas

---

## 🧪 Testando

Use cartões de teste do Stripe:
- **Sucesso**: `4242 4242 4242 4242`
- **Falha**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

---

## 📚 Recursos

- [Stripe Elements Docs](https://stripe.com/docs/stripe-js)
- [React Stripe.js](https://stripe.com/docs/stripe-js/react)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Billing Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
