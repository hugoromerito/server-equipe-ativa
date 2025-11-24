# Integração de Checkout Stripe - Frontend

## Visão Geral

Este guia detalha como implementar a aquisição de planos/pacotes do Stripe no frontend, incluindo listagem de produtos, criação de checkout e gerenciamento de assinaturas.

## Fluxo de Compra

```
1. Usuário visualiza planos disponíveis
   ↓
2. Seleciona um plano
   ↓
3. Clica em "Assinar" ou "Comprar"
   ↓
4. Frontend cria sessão de checkout no backend
   ↓
5. Redireciona para Stripe Checkout
   ↓
6. Usuário completa pagamento
   ↓
7. Stripe redireciona de volta (success/cancel)
   ↓
8. Backend processa webhook do Stripe
   ↓
9. Assinatura ativada no sistema
```

## Endpoints Disponíveis

### 1. Listar Planos (GET /plans)

**Endpoint:** `GET https://api.equipeativa.com/plans`

**Autenticação:** Não requerida

**Resposta:**
```json
{
  "products": [
    {
      "id": "prod_xxx",
      "name": "Plano Básico",
      "description": "Ideal para pequenas equipes",
      "active": true,
      "metadata": {
        "features": "5 usuários, 10GB storage",
        "popular": "false"
      },
      "default_price": {
        "id": "price_xxx",
        "unit_amount": 2990,
        "currency": "brl",
        "recurring": {
          "interval": "month",
          "interval_count": 1
        }
      }
    }
  ]
}
```

### 2. Criar Checkout (POST /checkout)

**Endpoint:** `POST https://api.equipeativa.com/checkout`

**Autenticação:** Bearer Token (JWT)

**Body:**
```json
{
  "priceId": "price_xxx",
  "successUrl": "https://seuapp.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://seuapp.com/cancel"
}
```

**Resposta:**
```json
{
  "sessionId": "cs_test_xxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxx"
}
```

### 3. Listar Assinaturas (GET /subscriptions)

**Endpoint:** `GET https://api.equipeativa.com/subscriptions`

**Autenticação:** Bearer Token (JWT)

**Resposta:**
```json
{
  "subscriptions": [
    {
      "id": "sub_xxx",
      "status": "active",
      "current_period_start": "2025-01-01T00:00:00Z",
      "current_period_end": "2025-02-01T00:00:00Z",
      "plan": {
        "id": "plan_xxx",
        "name": "Plano Básico",
        "price": 29.90
      }
    }
  ]
}
```

## Implementação no Frontend

### React/Next.js Example

#### 1. Página de Planos

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface StripePlan {
  id: string
  name: string
  description: string | null
  active: boolean
  metadata: Record<string, string>
  default_price: {
    id: string
    unit_amount: number | null
    currency: string
    recurring: {
      interval: string
      interval_count: number
    } | null
  } | null
}

