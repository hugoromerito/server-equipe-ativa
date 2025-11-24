# Integração Stripe Simplificada - Frontend

## 🎯 Visão Geral

Sistema ultra-simplificado usando **Stripe Hosted Checkout** e **Customer Portal**. O Stripe cuida de 99% do trabalho.

## 📋 Endpoints Disponíveis

### 1. Listar Produtos/Planos
```typescript
GET /stripe/products
```
**Resposta:**
```json
[
  {
    "id": "prod_xxx",
    "name": "Plano Básico",
    "description": "Perfeito para começar",
    "active": true,
    "default_price": {
      "id": "price_xxx",
      "unit_amount": 2990,
      "currency": "brl",
      "recurring": {
        "interval": "month"
      }
    }
  }
]
```

### 2. Criar Checkout
```typescript
POST /stripe/checkout
Headers: Authorization: Bearer <token>
Body: {
  "priceId": "price_xxx",
  "customerEmail": "user@example.com",
  "successUrl": "https://seuapp.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://seuapp.com/cancel",
  "metadata": {
    "organizationId": "uuid-aqui"
  }
}
```
**Resposta:**
```json
{
  "sessionId": "cs_test_xxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxx"
}
```

### 3. Listar Assinaturas
```typescript
GET /stripe/subscriptions?customerEmail=user@example.com
Headers: Authorization: Bearer <token>
```

### 4. Portal do Cliente
```typescript
POST /stripe/customer-portal
Headers: Authorization: Bearer <token>
Body: {
  "customerEmail": "user@example.com",
  "returnUrl": "https://seuapp.com/settings"
}
```
**Resposta:**
```json
{
  "url": "https://billing.stripe.com/p/session/xxx"
}
```

## 💻 Implementação Frontend (React/Next.js)

### Página de Planos

```tsx
'use client'

import { useState, useEffect } from 'react'

interface StripeProduct {
  id: string
  name: string
  description: string | null
  default_price: {
    id: string
    unit_amount: number
    currency: string
    recurring: {
      interval: string
    }
  }
}

export default function PlansPage() {
  const [plans, setPlans] = useState<StripeProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    try {
      const res = await fetch('https://api.equipeativa.com/stripe/products')
      const data = await res.json()
      setPlans(data)
    } catch (error) {
      console.error('Erro ao carregar planos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubscribe(priceId: string) {
    try {
      const token = localStorage.getItem('token')
      const userEmail = localStorage.getItem('userEmail') // ou de onde você pega

      const res = await fetch('https://api.equipeativa.com/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId,
          customerEmail: userEmail,
          successUrl: `${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/plans`,
          metadata: {
            organizationId: 'seu-org-id-aqui',
          },
        }),
      })

      const { url } = await res.json()
      
      // Redireciona para o Stripe Checkout
      window.location.href = url
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao criar checkout')
    }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Escolha seu Plano</h1>
      
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div key={plan.id} className="border rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
            <p className="text-gray-600 mb-4">{plan.description}</p>
            
            <div className="mb-6">
              <span className="text-4xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: plan.default_price.currency,
                }).format(plan.default_price.unit_amount / 100)}
              </span>
              <span className="text-gray-600">
                /{plan.default_price.recurring.interval === 'month' ? 'mês' : 'ano'}
              </span>
            </div>
            
            <button
              onClick={() => handleSubscribe(plan.default_price.id)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Assinar Agora
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Página de Sucesso

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    if (sessionId) {
      loadSession()
    }
  }, [sessionId])

  async function loadSession() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`https://api.equipeativa.com/stripe/checkout/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await res.json()
      setSession(data)
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <div className="mb-6">
        <svg className="w-20 h-20 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h1 className="text-3xl font-bold mb-4">Pagamento Confirmado!</h1>
      <p className="text-gray-600 mb-8">
        Sua assinatura foi ativada com sucesso.
      </p>
      
      <div className="space-y-4">
        <a 
          href="/dashboard"
          className="block w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        >
          Ir para o Dashboard
        </a>
        
        <button
          onClick={openCustomerPortal}
          className="block w-full py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400"
        >
          Gerenciar Assinatura
        </button>
      </div>
    </div>
  )
}

