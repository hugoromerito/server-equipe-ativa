import Stripe from 'stripe'
import { env } from '../config/env.ts'

// Inicializa o cliente Stripe
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

export class StripeService {
  /**
   * Cria um cliente no Stripe
   */
  async createCustomer(params: {
    email: string
    name: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Customer> {
    return await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    })
  }

  /**
   * Atualiza um cliente no Stripe
   */
  async updateCustomer(
    customerId: string,
    params: {
      email?: string
      name?: string
      metadata?: Record<string, string>
    }
  ): Promise<Stripe.Customer> {
    return await stripe.customers.update(customerId, params)
  }

  /**
   * Cria um método de pagamento
   */
  async createPaymentMethod(params: {
    type: 'card'
    card: {
      token: string
    }
  }): Promise<Stripe.PaymentMethod> {
    return await stripe.paymentMethods.create({
      type: params.type,
      card: { token: params.card.token },
    })
  }

  /**
   * Anexa um método de pagamento a um cliente
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    return await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    })
  }

  /**
   * Define um método de pagamento como padrão
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    return await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })
  }

  /**
   * Remove um método de pagamento
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return await stripe.paymentMethods.detach(paymentMethodId)
  }

  /**
   * Cria um preço no Stripe
   */
  async createPrice(params: {
    product: string
    unit_amount: number
    currency: string
    recurring: {
      interval: 'month' | 'year'
      interval_count?: number
    }
  }): Promise<Stripe.Price> {
    return await stripe.prices.create(params)
  }

  /**
   * Cria uma assinatura no Stripe
   */
  async createSubscription(params: {
    customer: string
    items: Array<{ price: string; quantity?: number }>
    trial_period_days?: number
    default_payment_method?: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.create({
      customer: params.customer,
      items: params.items,
      trial_period_days: params.trial_period_days,
      default_payment_method: params.default_payment_method,
      metadata: params.metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    })
  }

  /**
   * Atualiza uma assinatura
   */
  async updateSubscription(
    subscriptionId: string,
    params: {
      items?: Array<{ id?: string; price: string; quantity?: number }>
      proration_behavior?: 'create_prorations' | 'none' | 'always_invoice'
      metadata?: Record<string, string>
    }
  ): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, params)
  }

  /**
   * Cancela uma assinatura
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false
  ): Promise<Stripe.Subscription> {
    if (cancelImmediately) {
      return await stripe.subscriptions.cancel(subscriptionId)
    }
    
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  }

  /**
   * Reativa uma assinatura cancelada
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })
  }

  /**
   * Obtém uma assinatura
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.retrieve(subscriptionId)
  }

  /**
   * Cria um PaymentIntent
   */
  async createPaymentIntent(params: {
    amount: number
    currency: string
    customer?: string
    payment_method?: string
    metadata?: Record<string, string>
  }): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      customer: params.customer,
      payment_method: params.payment_method,
      metadata: params.metadata,
      confirm: false,
    })
  }

  /**
   * Confirma um PaymentIntent
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.confirm(paymentIntentId)
  }

  /**
   * Cria um reembolso
   */
  async createRefund(params: {
    payment_intent?: string
    charge?: string
    amount?: number
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  }): Promise<Stripe.Refund> {
    return await stripe.refunds.create(params)
  }

  /**
   * Lista faturas de um cliente
   */
  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    })
    return invoices.data
  }

  /**
   * Obtém uma fatura
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await stripe.invoices.retrieve(invoiceId)
  }

  /**
   * Cria um Portal de Cobrança (para o cliente gerenciar sua assinatura)
   */
  async createBillingPortalSession(params: {
    customer: string
    return_url: string
  }): Promise<Stripe.BillingPortal.Session> {
    return await stripe.billingPortal.sessions.create({
      customer: params.customer,
      return_url: params.return_url,
    })
  }

  /**
   * Cria um SetupIntent para salvar método de pagamento no frontend
   * Usado com Stripe Elements para coletar dados de cartão de forma segura
   */
  async createSetupIntent(params: {
    customer: string
    metadata?: Record<string, string>
  }): Promise<Stripe.SetupIntent> {
    return await stripe.setupIntents.create({
      customer: params.customer,
      payment_method_types: ['card'],
      metadata: params.metadata,
      usage: 'off_session',
    })
  }

  /**
   * Cria uma assinatura com PaymentIntent para pagamento imediato no frontend
   * Retorna client_secret para confirmar no frontend com Stripe Elements
   */
  async createSubscriptionWithPayment(params: {
    customer: string
    items: Array<{ price: string; quantity?: number }>
    trial_period_days?: number
    default_payment_method?: string
    metadata?: Record<string, string>
  }): Promise<{
    subscription: Stripe.Subscription
    client_secret: string | null
  }> {
    const subscription = await stripe.subscriptions.create({
      customer: params.customer,
      items: params.items,
      trial_period_days: params.trial_period_days,
      default_payment_method: params.default_payment_method,
      metadata: params.metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    })

    // Extrai o client_secret do PaymentIntent
    const invoice = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent
    const clientSecret = paymentIntent?.client_secret || null

    return { subscription, client_secret: clientSecret }
  }

  /**
   * Cria um Checkout Session para pagamento hospedado pelo Stripe
   * Redireciona o usuário para página de checkout do Stripe
   */
  async createCheckoutSession(params: {
    customer?: string
    customer_email?: string
    line_items: Array<{
      price: string
      quantity?: number
    }>
    mode: 'payment' | 'subscription' | 'setup'
    success_url: string
    cancel_url: string
    metadata?: Record<string, string>
    subscription_data?: {
      trial_period_days?: number
      metadata?: Record<string, string>
    }
  }): Promise<Stripe.Checkout.Session> {
    return await stripe.checkout.sessions.create({
      customer: params.customer,
      customer_email: params.customer_email,
      line_items: params.line_items,
      mode: params.mode,
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      metadata: params.metadata,
      subscription_data: params.subscription_data,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      locale: 'pt-BR',
    })
  }

  /**
   * Recupera uma Checkout Session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent'],
    })
  }

  /**
   * Cria um PaymentIntent para pagamento único no frontend
   */
  async createPaymentIntentForFrontend(params: {
    amount: number
    currency: string
    customer?: string
    metadata?: Record<string, string>
    description?: string
  }): Promise<{
    payment_intent: Stripe.PaymentIntent
    client_secret: string
  }> {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      customer: params.customer,
      metadata: params.metadata,
      description: params.description,
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return {
      payment_intent: paymentIntent,
      client_secret: paymentIntent.client_secret as string,
    }
  }

  /**
   * Constrói um evento de webhook do Stripe
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    return stripe.webhooks.constructEvent(payload, signature, secret)
  }

  /**
   * Lista métodos de pagamento de um cliente
   */
  async listPaymentMethods(
    customerId: string,
    type: 'card' = 'card'
  ): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type,
    })
    return paymentMethods.data
  }

  /**
   * Obtém a chave pública (publishable key)
   * Necessária para inicializar o Stripe no frontend
   */
  getPublishableKey(): string {
    return env.STRIPE_PUBLISHABLE_KEY
  }
}

export const stripeService = new StripeService()
