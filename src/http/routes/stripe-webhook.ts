import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { stripeService } from '../../services/stripe.ts'
import { env } from '../../config/env.ts'
import { db } from '../../db/connection.ts'
import { payments, subscriptions } from '../../db/schema/billings.ts'
import { eq } from 'drizzle-orm'

export async function stripeWebhookRoutes(app: FastifyInstance) {
  /**
   * Webhook do Stripe para processar eventos
   */
  app.post(
    '/webhooks/stripe',
    {
      config: {
        // Desabilita parser JSON padrão para obter raw body
        rawBody: true,
      },
      schema: {
        tags: ['Webhooks'],
        summary: 'Webhook do Stripe',
        hide: true, // Oculta do Swagger
      },
    },
    async (request, reply) => {
      const signature = request.headers['stripe-signature']

      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Missing stripe-signature header' })
      }

      if (!env.STRIPE_WEBHOOK_SECRET) {
        app.log.error('STRIPE_WEBHOOK_SECRET not configured')
        return reply.status(500).send({ error: 'Webhook secret not configured' })
      }

      try {
        // Constrói o evento verificando a assinatura
        const event = stripeService.constructWebhookEvent(
          (request as any).rawBody as Buffer,
          signature,
          env.STRIPE_WEBHOOK_SECRET
        )

        app.log.info({ event: event.type }, 'Received Stripe webhook event')

        // Processa diferentes tipos de eventos
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as any
            await handleCheckoutSessionCompleted(session)
            break
          }

          case 'customer.subscription.created':
          case 'customer.subscription.updated': {
            const subscription = event.data.object as any
            await handleSubscriptionUpdated(subscription)
            break
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as any
            await handleSubscriptionDeleted(subscription)
            break
          }

          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as any
            await handleInvoicePaymentSucceeded(invoice)
            break
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as any
            await handleInvoicePaymentFailed(invoice)
            break
          }

          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as any
            await handlePaymentIntentSucceeded(paymentIntent)
            break
          }

          case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object as any
            await handlePaymentIntentFailed(paymentIntent)
            break
          }

          case 'setup_intent.succeeded': {
            const setupIntent = event.data.object as any
            await handleSetupIntentSucceeded(setupIntent)
            break
          }

          default:
            app.log.info({ eventType: event.type }, 'Unhandled webhook event type')
        }

        return reply.status(200).send({ received: true })
      } catch (error) {
        app.log.error({ error }, 'Error processing webhook')
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Webhook processing failed',
        })
      }
    }
  )
}

/**
 * Processa checkout.session.completed (Stripe Checkout)
 */
async function handleCheckoutSessionCompleted(session: any) {
  const organizationId = session.metadata?.organization_id
  const planId = session.metadata?.plan_id

  if (!organizationId || !planId) return

  // Se o modo é subscription, a assinatura será processada pelo evento subscription.created
  if (session.mode === 'subscription' && session.subscription) {
    // Busca a assinatura do Stripe
    const stripeSubscriptionId = session.subscription

    // Verifica se já existe no banco
    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
      .limit(1)

    if (!existingSub) {
      // Cria a assinatura no banco
      const stripeSub = await stripeService.getSubscription(stripeSubscriptionId)
      
      await db.insert(subscriptions).values({
        organization_id: organizationId,
        plan_id: planId,
        stripe_subscription_id: stripeSubscriptionId,
        status: mapStripeStatus(stripeSub.status),
        current_period_start: new Date(stripeSub.current_period_start * 1000),
        current_period_end: new Date(stripeSub.current_period_end * 1000),
        trial_end: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      })
    }
  }
}

/**
 * Processa setup_intent.succeeded (salvar cartão)
 */
async function handleSetupIntentSucceeded(setupIntent: any) {
  // O frontend deve chamar /stripe/confirm-setup para salvar o método
  // Este evento apenas confirma que o SetupIntent foi bem-sucedido
  console.log('SetupIntent succeeded:', setupIntent.id)
}

/**
 * Atualiza assinatura quando criada ou atualizada no Stripe
 */
