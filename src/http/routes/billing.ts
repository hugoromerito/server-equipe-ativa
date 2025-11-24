import type { FastifyInstance } from 'fastify'
import { authPreHandler } from '../middlewares/auth.ts'

/**
 * Rotas simplificadas do Stripe
 * Tudo é gerenciado pelo próprio Stripe (Hosted Checkout + Customer Portal)
 */
export async function billingRoutes(app: FastifyInstance) {
  const Stripe = (await import('stripe')).default
  const { env } = await import('../../config/env.ts')
  
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  })

  /**
   * Lista produtos/planos do Stripe
   */
  app.get('/stripe/products', async (request, reply) => {
    try {
      const products = await stripe.products.list({
        active: true,
        expand: ['data.default_price'],
      })
      
      return reply.send(products.data)
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Erro ao buscar produtos'
      })
    }
  })

  /**
   * Lista preços do Stripe
   */
  app.get('/stripe/prices', async (request, reply) => {
    try {
      const prices = await stripe.prices.list({
        active: true,
        expand: ['data.product'],
      })
      
      return reply.send(prices.data)
    } catch (error) {
      console.error('Erro ao buscar preços:', error)
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Erro ao buscar preços'
      })
    }
  })

  /**
   * Cria sessão de checkout do Stripe (Hosted Checkout)
   * O Stripe cuida de tudo: formulário, validação, pagamento, redirecionamento
   */
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
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        locale: 'pt-BR',
      }

      // Se tiver email, cria/busca customer
      if (customerEmail) {
        const customers = await stripe.customers.list({
          email: customerEmail,
          limit: 1,
        })

        if (customers.data.length > 0) {
          sessionConfig.customer = customers.data[0].id
        } else {
          sessionConfig.customer_email = customerEmail
        }
      }

      // Adiciona metadata customizada
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

  /**
   * Webhook do Stripe - recebe eventos de pagamento
   * Configure no dashboard do Stripe: https://dashboard.stripe.com/webhooks
   */
  app.post('/stripe/webhook', async (request, reply) => {
    try {
      const sig = request.headers['stripe-signature'] as string
      const webhookSecret = env.STRIPE_WEBHOOK_SECRET

      if (!sig || !webhookSecret) {
        return reply.code(400).send({ error: 'Missing signature or webhook secret' })
      }

      // O Stripe precisa do body como string ou Buffer
      const body = typeof request.body === 'string' 
        ? request.body 
        : JSON.stringify(request.body)

      // Verifica assinatura do Stripe
      const event = stripe.webhooks.constructEvent(
        body,
        sig,
        webhookSecret
      )

      console.log(`✅ Webhook recebido: ${event.type}`)

      // Processa eventos importantes
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object
          console.log('💳 Checkout completo:', session.id, session.customer_email)
          // Aqui você pode salvar no banco, enviar email, etc
          break

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          const subscription = event.data.object
          console.log('📝 Assinatura atualizada:', subscription.id, subscription.status)
          break

        case 'customer.subscription.deleted':
          const deletedSub = event.data.object
          console.log('❌ Assinatura cancelada:', deletedSub.id)
          break

        case 'invoice.payment_succeeded':
          const invoice = event.data.object
          console.log('✅ Pagamento bem-sucedido:', invoice.id)
          break

        case 'invoice.payment_failed':
          const failedInvoice = event.data.object
          console.log('⚠️  Pagamento falhou:', failedInvoice.id)
          break
      }

      return reply.send({ received: true })
    } catch (error) {
      console.error('❌ Erro no webhook:', error)
      return reply.code(400).send({ 
        error: error instanceof Error ? error.message : 'Erro no webhook'
      })
    }
  })

  /**
   * Busca detalhes de uma sessão de checkout
   */
  app.get('/stripe/checkout/:sessionId', {
    preHandler: [authPreHandler],
  }, async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer'],
      })

      return reply.send(session)
    } catch (error) {
      console.error('Erro ao buscar sessão:', error)
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Erro ao buscar sessão'
      })
    }
  })

  /**
   * Lista assinaturas de um customer
   */
  app.get('/stripe/subscriptions', {
    preHandler: [authPreHandler],
  }, async (request, reply) => {
    try {
      const { customerEmail } = request.query as { customerEmail?: string }

      if (!customerEmail) {
        return reply.code(400).send({ error: 'customerEmail é obrigatório' })
      }

      // Busca customer pelo email
      const customers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      })

      if (customers.data.length === 0) {
        return reply.send({ subscriptions: [] })
      }

      const customerId = customers.data[0].id

      // Busca assinaturas do customer
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        expand: ['data.items.data.price'],
      })

      return reply.send({ subscriptions: subscriptions.data })
    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error)
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Erro ao buscar assinaturas'
      })
    }
  })

  /**
   * Cancela uma assinatura
   */
  app.post('/stripe/subscriptions/:subscriptionId/cancel', {
    preHandler: [authPreHandler],
  }, async (request, reply) => {
    try {
      const { subscriptionId } = request.params as { subscriptionId: string }
      const { immediately } = request.body as { immediately?: boolean }

      const subscription = immediately
        ? await stripe.subscriptions.cancel(subscriptionId)
        : await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true,
          })

      return reply.send(subscription)
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error)
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Erro ao cancelar assinatura'
      })
    }
  })

  /**
   * Cria portal do cliente (gerenciar assinatura, pagamento, etc)
   * O Stripe cuida de TUDO: mudança de plano, cartão, cancelamento, faturas
   */
  app.post('/stripe/customer-portal', {
    preHandler: [authPreHandler],
  }, async (request, reply) => {
    try {
      const { customerEmail, returnUrl } = request.body as { 
        customerEmail: string
        returnUrl: string 
      }

      if (!customerEmail || !returnUrl) {
        return reply.code(400).send({ error: 'customerEmail e returnUrl são obrigatórios' })
      }

      // Busca customer
      const customers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      })

      if (customers.data.length === 0) {
        return reply.code(404).send({ error: 'Customer não encontrado' })
      }

      // Cria sessão do portal
      const session = await stripe.billingPortal.sessions.create({
        customer: customers.data[0].id,
        return_url: returnUrl,
      })

      return reply.send({ url: session.url })
    } catch (error) {
      console.error('Erro ao criar portal:', error)
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Erro ao criar portal'
      })
    }
  })
}
