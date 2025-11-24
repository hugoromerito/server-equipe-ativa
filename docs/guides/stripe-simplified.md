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

## 🎨 Personalização da Página de Pagamento

### Opção 1: Branding Settings (Recomendado - Fácil)

Configure no Stripe Dashboard para aplicar sua identidade visual automaticamente:

**Settings → Branding**

```
✅ Logo da empresa (recomendado: 512x512px, PNG com transparência)
✅ Cor primária (brand color) - usar a cor do seu botão principal
✅ Cor de destaque (accent color)
✅ Ícone (favicon) - 32x32px
```

**Resultado:** Todas as páginas do Stripe (Checkout, Customer Portal, Invoices) usarão sua identidade visual.

### Opção 2: Personalização via API (Avançado)

Adicione mais configurações ao criar o checkout:

```typescript
// No backend (billing.ts)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: successUrl,
  cancel_url: cancelUrl,
  
  // 🎨 PERSONALIZAÇÕES AVANÇADAS
  locale: 'pt-BR', // Idioma
  
  // Informações customizadas do cliente
  customer_email: customerEmail,
  
  // Permitir códigos promocionais
  allow_promotion_codes: true,
  
  // Coletar endereço de cobrança
  billing_address_collection: 'required', // ou 'auto'
  
  // Coletar número de telefone
  phone_number_collection: {
    enabled: true,
  },
  
  // Campos customizados
  custom_fields: [
    {
      key: 'cnpj',
      label: { type: 'custom', custom: 'CNPJ da Empresa' },
      type: 'text',
      optional: false,
    },
    {
      key: 'company_name',
      label: { type: 'custom', custom: 'Razão Social' },
      type: 'text',
      optional: true,
    },
  ],
  
  // Texto customizado
  custom_text: {
    submit: {
      message: 'Obrigado por escolher Equipe Ativa!',
    },
    terms_of_service_acceptance: {
      message: 'Eu concordo com os [termos de serviço](https://equipeativa.com/termos)',
    },
  },
  
  // Aceitar termos de serviço
  consent_collection: {
    terms_of_service: 'required',
  },
  
  // 💳 MÉTODOS DE PAGAMENTO
  // Escolha quais formas aceitar:
  payment_method_types: [
    'card',      // Cartão de crédito/débito (padrão)
    'boleto',    // Boleto bancário (Brasil)
    // 'pix',    // PIX (em breve no Stripe)
    // 'link',   // Stripe Link (salvar dados)
    // 'us_bank_account', // Transferência (EUA)
  ],
  
  // Dados fiscais (para nota fiscal)
  invoice_creation: {
    enabled: true,
    invoice_data: {
      description: 'Assinatura Equipe Ativa',
      footer: 'Obrigado pela sua preferência!',
      metadata: {
        organization_id: metadata?.organizationId,
      },
    },
  },
})
```

### Opção 3: Custom Branding por Checkout

Para ter páginas diferentes para cada tipo de plano:

```typescript
// Checkout com branding especial para Enterprise
const session = await stripe.checkout.sessions.create({
  // ... outras configs
  
  // Imagem customizada apenas para este checkout
  custom_text: {
    shipping_address: {
      message: '🎯 Plano Enterprise - Suporte Premium Incluído',
    },
  },
  
  // Cupom automático
  discounts: [{
    coupon: 'ENTERPRISE2024', // código de desconto
  }],
})
```

### 📋 Configurações Disponíveis no Dashboard

#### 1. Settings → Branding
- Logo (aparece no topo da página)
- Ícone/Favicon
- Cor primária
- Cor de destaque
- Fonte (tipografia)

#### 2. Settings → Checkout Settings
- **Idiomas suportados**: Português, Inglês, Espanhol, etc.
- **Métodos de pagamento**: ⭐ CONFIGURE AQUI PRIMEIRO
  - ✅ **Cartão de crédito/débito** (habilitado por padrão)
  - ✅ **Boleto bancário** (Brasil) - Settings → Payment Methods → Enable Boleto
  - ⏳ **PIX** (em breve, Stripe ainda não suporta oficialmente)
  - ✅ **Apple Pay / Google Pay** (habilitado automaticamente para cartões)
  - ✅ **Link** (pagamento rápido do Stripe)
  - ❌ **PayPal** (não suportado nativamente - use integração separada)
  
  **Como habilitar Boleto:**
  1. Vá em Settings → Payment Methods
  2. Clique em "Add payment method"
  3. Selecione "Boleto" e clique em "Enable"
  4. Configure prazo de vencimento (padrão: 3 dias)

- **Coletar informações**:
  - Endereço de cobrança
  - Telefone
  - Nota fiscal

