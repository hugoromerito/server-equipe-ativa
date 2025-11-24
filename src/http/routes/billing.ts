import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth, authPreHandler } from '../middlewares/auth.ts'
import { billingService } from '../../services/billing.ts'
import {
  createPlanSchema,
  createSubscriptionSchema,
  updatePlanSchema,
  cancelSubscriptionSchema,
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  planResponseSchema,
  subscriptionResponseSchema,
  subscriptionWithPlanResponseSchema,
  paymentMethodResponseSchema,
  paymentResponseSchema,
} from '../schemas/billing-schemas.ts'

export async function billingRoutes(app: FastifyInstance) {
  // =============== PLANS ===============

  /**
   * Lista todos os planos disponíveis do Stripe (fonte oficial)
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/plans',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Lista produtos/planos do Stripe',
          description: 'Busca os planos diretamente do Stripe (sempre atualizado)',
          response: {
            200: z.object({
              products: z.array(z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                active: z.boolean(),
                metadata: z.record(z.string()),
                default_price: z.object({
                  id: z.string(),
                  unit_amount: z.number().nullable(),
                  currency: z.string(),
                  recurring: z.object({
                    interval: z.enum(['day', 'week', 'month', 'year']),
                    interval_count: z.number(),
                  }).nullable(),
                }).nullable(),
              })),
            }),
          },
        },
      },
      async (request, reply) => {
        try {
          const { stripeService } = await import('../../services/stripe.ts')
          const products = await stripeService.listProducts({ active: true })
          
          // Formatar resposta
          const formattedProducts = products.map(product => ({
            id: product.id,
            name: product.name,
            description: product.description,
            active: product.active,
            metadata: product.metadata || {},
            default_price: product.default_price ? {
              id: typeof product.default_price === 'string' 
                ? product.default_price 
                : product.default_price.id,
              unit_amount: typeof product.default_price === 'object' 
                ? product.default_price.unit_amount 
                : null,
              currency: typeof product.default_price === 'object' 
                ? product.default_price.currency 
                : 'brl',
              recurring: typeof product.default_price === 'object' 
                ? product.default_price.recurring 
                : null,
            } : null,
          }))
          
          return reply.status(200).send({ products: formattedProducts })
        } catch (error) {
          request.log.error('Erro ao buscar produtos do Stripe:', error)
          return reply.status(500).send({ 
            message: 'Erro ao buscar produtos do Stripe',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          })
        }
      }
    )

  /**
   * Cria um novo plano (Admin apenas)
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/plans',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Cria um novo plano',
          security: [{ bearerAuth: [] }],
          body: createPlanSchema,
          response: {
            201: z.object({
              plan: planResponseSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        // TODO: Adicionar verificação de admin
        const plan = await billingService.createPlan(request.body as any)
        return reply.status(201).send({ plan })
      }
    )

  /**
   * Atualiza um plano (Admin apenas)
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch(
      '/plans/:planId',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Atualiza um plano',
          security: [{ bearerAuth: [] }],
          params: z.object({
            planId: z.string().uuid(),
          }),
          body: updatePlanSchema,
          response: {
            200: z.object({
              plan: planResponseSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { planId } = request.params as any
        const plan = await billingService.updatePlan(planId, request.body as any)
        return reply.status(200).send({ plan })
      }
    )

  // =============== SUBSCRIPTIONS ===============

  /**
   * Cria uma assinatura para uma organização
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/subscriptions',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Cria uma assinatura',
          security: [{ bearerAuth: [] }],
          body: createSubscriptionSchema,
          response: {
            201: z.object({
              subscription: subscriptionResponseSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        try {
          const subscription = await billingService.createSubscription(request.body as any)
          return reply.status(201).send({ subscription })
        } catch (error) {
          if (error instanceof Error) {
            return reply.status(400 as any).send({ message: error.message })
          }
          throw error
        }
      }
    )

  /**
   * Obtém a assinatura ativa de uma organização
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/organizations/:organizationId/subscription',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Obtém assinatura ativa da organização',
          security: [{ bearerAuth: [] }],
          params: z.object({
            organizationId: z.string().uuid(),
          }),
          response: {
            200: z.object({
              subscription: subscriptionWithPlanResponseSchema.nullable(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { organizationId } = request.params as any
        const subscription = await billingService.getActiveSubscription(organizationId)
        return reply.status(200).send({ subscription })
      }
    )

  /**
   * Cancela uma assinatura
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/subscriptions/:subscriptionId/cancel',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Cancela uma assinatura',
          security: [{ bearerAuth: [] }],
          params: z.object({
            subscriptionId: z.string().uuid(),
          }),
          body: z.object({
            cancel_immediately: z.boolean().default(false),
          }),
          response: {
            200: z.object({
              subscription: subscriptionResponseSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { subscriptionId } = request.params as any
        const { cancel_immediately } = request.body as any

        try {
          const subscription = await billingService.cancelSubscription(
            subscriptionId,
            cancel_immediately
          )
          return reply.status(200).send({ subscription })
        } catch (error) {
          if (error instanceof Error) {
            return reply.status(400 as any).send({ message: error.message })
          }
          throw error
        }
      }
    )

  /**
   * Cancela uma assinatura
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/subscriptions/:subscriptionId/usage',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Obtém uso atual da assinatura',
          security: [{ bearerAuth: [] }],
          params: z.object({
            subscriptionId: z.string().uuid(),
          }),
          response: {
            200: z.object({
              usage: z.object({
                subscription: subscriptionWithPlanResponseSchema,
                usage: z
                  .object({
                    members_count: z.number(),
                    units_count: z.number(),
                    demands_count: z.number(),
                    storage_used_gb: z.string(),
                  })
                  .nullable(),
                limits: z.object({
                  max_members: z.number().nullable(),
                  max_units: z.number().nullable(),
                  max_demands: z.number().nullable(),
                  max_storage_gb: z.number().nullable(),
                }),
              }),
            }),
          },
        },
      },
      async (request, reply) => {
        const { subscriptionId } = request.params as any

        try {
          const usage = await billingService.getCurrentUsage(subscriptionId)
          return reply.status(200).send({ usage })
        } catch (error) {
          if (error instanceof Error) {
            return reply.status(400 as any).send({ message: error.message })
          }
          throw error
        }
      }
    )

  // =============== PAYMENT METHODS ===============

  /**
   * Lista métodos de pagamento de uma organização
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/organizations/:organizationId/payment-methods',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Lista métodos de pagamento',
          security: [{ bearerAuth: [] }],
          params: z.object({
            organizationId: z.string().uuid(),
          }),
          response: {
            200: z.object({
              payment_methods: z.array(paymentMethodResponseSchema),
            }),
          },
        },
      },
      async (request, reply) => {
        const { organizationId } = request.params as any
        const paymentMethods = await billingService.listPaymentMethods(organizationId)
        return reply.status(200).send({ payment_methods: paymentMethods })
      }
    )

  /**
   * Adiciona um método de pagamento
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/payment-methods',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Adiciona método de pagamento',
          security: [{ bearerAuth: [] }],
          body: createPaymentMethodSchema,
          response: {
            201: z.object({
              payment_method: paymentMethodResponseSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const paymentMethod = await billingService.addPaymentMethod(request.body as any)
        return reply.status(201).send({ payment_method: paymentMethod })
      }
    )

  /**
   * Atualiza um método de pagamento
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch(
      '/payment-methods/:paymentMethodId',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Atualiza método de pagamento',
          security: [{ bearerAuth: [] }],
          params: z.object({
            paymentMethodId: z.string().uuid(),
          }),
          body: updatePaymentMethodSchema.omit({ paymentMethodId: true }),
          response: {
            200: z.object({
              payment_method: paymentMethodResponseSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { paymentMethodId } = request.params as any
        const paymentMethod = await billingService.updatePaymentMethod(
          paymentMethodId,
          request.body as any
        )
        return reply.status(200).send({ payment_method: paymentMethod })
      }
    )

  /**
   * Remove um método de pagamento
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/payment-methods/:paymentMethodId',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Remove método de pagamento',
          security: [{ bearerAuth: [] }],
          params: z.object({
            paymentMethodId: z.string().uuid(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { paymentMethodId } = request.params as any

        try {
          await billingService.deletePaymentMethod(paymentMethodId)
          return reply.status(204).send()
        } catch (error) {
          if (error instanceof Error) {
            return reply.status(400 as any).send({ message: error.message })
          }
          throw error
        }
      }
    )

  // =============== PAYMENTS ===============

  /**
   * Lista pagamentos de uma assinatura
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/subscriptions/:subscriptionId/payments',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Lista pagamentos da assinatura',
          security: [{ bearerAuth: [] }],
          params: z.object({
            subscriptionId: z.string().uuid(),
          }),
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(100).default(20),
          }),
          response: {
            200: z.object({
              payments: z.array(paymentResponseSchema),
            }),
          },
        },
      },
      async (request, reply) => {
        const { subscriptionId } = request.params as any
        const { limit } = request.query as any

        const payments = await billingService.listPayments(subscriptionId, limit)
        return reply.status(200).send({ payments })
      }
    )

  /**
   * Verifica se pode criar recurso (verifica limites do plano)
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/organizations/:organizationId/can-create/:resourceType',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Verifica se pode criar recurso',
          security: [{ bearerAuth: [] }],
          params: z.object({
            organizationId: z.string().uuid(),
            resourceType: z.enum(['member', 'unit', 'demand']),
          }),
          response: {
            200: z.object({
              allowed: z.boolean(),
              reason: z.string().optional(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { organizationId, resourceType } = request.params as any

        const result = await billingService.canCreateResource(organizationId, resourceType)
        return reply.status(200).send(result)
      }
    )

  // =============== FRONTEND INTEGRATION ===============

  /**
   * Obtém a chave pública do Stripe para o frontend
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/stripe/config',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Obtém configuração pública do Stripe',
          response: {
            200: z.object({
              publishableKey: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { stripeService } = await import('../../services/stripe.ts')
        return reply.status(200).send({
          publishableKey: stripeService.getPublishableKey(),
        })
      }
    )

  /**
   * Cria um SetupIntent para adicionar método de pagamento no frontend
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/stripe/setup-intent',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Cria SetupIntent para salvar cartão',
          security: [{ bearerAuth: [] }],
          body: z.object({
            organization_id: z.string().uuid(),
          }),
          response: {
            200: z.object({
              client_secret: z.string(),
              setup_intent_id: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { organization_id } = request.body as any
        const { stripeService } = await import('../../services/stripe.ts')
        const { db } = await import('../../db/connection.ts')
        const { organizations } = await import('../../db/schema/organization.ts')
        const { eq } = await import('drizzle-orm')

        // Busca organização
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, organization_id),
        })

        if (!org) {
          return reply.status(404 as any).send({ message: 'Organização não encontrada' })
        }

        // Cria ou obtém customer no Stripe
        let customerId = org.stripe_customer_id
        if (!customerId) {
          const customer = await stripeService.createCustomer({
            email: org.owner_email || 'contato@equipeativa.com',
            name: org.name,
            metadata: { organization_id: org.id },
          })
          customerId = customer.id

          await db
            .update(organizations)
            .set({ stripe_customer_id: customerId })
            .where(eq(organizations.id, org.id))
        }

        // Cria SetupIntent
        const setupIntent = await stripeService.createSetupIntent({
          customer: customerId,
          metadata: { organization_id },
        })

        return reply.status(200).send({
          client_secret: setupIntent.client_secret as string,
          setup_intent_id: setupIntent.id,
        })
      }
    )

  /**
   * Cria uma Checkout Session (modo hospedado pelo Stripe)
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/stripe/create-checkout-session',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Cria sessão de checkout hospedado',
          security: [{ bearerAuth: [] }],
          body: z.object({
            organization_id: z.string().uuid(),
            plan_id: z.string().uuid(),
            success_url: z.string().url(),
            cancel_url: z.string().url(),
          }),
          response: {
            200: z.object({
              checkout_url: z.string(),
              session_id: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { organization_id, plan_id, success_url, cancel_url } = request.body as any
        const { stripeService } = await import('../../services/stripe.ts')
        const { db } = await import('../../db/connection.ts')
        const { organizations } = await import('../../db/schema/organization.ts')
        const { plans } = await import('../../db/schema/billings.ts')
        const { eq } = await import('drizzle-orm')

        // Busca organização e plano
        const [org, plan] = await Promise.all([
          db.query.organizations.findFirst({
            where: eq(organizations.id, organization_id),
          }),
          db.query.plans.findFirst({
            where: eq(plans.id, plan_id),
          }),
        ])

        if (!org) {
          return reply.status(404 as any).send({ message: 'Organização não encontrada' })
        }
        if (!plan) {
          return reply.status(404 as any).send({ message: 'Plano não encontrado' })
        }
        if (!plan.stripe_price_id) {
          return reply.status(400 as any).send({ message: 'Plano não tem preço configurado no Stripe' })
        }

        // Cria ou obtém customer
        let customerId = org.stripe_customer_id
        if (!customerId) {
          const customer = await stripeService.createCustomer({
            email: org.owner_email || 'contato@equipeativa.com',
            name: org.name,
            metadata: { organization_id: org.id },
          })
          customerId = customer.id

          await db
            .update(organizations)
            .set({ stripe_customer_id: customerId })
            .where(eq(organizations.id, org.id))
        }

        // Cria Checkout Session
        const session = await stripeService.createCheckoutSession({
          customer: customerId,
          line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
          mode: 'subscription',
          success_url,
          cancel_url,
          metadata: {
            organization_id,
            plan_id,
          },
          subscription_data: {
            trial_period_days: plan.trial_days || 0,
            metadata: {
              organization_id,
              plan_id,
            },
          },
        })

        return reply.status(200).send({
          checkout_url: session.url as string,
          session_id: session.id,
        })
      }
    )

  /**
   * Cria assinatura com pagamento integrado (retorna client_secret)
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/stripe/create-subscription-payment',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Cria assinatura com pagamento integrado',
          security: [{ bearerAuth: [] }],
          body: z.object({
            organization_id: z.string().uuid(),
            plan_id: z.string().uuid(),
            payment_method_id: z.string().optional(),
          }),
          response: {
            200: z.object({
              subscription_id: z.string(),
              client_secret: z.string().nullable(),
              status: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { organization_id, plan_id, payment_method_id } = request.body as any

        try {
          const subscription = await billingService.createSubscription({
            organization_id,
            plan_id,
            payment_method_id,
          })

          // Se tem stripe_subscription_id, busca o client_secret
          let clientSecret = null
          if (subscription.stripe_subscription_id) {
            const { stripeService } = await import('../../services/stripe.ts')
            const stripeSub = await stripeService.getSubscription(
              subscription.stripe_subscription_id
            )
            const invoice = stripeSub.latest_invoice as any
            const paymentIntent = invoice?.payment_intent as any
            clientSecret = paymentIntent?.client_secret || null
          }

          return reply.status(200).send({
            subscription_id: subscription.id,
            client_secret: clientSecret,
            status: subscription.status,
          })
        } catch (error) {
          if (error instanceof Error) {
            return reply.status(400 as any).send({ message: error.message })
          }
          throw error
        }
      }
    )

  /**
   * Confirma SetupIntent após pagamento bem-sucedido no frontend
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/stripe/confirm-setup',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Confirma SetupIntent e salva método de pagamento',
          security: [{ bearerAuth: [] }],
          body: z.object({
            organization_id: z.string().uuid(),
            setup_intent_id: z.string(),
            payment_method_id: z.string(),
          }),
          response: {
            200: z.object({
              success: z.boolean(),
              payment_method: paymentMethodResponseSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { organization_id, setup_intent_id, payment_method_id } = request.body as any
        const { stripeService } = await import('../../services/stripe.ts')

        // Busca detalhes do payment method no Stripe
        const { default: Stripe } = await import('stripe')
        const stripe = new Stripe(stripeService['stripe' as keyof typeof stripeService] as any, {
          apiVersion: '2025-02-24.acacia',
        })

        const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id)

        // Salva no banco
        const savedMethod = await billingService.addPaymentMethod({
          organization_id,
          type: 'credit_card',
          stripe_payment_method_id: payment_method_id,
          card_brand: paymentMethod.card?.brand,
          card_last4: paymentMethod.card?.last4,
          card_exp_month: paymentMethod.card?.exp_month,
          card_exp_year: paymentMethod.card?.exp_year,
          is_default: true,
        })

        return reply.status(200).send({
          success: true,
          payment_method: savedMethod,
        })
      }
    )

  /**
   * Cria Portal de Billing para gerenciamento de assinatura
   */
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/stripe/create-portal-session',
      {
        preHandler: [authPreHandler],
        schema: {
          tags: ['Billing'],
          summary: 'Cria portal de gerenciamento de assinatura',
          security: [{ bearerAuth: [] }],
          body: z.object({
            organization_id: z.string().uuid(),
            return_url: z.string().url(),
          }),
          response: {
            200: z.object({
              portal_url: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { organization_id, return_url } = request.body as any
        const { stripeService } = await import('../../services/stripe.ts')
        const { db } = await import('../../db/connection.ts')
        const { organizations } = await import('../../db/schema/organization.ts')
        const { eq } = await import('drizzle-orm')

        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, organization_id),
        })

        if (!org || !org.stripe_customer_id) {
          return reply.status(404 as any).send({
            message: 'Organização não encontrada ou sem customer Stripe',
          })
        }

        const session = await stripeService.createBillingPortalSession({
          customer: org.stripe_customer_id,
          return_url,
        })

        return reply.status(200).send({
          portal_url: session.url,
        })
      }
    )
}