async function handleSubscriptionUpdated(stripeSubscription: any) {
  const subscriptionId = stripeSubscription.id
  const status = mapStripeStatus(stripeSubscription.status)

  // Busca a assinatura no banco pelo stripe_subscription_id
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripe_subscription_id, subscriptionId))
    .limit(1)

  if (subscription) {
    await db
      .update(subscriptions)
      .set({
        status,
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        trial_end: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        canceled_at: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        ended_at: stripeSubscription.ended_at
          ? new Date(stripeSubscription.ended_at * 1000)
          : null,
        updated_at: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
  }
}

/**
 * Marca assinatura como cancelada quando deletada no Stripe
 */
async function handleSubscriptionDeleted(stripeSubscription: any) {
  const subscriptionId = stripeSubscription.id

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      ended_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(subscriptions.stripe_subscription_id, subscriptionId))
}

/**
 * Atualiza pagamento quando invoice é paga com sucesso
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription

  if (!subscriptionId) return

  // Busca a assinatura
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripe_subscription_id, subscriptionId))
    .limit(1)

  if (!subscription) return

  // Cria ou atualiza registro de pagamento
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripe_charge_id, invoice.charge))
    .limit(1)

  if (payment) {
    await db
      .update(payments)
      .set({
        status: 'succeeded',
        paid_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(payments.id, payment.id))
  } else {
    await db.insert(payments).values({
      subscription_id: subscription.id,
      amount: (invoice.amount_paid / 100).toString(),
      currency: invoice.currency.toUpperCase(),
      status: 'succeeded',
      stripe_payment_intent_id: invoice.payment_intent,
      stripe_charge_id: invoice.charge,
      paid_at: new Date(),
    })
  }

  // Atualiza status da assinatura se estava past_due
  if (subscription.status === 'past_due') {
    await db
      .update(subscriptions)
      .set({
        status: 'active',
        updated_at: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
  }
}

/**
 * Atualiza pagamento e assinatura quando invoice falha
 */
async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription

  if (!subscriptionId) return

  // Busca a assinatura
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripe_subscription_id, subscriptionId))
    .limit(1)

  if (!subscription) return

  // Cria ou atualiza registro de pagamento
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripe_payment_intent_id, invoice.payment_intent))
    .limit(1)

  if (payment) {
    await db
      .update(payments)
      .set({
        status: 'failed',
        failure_reason: invoice.last_payment_error?.message || 'Payment failed',
        updated_at: new Date(),
      })
      .where(eq(payments.id, payment.id))
  } else {
    await db.insert(payments).values({
      subscription_id: subscription.id,
      amount: (invoice.amount_due / 100).toString(),
      currency: invoice.currency.toUpperCase(),
      status: 'failed',
      stripe_payment_intent_id: invoice.payment_intent,
      failure_reason: invoice.last_payment_error?.message || 'Payment failed',
    })
  }

  // Atualiza status da assinatura para past_due
  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
      updated_at: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id))
}

/**
 * Atualiza pagamento quando PaymentIntent é bem-sucedido
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripe_payment_intent_id, paymentIntent.id))
    .limit(1)

  if (payment) {
    await db
      .update(payments)
      .set({
        status: 'succeeded',
        paid_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(payments.id, payment.id))
  }
}

/**
 * Atualiza pagamento quando PaymentIntent falha
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripe_payment_intent_id, paymentIntent.id))
    .limit(1)

  if (payment) {
    await db
      .update(payments)
      .set({
        status: 'failed',
        failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
        updated_at: new Date(),
      })
      .where(eq(payments.id, payment.id))
  }
}

/**
 * Mapeia status do Stripe para o status do banco
 */
function mapStripeStatus(
  stripeStatus: string
): 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid' {
  const statusMap: Record<string, any> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'unpaid',
    incomplete_expired: 'unpaid',
    past_due: 'past_due',
    trialing: 'trialing',
    unpaid: 'unpaid',
  }

  return statusMap[stripeStatus] || 'unpaid'
}