export default function PlansPage() {
  const [plans, setPlans] = useState<StripePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchPlans()
  }, [])

  async function fetchPlans() {
    try {
      const response = await fetch('https://api.equipeativa.com/plans')
      
      if (!response.ok) {
        throw new Error('Erro ao carregar planos')
      }

      const data = await response.json()
      setPlans(data.products)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubscribe(priceId: string) {
    try {
      const token = localStorage.getItem('authToken') // ou seu método de auth
      
      if (!token) {
        router.push('/login?redirect=/plans')
        return
      }

      const response = await fetch('https://api.equipeativa.com/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/plans`,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao criar checkout')
      }

      const { url } = await response.json()
      
      // Redirecionar para Stripe Checkout
      window.location.href = url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao processar pagamento')
    }
  }

  function formatPrice(amount: number | null, currency: string): string {
    if (!amount) return 'Preço sob consulta'
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600">
          <h2 className="text-xl font-bold mb-2">Erro ao carregar planos</h2>
          <p>{error}</p>
          <button 
            onClick={fetchPlans}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-12">
        Escolha seu Plano
      </h1>
      
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const price = plan.default_price
          const isPopular = plan.metadata?.popular === 'true'
          
          return (
            <div
              key={plan.id}
              className={`relative rounded-lg border-2 p-8 shadow-lg ${
                isPopular ? 'border-blue-600 shadow-blue-200' : 'border-gray-200'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Mais Popular
                </div>
              )}
              
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              
              {plan.description && (
                <p className="text-gray-600 mb-6">{plan.description}</p>
              )}
              
              <div className="mb-6">
                <span className="text-4xl font-bold">
                  {formatPrice(price?.unit_amount || 0, price?.currency || 'brl')}
                </span>
                {price?.recurring && (
                  <span className="text-gray-600">
                    /{price.recurring.interval === 'month' ? 'mês' : 'ano'}
                  </span>
                )}
              </div>
              
              {plan.metadata?.features && (
                <ul className="mb-8 space-y-2">
                  {plan.metadata.features.split(',').map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{feature.trim()}</span>
                    </li>
                  ))}
                </ul>
              )}
              
              <button
                onClick={() => handleSubscribe(price?.id || '')}
                disabled={!price?.id}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  isPopular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Assinar Agora
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

#### 2. Página de Sucesso

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [verifying, setVerifying] = useState(true)
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) {
      router.push('/plans')
      return
    }

    // Aguardar alguns segundos para o webhook processar
    const timer = setTimeout(() => {
      setVerifying(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [sessionId, router])

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Processando seu pagamento...</h2>
        <p className="text-gray-600">Aguarde enquanto confirmamos sua assinatura</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <svg className="w-20 h-20 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Pagamento Confirmado!</h1>
        
        <p className="text-gray-600 mb-8">
          Sua assinatura foi ativada com sucesso. Você já pode começar a usar todos os recursos do seu plano.
        </p>
        
        <div className="space-y-4">
          <Link 
            href="/dashboard"
            className="block w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Ir para o Dashboard
          </Link>
          
          <Link 
            href="/subscriptions"
            className="block w-full py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors"
          >
            Ver Minha Assinatura
          </Link>
        </div>
      </div>
    </div>
  )
}
```

#### 3. Gerenciamento de Assinaturas

```tsx
'use client'

import { useState, useEffect } from 'react'

interface Subscription {
  id: string
  status: string
  current_period_start: string
  current_period_end: string
  plan: {
    id: string
    name: string
    price: number
  }
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  async function fetchSubscriptions() {
    try {
      const token = localStorage.getItem('authToken')
      
      const response = await fetch('https://api.equipeativa.com/subscriptions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Erro ao carregar assinaturas')

      const data = await response.json()
      setSubscriptions(data.subscriptions)
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelSubscription(subscriptionId: string) {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura?')) {
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      
      const response = await fetch(`https://api.equipeativa.com/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Erro ao cancelar assinatura')

      alert('Assinatura cancelada com sucesso')
      fetchSubscriptions()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao cancelar')
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  function getStatusBadge(status: string) {
    const colors = {
      active: 'bg-green-100 text-green-800',
      canceled: 'bg-red-100 text-red-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      trialing: 'bg-blue-100 text-blue-800',
    }

    const labels = {
      active: 'Ativo',
      canceled: 'Cancelado',
      past_due: 'Pagamento Pendente',
      trialing: 'Período de Teste',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  if (loading) {
    return <div className="flex justify-center p-12">Carregando...</div>
  }

  if (subscriptions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Você não tem assinaturas ativas</h2>
        <p className="text-gray-600 mb-8">Escolha um plano para começar</p>
        <a href="/plans" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
          Ver Planos
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Minhas Assinaturas</h1>
      
      <div className="space-y-6">
        {subscriptions.map((subscription) => (
          <div key={subscription.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold mb-2">{subscription.plan.name}</h3>
                <p className="text-gray-600">
                  R$ {subscription.plan.price.toFixed(2)} / mês
                </p>
              </div>
              {getStatusBadge(subscription.status)}
            </div>
            
            <div className="border-t pt-4 mt-4">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Início do período</p>
                  <p className="font-semibold">{formatDate(subscription.current_period_start)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Próxima cobrança</p>
                  <p className="font-semibold">{formatDate(subscription.current_period_end)}</p>
                </div>
              </div>
              
              {subscription.status === 'active' && (
                <button
                  onClick={() => handleCancelSubscription(subscription.id)}
                  className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors"
                >
                  Cancelar Assinatura
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Vanilla JavaScript Example

```javascript
// Listar planos
async function loadPlans() {
  try {
    const response = await fetch('https://api.equipeativa.com/plans')
    const data = await response.json()
    
    const plansContainer = document.getElementById('plans-container')
    
    data.products.forEach(plan => {
      const price = plan.default_price
      const amount = price?.unit_amount || 0
      const formattedPrice = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: price?.currency || 'BRL',
      }).format(amount / 100)
      
      const planCard = document.createElement('div')
      planCard.className = 'plan-card'
      planCard.innerHTML = `
        <h3>${plan.name}</h3>
        <p>${plan.description || ''}</p>
        <div class="price">${formattedPrice}/mês</div>
        <button onclick="subscribeToPlan('${price?.id}')">Assinar</button>
      `
      
      plansContainer.appendChild(planCard)
    })
  } catch (error) {
    console.error('Erro ao carregar planos:', error)
  }
}

// Criar checkout
async function subscribeToPlan(priceId) {
  const token = localStorage.getItem('authToken')
  
  if (!token) {
    window.location.href = '/login'
    return
  }
  
  try {
    const response = await fetch('https://api.equipeativa.com/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        priceId,
        successUrl: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/plans.html`,
      }),
    })
    
    const data = await response.json()
    window.location.href = data.url
  } catch (error) {
    alert('Erro ao processar pagamento')
  }
}

// Inicializar
document.addEventListener('DOMContentLoaded', loadPlans)
```

## Webhooks do Stripe

O backend já está configurado para receber webhooks do Stripe. Os principais eventos tratados são:

- `checkout.session.completed` - Quando o pagamento é confirmado
- `customer.subscription.created` - Quando uma assinatura é criada
- `customer.subscription.updated` - Quando uma assinatura é atualizada
- `customer.subscription.deleted` - Quando uma assinatura é cancelada
- `invoice.payment_succeeded` - Quando um pagamento recorrente é bem-sucedido
- `invoice.payment_failed` - Quando um pagamento falha

## Boas Práticas

### 1. Tratamento de Erros

```typescript
async function handleCheckout(priceId: string) {
  try {
    const response = await fetch('/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ priceId, successUrl, cancelUrl }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao criar checkout')
    }

    const { url } = await response.json()
    window.location.href = url
  } catch (error) {
    // Mostrar erro para o usuário
    console.error('Erro:', error)
    alert(error instanceof Error ? error.message : 'Erro desconhecido')
  }
}
```

### 2. Loading States

```typescript
const [isCreatingCheckout, setIsCreatingCheckout] = useState(false)

async function handleSubscribe(priceId: string) {
  setIsCreatingCheckout(true)
  
  try {
    // ... lógica de checkout
  } finally {
    setIsCreatingCheckout(false)
  }
}
```

### 3. Verificar Autenticação

```typescript
function requireAuth() {
  const token = localStorage.getItem('authToken')
  
  if (!token) {
    const currentPath = window.location.pathname
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
    return false
  }
  
  return true
}
```

### 4. URLs de Retorno Dinâmicas

```typescript
const baseUrl = typeof window !== 'undefined' 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_APP_URL

const successUrl = `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`
const cancelUrl = `${baseUrl}/plans`
```

## Testes

### Dados de Teste do Stripe

Use esses dados para testar pagamentos em ambiente de desenvolvimento:

**Cartões de Crédito:**
- Sucesso: `4242 4242 4242 4242`
- Requer autenticação: `4000 0027 6000 3184`
- Recusado: `4000 0000 0000 0002`

**Data de Validade:** Qualquer data futura
**CVV:** Qualquer 3 dígitos
**CEP:** Qualquer 5 dígitos

## Segurança

1. **Nunca exponha chaves secretas** do Stripe no frontend
2. **Sempre valide** o token de autenticação no backend antes de criar checkouts
3. **Use HTTPS** em produção
4. **Valide webhooks** usando a assinatura do Stripe
5. **Não confie** apenas no frontend - sempre revalide no backend

## Troubleshooting

### Checkout não abre
- Verifique se o token JWT está válido
- Confirme que o `priceId` existe no Stripe
- Verifique console do navegador para erros

### Assinatura não aparece após pagamento
- Aguarde alguns segundos (webhooks podem demorar)
- Verifique logs do webhook no dashboard do Stripe
- Confirme que o endpoint de webhook está configurado corretamente

### CORS errors
- Verifique se o domínio está configurado no backend
- Em desenvolvimento, certifique-se de usar `http://localhost:3000`

## Próximos Passos

1. Implementar upgrade/downgrade de planos
2. Adicionar cupons de desconto
3. Implementar período de trial
4. Adicionar relatórios de faturamento
5. Implementar reembolsos

## Links Úteis

- [Documentação Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Webhooks Stripe](https://stripe.com/docs/webhooks)
