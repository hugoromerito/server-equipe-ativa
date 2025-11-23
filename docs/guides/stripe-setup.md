# Configuração do Stripe para Pagamentos

Este guia explica como configurar o Stripe para processar pagamentos no sistema Equipe Ativa.

## 📋 Pré-requisitos

1. Conta no Stripe (gratuita): https://stripe.com
2. Node.js instalado
3. Projeto configurado e rodando

## 🚀 Passo a Passo

### 1. Criar Conta no Stripe

1. Acesse https://stripe.com
2. Clique em "Start now" e crie sua conta
3. Complete o processo de verificação

### 2. Obter Chaves de API

1. Acesse o [Dashboard do Stripe](https://dashboard.stripe.com)
2. Vá em **Developers → API keys**
3. Você verá duas chaves em modo teste:
   - **Publishable key** (começa com `pk_test_`)
   - **Secret key** (começa com `sk_test_`) - clique em "Reveal test key"

### 3. Configurar Variáveis de Ambiente

Adicione as chaves ao seu arquivo `.env`:

```env
STRIPE_SECRET_KEY=sk_test_51Abc...
STRIPE_PUBLISHABLE_KEY=pk_test_51Abc...
```

### 4. Configurar Webhooks

Os webhooks permitem que o Stripe notifique sua aplicação sobre eventos (pagamentos, cancelamentos, etc.).

#### Desenvolvimento Local

1. Instale o Stripe CLI:
   ```bash
   # Windows (via Scoop)
   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
   scoop install stripe
   
   # macOS (via Homebrew)
   brew install stripe/stripe-cli/stripe
   
   # Linux
   # Baixe de: https://github.com/stripe/stripe-cli/releases/latest
   ```

2. Faça login no Stripe CLI:
   ```bash
   stripe login
   ```

3. Encaminhe webhooks para seu servidor local:
   ```bash
   stripe listen --forward-to localhost:3333/webhooks/stripe
   ```

4. Copie o webhook secret que aparece (começa com `whsec_`) e adicione ao `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_abc123...
   ```

#### Produção

1. No [Dashboard do Stripe](https://dashboard.stripe.com/webhooks)
2. Clique em **Add endpoint**
3. Configure:
   - **Endpoint URL**: `https://seu-dominio.com/webhooks/stripe`
   - **Events to send**: Selecione:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
4. Clique em **Add endpoint**
5. Copie o **Signing secret** e adicione ao `.env` de produção

### 5. Criar Produtos e Preços no Stripe

Você pode criar produtos manualmente no Dashboard ou via API.

#### Via Dashboard

1. Acesse **Products** no Dashboard
2. Clique em **Add product**
3. Configure:
   - Nome: "Plano Básico", "Plano Profissional", etc.
   - Preço recorrente mensal
   - Moeda: BRL
4. Copie o **Price ID** (começa com `price_`)
5. Adicione ao campo `stripe_price_id` na tabela `plans`

#### Via API (Automático)

O sistema pode criar preços automaticamente. Para isso:

1. Crie um produto no Stripe Dashboard
2. Copie o **Product ID** (começa com `prod_`)
3. Ao criar um plano via API, inclua:
   ```json
   {
     "stripe_product_id": "prod_abc123",
     "price": "49.90",
     "interval": "monthly"
   }
   ```

### 6. Testar Pagamentos

O Stripe fornece cartões de teste:

**Cartão aprovado:**
- Número: `4242 4242 4242 4242`
- CVC: Qualquer 3 dígitos
- Data: Qualquer data futura

**Cartão recusado:**
- Número: `4000 0000 0000 0002`

**Mais cartões de teste:** https://stripe.com/docs/testing

### 7. Migrar para Produção

Quando estiver pronto para produção:

1. Complete a ativação da conta no Dashboard
2. Forneça informações bancárias para receber pagamentos
3. Obtenha as chaves de produção:
   - Vá em **Developers → API keys**
   - Mude de "Test mode" para "Live mode"
   - Copie as novas chaves (começam com `pk_live_` e `sk_live_`)
4. Atualize o `.env` de produção com as chaves live
5. Configure webhooks de produção (passo 4)

## 🔒 Segurança

**IMPORTANTE:**
- ❌ **NUNCA** compartilhe sua Secret Key
- ❌ **NUNCA** commite as chaves no Git
- ✅ Use variáveis de ambiente
- ✅ Use chaves diferentes para dev/prod
- ✅ Ative 2FA na conta Stripe

## 📊 Monitoramento

Você pode monitorar:
- **Pagamentos**: Dashboard → Payments
- **Assinaturas**: Dashboard → Subscriptions
- **Clientes**: Dashboard → Customers
- **Webhooks**: Dashboard → Developers → Webhooks

## 🧪 Testar Webhooks Localmente

```bash
# Terminal 1: Inicie seu servidor
npm run dev

# Terminal 2: Encaminhe webhooks
stripe listen --forward-to localhost:3333/webhooks/stripe

# Terminal 3: Dispare um evento de teste
stripe trigger payment_intent.succeeded
```

## 📚 Recursos Úteis

- [Documentação Stripe](https://stripe.com/docs)
- [API Reference](https://stripe.com/docs/api)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Billing Quickstart](https://stripe.com/docs/billing/quickstart)

## 💡 Dicas

1. **Sempre teste em modo teste primeiro**
2. **Configure webhooks antes de ir para produção**
3. **Monitore logs de webhook no Dashboard**
4. **Use o Stripe CLI para desenvolvimento local**
5. **Implemente retry logic para webhooks**

## ❓ Problemas Comuns

### Webhook não está sendo recebido

- Verifique se o servidor está rodando
- Confirme que o endpoint está correto
- Verifique logs no Dashboard do Stripe
- Teste com `stripe trigger` primeiro

### Pagamento sendo recusado

- Use cartões de teste válidos
- Verifique se está em modo teste
- Confirme configuração de moeda (BRL)

### Erro de autenticação

- Verifique se está usando a chave correta (test/live)
- Confirme que a Secret Key está configurada
- Recarregue as variáveis de ambiente

## 📞 Suporte

Se precisar de ajuda:
- Stripe Support: https://support.stripe.com
- Community: https://github.com/stripe/stripe-node/issues
- Discord Stripe: https://stripe.com/discord