#### 3. Settings → Customer Portal
- Permitir cancelamento
- Permitir mudança de plano
- Permitir atualização de pagamento
- Permitir ver faturas

### 🎯 Exemplo Completo Personalizado

```typescript
// src/http/routes/billing.ts - método POST /stripe/checkout

const sessionConfig: any = {
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: successUrl,
  cancel_url: cancelUrl,
  
  // Idioma português
  locale: 'pt-BR',
  
  // Email pré-preenchido
  customer_email: customerEmail,
  
  // Permitir cupons
  allow_promotion_codes: true,
  
  // Coletar endereço completo (para nota fiscal)
  billing_address_collection: 'required',
  
  // Coletar telefone
  phone_number_collection: {
    enabled: true,
  },
  
  // Campos extras para pessoa jurídica
  custom_fields: [
    {
      key: 'cnpj',
      label: { type: 'custom', custom: 'CNPJ' },
      type: 'text',
      optional: false,
    },
    {
      key: 'razao_social',
      label: { type: 'custom', custom: 'Razão Social' },
      type: 'text',
    },
  ],
  
  // Mensagens personalizadas
  custom_text: {
    submit: {
      message: '🚀 Ativar minha assinatura Equipe Ativa',
    },
    terms_of_service_acceptance: {
      message: 'Concordo com os [Termos de Serviço](https://equipeativa.com/termos) e [Política de Privacidade](https://equipeativa.com/privacidade)',
    },
  },
  
  // Requerer aceite dos termos
  consent_collection: {
    terms_of_service: 'required',
  },
  
  // Aceitar cartão e boleto
  payment_method_types: ['card', 'boleto'],
  
  // Gerar nota fiscal automaticamente
  invoice_creation: {
    enabled: true,
    invoice_data: {
      description: `Assinatura ${metadata?.planName || 'Equipe Ativa'}`,
      footer: 'Dúvidas? contato@equipeativa.com',
      metadata: {
        organization_id: metadata?.organizationId,
        plan_name: metadata?.planName,
      },
    },
  },
  
  // Metadata para rastreamento
  metadata: {
    organization_id: metadata?.organizationId,
    source: 'website',
    campaign: metadata?.campaign,
  },
}
```

### 🖼️ Mockup da Página Personalizada

Com as configurações acima, o checkout ficará assim:

```
┌─────────────────────────────────────────┐
│  [Logo Equipe Ativa]                    │
├─────────────────────────────────────────┤
│                                         │
│  Assinatura - Plano Profissional       │
│  R$ 299,00 / mês                        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Email: user@example.com         │   │
│  │ Telefone: (11) 98765-4321      │   │
│  │                                 │   │
│  │ CNPJ: __.__.__/____-__         │   │
│  │ Razão Social: _____________     │   │
│  │                                 │   │
│  │ CEP: _____-___                  │   │
│  │ Endereço: __________________    │   │
│  │ Cidade: _________ UF: __       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Forma de Pagamento:                    │
│  ○ Cartão de Crédito                   │
│  ○ Boleto Bancário                     │
│                                         │
│  Código Promocional: [________] [✓]    │
│                                         │
│  ☑ Concordo com os Termos de Serviço   │
│                                         │
│  [🚀 Ativar minha assinatura]          │
│                                         │
│  🔒 Pagamento seguro por Stripe        │
└─────────────────────────────────────────┘
```

### ⚡ Dicas de UX

1. **Sempre pré-preencha o email** do usuário logado
2. **Use allow_promotion_codes: true** para permitir cupons
3. **Colete telefone** para recuperação de conta
4. **Para B2B**: Adicione campos de CNPJ e Razão Social
5. **Success URL**: Inclua `{CHECKOUT_SESSION_ID}` para rastreamento
6. **Cancel URL**: Redirecione para página de planos com mensagem

### 🔄 Atualizar o Código

Substitua a função no `billing.ts`:

```typescript
app.post('/stripe/checkout', {
  preHandler: [authPreHandler],
}, async (request, reply) => {
  try {
    const body = request.body as {
      priceId: string
      successUrl: string
      cancelUrl: string
      customerEmail?: string
      metadata?: Record<string, string>
    }

    const { priceId, successUrl, cancelUrl, customerEmail, metadata } = body
    
    if (!priceId || !successUrl || !cancelUrl) {
      return reply.code(400).send({ error: 'priceId, successUrl e cancelUrl são obrigatórios' })
    }

    const sessionConfig: any = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: 'pt-BR',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      payment_method_types: ['card', 'boleto'],
      consent_collection: {
        terms_of_service: 'required',
      },
      custom_text: {
        submit: { message: '🚀 Ativar minha assinatura Equipe Ativa' },
        terms_of_service_acceptance: {
          message: 'Concordo com os [Termos](https://equipeativa.com/termos)',
        },
      },
    }

    // Email do cliente
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 })
      if (customers.data.length > 0) {
        sessionConfig.customer = customers.data[0].id
      } else {
        sessionConfig.customer_email = customerEmail
      }
    }

    // Metadata customizada
    if (metadata) {
      sessionConfig.metadata = metadata
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return reply.send({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Erro ao criar checkout:', error)
    return reply.code(500).send({ 
      error: error instanceof Error ? error.message : 'Erro ao criar checkout'
    })
  }
})
```

## 💳 Personalização de Métodos de Pagamento

### 📋 Métodos Disponíveis no Brasil

| Método | Stripe Suporta | Configuração | Recomendado |
|--------|----------------|--------------|-------------|
| **Cartão de Crédito/Débito** | ✅ Sim | Habilitado por padrão | ✅ Obrigatório |
| **Boleto Bancário** | ✅ Sim | Habilitar no Dashboard | ⭐ Recomendado |
| **PIX** | ❌ Não oficial | Use gateway BR (Mercado Pago, PagSeguro) | ⏳ Aguardando |
| **Apple Pay / Google Pay** | ✅ Sim | Automático com cartões | ✅ Sim |
| **Link (Stripe)** | ✅ Sim | Automático | ✅ Sim |
| **PayPal** | ❌ Não | Integração separada | ❌ Não |
| **Transferência Bancária** | ❌ Não no BR | Só EUA/Europa | ❌ Não |

### 🔧 Configuração no Dashboard

#### Passo 1: Habilitar Boleto no Stripe

```bash
1. Acesse: https://dashboard.stripe.com
2. Vá em: Settings → Payment methods
3. Clique em: "+ Add payment method"
4. Selecione: "Boleto" 
5. Configure:
   ✓ Prazo de vencimento: 3 dias úteis (padrão)
   ✓ Instruções customizadas (opcional)
   ✓ Taxa: 3.99% + R$ 0,49 (Stripe cobra)
6. Clique em: "Enable"
```

#### Passo 2: Configurar Limites e Regras

```bash
Settings → Payment methods → Boleto → Configure

Opções disponíveis:
- Valor mínimo: R$ 5,00
- Valor máximo: R$ 1.000.000,00
- Prazo de vencimento: 1-30 dias
- Statement descriptor: Como aparece no extrato
```

### 💻 Implementação no Código

#### Opção 1: Aceitar Cartão + Boleto (Recomendado)

```typescript
// src/http/routes/billing.ts

const sessionConfig: any = {
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: successUrl,
  cancel_url: cancelUrl,
  
  // ✅ ACEITAR CARTÃO E BOLETO
  payment_method_types: ['card', 'boleto'],
  
  // Idioma português
  locale: 'pt-BR',
}
```

#### Opção 2: Só Cartão (Internacional)

```typescript
const sessionConfig: any = {
  payment_method_types: ['card'], // Apenas cartões
  locale: 'pt-BR',
}
```

#### Opção 3: Múltiplos Métodos (Avançado)

```typescript
const sessionConfig: any = {
  // Aceita cartão, boleto e métodos digitais
  payment_method_types: [
    'card',        // Visa, Mastercard, Amex, Elo, etc
    'boleto',      // Boleto bancário
    'link',        // Stripe Link (pagar com 1 clique)
  ],
  
  // Para Apple Pay/Google Pay, não precisa configurar
  // Eles aparecem automaticamente quando 'card' está habilitado
  
  locale: 'pt-BR',
}
```

#### Opção 4: Métodos Condicionais por Plano

```typescript
app.post('/stripe/checkout', {
  preHandler: [authPreHandler],
}, async (request, reply) => {
  const { priceId, customerEmail, planType } = request.body
  
  // Métodos base
  let paymentMethods = ['card']
  
  // Adiciona boleto apenas para planos específicos
  if (planType === 'monthly' || planType === 'basic') {
    paymentMethods.push('boleto')
  }
  
  // Enterprise só aceita cartão (pagamento recorrente)
  if (planType === 'enterprise') {
    paymentMethods = ['card'] // Só cartão
  }
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: paymentMethods,
    line_items: [{ price: priceId, quantity: 1 }],
    // ... resto da config
  })
  
  return reply.send({ url: session.url })
})
```

### ⚠️ Limitações Importantes do Boleto

