# Sistema de Pagamentos e Assinaturas

Este documento descreve o sistema completo de pagamentos e assinaturas implementado na API Equipe Ativa.

## 📋 Visão Geral

O sistema de billing permite que organizações assinem planos pagos com diferentes recursos e limites. A integração é feita com o Stripe como gateway de pagamento.

## 🗄️ Estrutura do Banco de Dados

### Tabelas Criadas

1. **plans** - Planos disponíveis
   - Contém informações sobre planos (Básico, Profissional, Empresarial)
   - Define limites de recursos (membros, unidades, demandas, armazenamento)
   - Configuração de preços e período de trial

2. **subscriptions** - Assinaturas das organizações
   - Vincula organização ao plano contratado
   - Controla período de cobrança e status
   - Integração com Stripe Subscription

3. **payments** - Histórico de pagamentos
   - Registra todas as transações
   - Status de pagamento (sucesso, falha, reembolso)
   - Vinculado ao Stripe PaymentIntent

4. **payment_methods** - Métodos de pagamento
   - Cartões de crédito/débito salvos
   - Integração com Stripe PaymentMethod
   - Suporte para método padrão

5. **usage_records** - Registro de uso
   - Monitora uso de recursos no período
   - Verifica limites do plano

## 🚀 Funcionalidades Implementadas

### Gestão de Planos

- **GET /plans** - Lista todos os planos disponíveis
- **GET /plans/:planId** - Obtém detalhes de um plano específico
- **POST /plans** - Cria um novo plano (Admin)
- **PATCH /plans/:planId** - Atualiza um plano (Admin)

### Gestão de Assinaturas

- **POST /subscriptions** - Cria uma assinatura para organização
- **GET /organizations/:organizationId/subscription** - Obtém assinatura ativa
- **POST /subscriptions/:subscriptionId/cancel** - Cancela assinatura
- **GET /subscriptions/:subscriptionId/usage** - Verifica uso atual

### Métodos de Pagamento

- **GET /organizations/:organizationId/payment-methods** - Lista métodos
- **POST /payment-methods** - Adiciona novo método
- **PATCH /payment-methods/:paymentMethodId** - Atualiza método
- **DELETE /payment-methods/:paymentMethodId** - Remove método

### Pagamentos

- **GET /subscriptions/:subscriptionId/payments** - Lista pagamentos
- **GET /organizations/:organizationId/can-create/:resourceType** - Verifica limites

### Webhooks

- **POST /webhooks/stripe** - Recebe eventos do Stripe
  - Atualiza status de assinaturas
  - Registra pagamentos
  - Processa cancelamentos

## 🔧 Serviços Implementados

### StripeService (`src/services/stripe.ts`)

Wrapper para API do Stripe com métodos para:
- Criar e gerenciar clientes
- Criar e anexar métodos de pagamento
- Criar e gerenciar assinaturas
- Processar pagamentos e reembolsos
- Validar webhooks

### BillingService (`src/services/billing.ts`)

Lógica de negócio para:
- Gerenciar planos e assinaturas
- Verificar limites de recursos
- Criar registros de uso
- Integrar com Stripe

## 🛡️ Middlewares

### requireActiveSubscription

Verifica se organização tem assinatura ativa antes de permitir acesso.

```typescript
import { requireActiveSubscription } from './http/middlewares/billing.ts'

app.get('/resource', {
  onRequest: [auth, requireActiveSubscription],
  // ...
})
```

### checkResourceLimit

Verifica se organização pode criar mais recursos do tipo especificado.

```typescript
import { checkResourceLimit } from './http/middlewares/billing.ts'

app.post('/members', {
  onRequest: [auth, checkResourceLimit('member')],
  // ...
})
```

### checkStorageLimit

Verifica limite de armazenamento antes de upload.

```typescript
import { checkStorageLimit } from './http/middlewares/billing.ts'

app.post('/upload', {
  onRequest: [auth, checkStorageLimit],
  // ...
})
```

## ⚙️ Configuração

### Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Instalação

```bash
npm install stripe
```

### Migrations

Execute as migrations para criar as tabelas:

```bash
npm run db:generate
npm run db:migrate
```

## 📝 Exemplos de Uso

### Criar uma Assinatura

```typescript
POST /subscriptions
{
  "organization_id": "uuid",
  "plan_id": "uuid",
  "payment_method_id": "uuid", // opcional
  "trial_days": 14 // opcional
}
```

### Verificar Limites

```typescript
GET /organizations/:organizationId/can-create/member

Response:
{
  "allowed": true,
  "reason": null
}
```

### Cancelar Assinatura

```typescript
POST /subscriptions/:subscriptionId/cancel
{
  "cancel_immediately": false // se false, cancela no fim do período
}
```

## 🔄 Fluxo de Pagamento

1. **Cliente seleciona plano** → Frontend chama `POST /subscriptions`
2. **Servidor cria assinatura no Stripe** → Retorna ClientSecret
3. **Frontend confirma pagamento** → Stripe processa
4. **Stripe envia webhook** → Servidor atualiza status
5. **Assinatura ativada** → Usuário tem acesso aos recursos

## 📊 Limites de Planos

Exemplo de configuração:

```typescript
// Plano Básico
{
  "max_members": 10,
  "max_units": 2,
  "max_demands": 50,
  "max_storage_gb": 5
}

// Plano Profissional
{
  "max_members": 50,
  "max_units": 10,
  "max_demands": 500,
  "max_storage_gb": 50
}

// Plano Empresarial
{
  "max_members": null, // ilimitado
  "max_units": null,
  "max_demands": null,
  "max_storage_gb": 500
}
```

## 🔒 Segurança

- Todas as rotas de billing exigem autenticação
- Webhooks validam assinatura do Stripe
- Dados de cartão nunca são armazenados (apenas tokens do Stripe)
- Logs de auditoria para todas as operações de billing

## 📈 Monitoramento

O sistema registra:
- Criação e cancelamento de assinaturas
- Pagamentos bem-sucedidos e falhos
- Tentativas de exceder limites
- Erros de integração com Stripe

## 🧪 Testes

Para testar o sistema:

1. Configure uma conta Stripe em modo teste
2. Use cartões de teste do Stripe
3. Configure webhooks no Stripe Dashboard
4. Use o Stripe CLI para simular eventos

```bash
stripe listen --forward-to localhost:3333/webhooks/stripe
```

## 📚 Recursos Adicionais

- [Documentação Stripe](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)

## 🎯 Próximos Passos

- [ ] Implementar testes automatizados
- [ ] Adicionar suporte a cupons de desconto
- [ ] Implementar upgrade/downgrade de planos
- [ ] Criar relatórios de faturamento
- [ ] Adicionar suporte a múltiplas moedas
- [ ] Implementar trial period automático
- [ ] Criar dashboard de billing no frontend