async function openCustomerPortal() {
  try {
    const token = localStorage.getItem('token')
    const userEmail = localStorage.getItem('userEmail')

    const res = await fetch('https://api.equipeativa.com/stripe/customer-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        customerEmail: userEmail,
        returnUrl: window.location.origin + '/settings',
      }),
    })

    const { url } = await res.json()
    window.location.href = url
  } catch (error) {
    console.error('Erro:', error)
  }
}
```

### Componente de Gerenciamento

```tsx
'use client'

import { useState, useEffect } from 'react'

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscriptions()
  }, [])

  async function loadSubscriptions() {
    try {
      const token = localStorage.getItem('token')
      const userEmail = localStorage.getItem('userEmail')

      const res = await fetch(
        `https://api.equipeativa.com/stripe/subscriptions?customerEmail=${userEmail}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      const data = await res.json()
      setSubscriptions(data.subscriptions || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  async function openCustomerPortal() {
    try {
      const token = localStorage.getItem('token')
      const userEmail = localStorage.getItem('userEmail')

      const res = await fetch('https://api.equipeativa.com/stripe/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerEmail: userEmail,
          returnUrl: window.location.href,
        }),
      })

      const { url } = await res.json()
      window.location.href = url
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  if (loading) return <div>Carregando...</div>

  if (subscriptions.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="mb-4">Você não tem assinaturas ativas</p>
        <a href="/plans" className="text-blue-600 hover:underline">
          Ver Planos Disponíveis
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Minhas Assinaturas</h1>
      
      {subscriptions.map((sub) => (
        <div key={sub.id} className="border rounded-lg p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold">
                {sub.items.data[0]?.price?.product?.name || 'Assinatura'}
              </h3>
              <p className="text-gray-600">
                Status: <span className={`font-semibold ${sub.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {sub.status}
                </span>
              </p>
            </div>
            
            <span className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: sub.items.data[0]?.price?.currency || 'BRL',
              }).format((sub.items.data[0]?.price?.unit_amount || 0) / 100)}
              /mês
            </span>
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            <p>Próxima cobrança: {new Date(sub.current_period_end * 1000).toLocaleDateString('pt-BR')}</p>
          </div>
          
          <button
            onClick={openCustomerPortal}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Gerenciar no Stripe
          </button>
        </div>
      ))}
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-gray-700">
          💡 <strong>Dica:</strong> Use o Portal do Cliente do Stripe para:
          - Atualizar método de pagamento
          - Mudar de plano
          - Cancelar assinatura
          - Ver faturas
        </p>
      </div>
    </div>
  )
}
```

## 🔄 Fluxo Completo

1. **Usuário escolhe plano** → Frontend chama `POST /stripe/checkout`
2. **Redireciona para Stripe** → Stripe cuida de tudo (formulário, validação, pagamento)
3. **Stripe processa pagamento** → Redireciona de volta com `session_id`
4. **Página de sucesso** → Mostra confirmação
5. **Webhook notifica backend** → Você pode salvar no banco, enviar email, etc
6. **Gerenciar assinatura** → Customer Portal do Stripe (mudança de plano, cartão, cancelamento)

## ✅ Vantagens

- **Zero complexidade** de formulários de pagamento
- **PCI compliance** automático (Stripe cuida)
- **Tudo hospedado** no Stripe (segurança máxima)
- **Customer Portal** pronto (gerenciamento completo)
- **Webhooks** para sincronizar com seu banco
- **Multi-moeda** e **multi-idioma** automático
- **3D Secure** e validações automáticas

## 🔐 Segurança

- Chaves secretas nunca no frontend
- Validação de webhook com assinatura
- Customer Portal requer autenticação do Stripe
- Checkout Session expira automaticamente

## 🚀 Deploy

Lembre-se de configurar no Stripe Dashboard:
1. **Webhooks**: `https://api.equipeativa.com/stripe/webhook`
2. **Customer Portal**: Ativar em Settings → Billing
3. **Test Mode**: Testar primeiro antes de produção