1. **Assinaturas Recorrentes**: Boleto NÃO funciona bem para cobrança automática
   - Primeira cobrança: OK ✅
   - Renovações mensais: ❌ Cliente precisa pagar manualmente cada mês
   
2. **Solução Recomendada**:
   - Use boleto apenas para **primeira cobrança**
   - Exija cadastro de cartão após primeiro pagamento
   - Ou ofereça boleto apenas para **planos anuais** (pagamento único)

3. **Código para Primeira Cobrança Boleto + Renovação Cartão**:

```typescript
const sessionConfig: any = {
  mode: 'subscription',
  payment_method_types: ['card', 'boleto'],
  
  // 🔥 IMPORTANTE: Exigir cartão para renovação
  payment_method_collection: 'if_required', // Stripe pede cartão após boleto
  
  // Ou explicitamente:
  subscription_data: {
    trial_period_days: 0,
    payment_settings: {
      payment_method_types: ['card'], // Renovações só aceitam cartão
      save_default_payment_method: 'on_subscription',
    },
  },
}
```

### 🎯 Melhor Prática para SaaS Brasileiro

```typescript
// Configuração ideal para Brasil
const sessionConfig: any = {
  mode: 'subscription',
  
  // Aceita cartão e boleto na primeira cobrança
  payment_method_types: ['card', 'boleto'],
  
  // Idioma e moeda
  locale: 'pt-BR',
  currency: 'brl',
  
  // Dados para nota fiscal
  billing_address_collection: 'required',
  
  // Exigir cartão para renovações automáticas
  subscription_data: {
    payment_settings: {
      payment_method_types: ['card'], // Renovação só cartão
      save_default_payment_method: 'on_subscription',
    },
  },
  
  // Texto explicativo
  custom_text: {
    submit: {
      message: '💳 Cartão: cobrança automática | 📄 Boleto: pague manualmente cada mês',
    },
  },
}
```

### 📱 Como Fica para o Cliente

**Ao escolher CARTÃO:**
- ✅ Pagamento imediato
- ✅ Renovação automática todo mês
- ✅ Apple Pay / Google Pay disponível
- ✅ 3D Secure para segurança

**Ao escolher BOLETO:**
- ✅ Gera código de barras
- ✅ Prazo de 3 dias para pagar
- ⚠️ Precisa pagar novo boleto todo mês (não renova automático)
- ⚠️ Assinatura suspensa se não pagar

### 🔍 Monitorar Pagamentos de Boleto

```typescript
// Webhook para monitorar boletos
app.post('/stripe/webhook', async (request, reply) => {
  const event = stripe.webhooks.constructEvent(...)
  
  switch (event.type) {
    case 'invoice.payment_succeeded':
      // Pagamento confirmado (cartão ou boleto)
      console.log('✅ Pagamento recebido')
      break
      
    case 'invoice.payment_failed':
      // Boleto venceu ou cartão recusado
      console.log('❌ Pagamento falhou')
      // Enviar email de cobrança
      break
      
    case 'customer.subscription.updated':
      // Cliente trocou cartão ou método de pagamento
      break
  }
})
```

### 💡 Recomendação Final

Para **SaaS com cobrança mensal**:
```typescript
payment_method_types: ['card', 'boleto'] // Aceita ambos
```

Para **SaaS com planos anuais**:
```typescript
payment_method_types: ['card', 'boleto'] // Boleto funciona bem aqui
```

Para **SaaS internacional**:
```typescript
payment_method_types: ['card'] // Só cartão
```

## 🚀 Deploy

Lembre-se de configurar no Stripe Dashboard:
1. **Settings → Branding**: Adicione logo, cores e ícone
2. **Settings → Payment Methods**: ⭐ **HABILITAR BOLETO AQUI**
3. **Webhooks**: `https://api.equipeativa.com/stripe/webhook`
4. **Customer Portal**: Ativar em Settings → Billing
5. **Test Mode**: Testar primeiro antes de produção
6. **Payment Methods**: Habilitar boleto em Settings → Payment Methods

### 🧪 Testar Pagamentos

**Cartões de teste:**
```
Sucesso: 4242 4242 4242 4242
Recusado: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184
```

**Boleto de teste:**
```
Em Test Mode, boletos são aprovados automaticamente
Em Production, você precisa realmente pagar o boleto
```

## 🚀 Deploy

Lembre-se de configurar no Stripe Dashboard:
1. **Settings → Branding**: Adicione logo, cores e ícone
2. **Webhooks**: `https://api.equipeativa.com/stripe/webhook`
3. **Customer Portal**: Ativar em Settings → Billing
4. **Test Mode**: Testar primeiro antes de produção
5. **Payment Methods**: Habilitar boleto em Settings → Payment Methods
