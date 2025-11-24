import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import {
  paymentMethods,
  payments,
  plans,
  subscriptions,
  usageRecords,
} from '../db/schema/billings.ts'
import { organizations } from '../db/schema/organization.ts'
import { stripeService } from './stripe.ts'
import type {
  CreatePaymentMethod,
  CreateSubscription,
  CreateUsageRecord,
  UpdatePaymentMethod,
  UpdateSubscription,
} from '../http/schemas/billing-schemas.ts'

export class BillingService {
  /**
   * Lista todos os planos disponíveis
   */
  async listPlans() {
    return await db.query.plans.findMany({
      where: eq(plans.is_active, true),
      orderBy: [plans.price],
    })
  }

  /**
   * Obtém um plano específico
   */
  async getPlan(planId: string) {
    return await db.query.plans.findFirst({
      where: eq(plans.id, planId),
    })
  }

  /**
   * Cria um plano
   */
  async createPlan(data: typeof plans.$inferInsert) {
    const [plan] = await db.insert(plans).values(data).returning()
    return plan
  }

  /**
   * Atualiza um plano
   */
  async updatePlan(planId: string, data: Partial<typeof plans.$inferInsert>) {
    const [plan] = await db
      .update(plans)
      .set({ ...data, updated_at: new Date() })
      .where(eq(plans.id, planId))
      .returning()
    return plan
  }

  /**
   * Cria uma assinatura para uma organização
   */
  async createSubscription(data: CreateSubscription) {
    // Busca a organização
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, data.organization_id),
    })

    if (!organization) {
      throw new Error('Organização não encontrada')
    }

    // Busca o plano
    const plan = await this.getPlan(data.plan_id)
    if (!plan) {
      throw new Error('Plano não encontrado')
    }

    // Verifica se já existe uma assinatura ativa
    const existingSubscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.organization_id, data.organization_id),
        eq(subscriptions.status, 'active')
      ),
    })

    if (existingSubscription) {
      throw new Error('Organização já possui uma assinatura ativa')
    }

    // Cria ou obtém o cliente no Stripe
    let stripeCustomerId = organization.stripe_customer_id
    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer({
        email: organization.owner_email || 'contato@equipeativa.com',
        name: organization.name,
        metadata: { organization_id: organization.id },
      })
      stripeCustomerId = customer.id

      // Atualiza a organização com o Stripe customer ID
      await db
        .update(organizations)
        .set({ stripe_customer_id: stripeCustomerId })
        .where(eq(organizations.id, organization.id))
    }

    // Define período da assinatura
    const currentPeriodStart = new Date()
    const trialDays = data.trial_days ?? plan.trial_days
    const trialEnd = trialDays && trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null

    // Calcula o período de cobrança
    let currentPeriodEnd = new Date()
    if (plan.interval === 'monthly') {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)
    } else if (plan.interval === 'quarterly') {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3)
    } else if (plan.interval === 'yearly') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1)
    }

    // Cria assinatura no Stripe (se houver stripe_price_id no plano)
    let stripeSubscription = null
    if (plan.stripe_price_id) {
      stripeSubscription = await stripeService.createSubscription({
        customer: stripeCustomerId,
        items: [{ price: plan.stripe_price_id }],
        trial_period_days: trialDays && trialDays > 0 ? trialDays : undefined,
        default_payment_method: data.payment_method_id,
        metadata: {
          organization_id: data.organization_id,
          plan_id: data.plan_id,
        },
      })
    }

    // Cria a assinatura no banco de dados
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        organization_id: data.organization_id,
        plan_id: data.plan_id,
        status: trialDays && trialDays > 0 ? 'trialing' : 'active',
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        trial_end: trialEnd,
        stripe_subscription_id: stripeSubscription?.id,
      })
      .returning()

    return subscription
  }

  /**
   * Atualiza uma assinatura (troca de plano)
   */
  async updateSubscription(subscriptionId: string, data: Partial<UpdateSubscription>) {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
    })

    if (!subscription) {
      throw new Error('Assinatura não encontrada')
    }

    // Se está mudando de plano
    if (data.plan_id && data.plan_id !== subscription.plan_id) {
      const newPlan = await this.getPlan(data.plan_id)
      if (!newPlan) {
        throw new Error('Plano não encontrado')
      }

      // Atualiza no Stripe se houver subscription
      if (subscription.stripe_subscription_id && newPlan.stripe_price_id) {
        await stripeService.updateSubscription(subscription.stripe_subscription_id, {
          items: [{ price: newPlan.stripe_price_id }],
          proration_behavior: 'create_prorations',
        })
      }
    }

    // Atualiza no banco
    const [updated] = await db
      .update(subscriptions)
      .set({ ...data, updated_at: new Date() })
      .where(eq(subscriptions.id, subscriptionId))
      .returning()

    return updated
  }

  /**
   * Cancela uma assinatura
   */
  async cancelSubscription(subscriptionId: string, cancelImmediately: boolean = false) {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
    })

    if (!subscription) {
      throw new Error('Assinatura não encontrada')
    }

    // Cancela no Stripe
    if (subscription.stripe_subscription_id) {
      await stripeService.cancelSubscription(
        subscription.stripe_subscription_id,
        cancelImmediately
      )
    }

    // Atualiza no banco
    const updateData: Partial<typeof subscriptions.$inferInsert> = {
      canceled_at: new Date(),
      updated_at: new Date(),
    }

    if (cancelImmediately) {
      updateData.status = 'canceled'
      updateData.ended_at = new Date()
    }

    const [updated] = await db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, subscriptionId))
      .returning()

    return updated
  }

  /**
   * Obtém assinatura ativa de uma organização
   */
  async getActiveSubscription(organizationId: string) {
    try {
      const results = await db
        .select()
        .from(subscriptions)
        .leftJoin(plans, eq(subscriptions.plan_id, plans.id))
        .where(
          and(
            eq(subscriptions.organization_id, organizationId),
            eq(subscriptions.status, 'active')
          )
        )
        .limit(1)
      
      if (results.length === 0) {
        return null
      }
      
      const result = results[0]
      return {
        ...result.subscriptions,
        plan: result.plans,
      }
    } catch (error) {
      console.error('Erro ao buscar assinatura ativa:', error)
      return null
    }
  }

  /**
   * Lista métodos de pagamento de uma organização
   */
  async listPaymentMethods(organizationId: string) {
    try {
      return await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.organization_id, organizationId))
        .orderBy(desc(paymentMethods.is_default), desc(paymentMethods.created_at))
    } catch (error) {
      console.error('Erro ao listar métodos de pagamento:', error)
      return []
    }
  }

  /**
   * Adiciona um método de pagamento
   */
  async addPaymentMethod(data: CreatePaymentMethod) {
    // Se for definido como padrão, remove o padrão anterior
    if (data.is_default) {
      await db
        .update(paymentMethods)
        .set({ is_default: false })
        .where(eq(paymentMethods.organization_id, data.organization_id))
    }

    const [paymentMethod] = await db.insert(paymentMethods).values(data).returning()
    return paymentMethod
  }

  /**
   * Atualiza um método de pagamento
   */
  async updatePaymentMethod(paymentMethodId: string, data: UpdatePaymentMethod) {
    // Se está sendo definido como padrão
    if (data.is_default) {
      const currentMethod = await db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, paymentMethodId),
      })

      if (currentMethod) {
        await db
          .update(paymentMethods)
          .set({ is_default: false })
          .where(eq(paymentMethods.organization_id, currentMethod.organization_id))
      }
    }

    const [updated] = await db
      .update(paymentMethods)
      .set({ ...data, updated_at: new Date() })
      .where(eq(paymentMethods.id, paymentMethodId))
      .returning()

    return updated
  }

  /**
   * Remove um método de pagamento
   */
  async deletePaymentMethod(paymentMethodId: string) {
    const paymentMethod = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, paymentMethodId),
    })

    if (!paymentMethod) {
      throw new Error('Método de pagamento não encontrado')
    }

    // Remove do Stripe se existir
    if (paymentMethod.stripe_payment_method_id) {
      await stripeService.detachPaymentMethod(paymentMethod.stripe_payment_method_id)
    }

    await db.delete(paymentMethods).where(eq(paymentMethods.id, paymentMethodId))
  }

  /**
   * Lista pagamentos de uma assinatura
   */
  async listPayments(subscriptionId: string, limit: number = 20) {
    return await db.query.payments.findMany({
      where: eq(payments.subscription_id, subscriptionId),
      orderBy: [desc(payments.created_at)],
      limit,
    })
  }

  /**
   * Cria um registro de uso
   */
  async createUsageRecord(data: CreateUsageRecord) {
    const [record] = await db.insert(usageRecords).values(data).returning()
    return record
  }

  /**
   * Obtém uso atual de uma assinatura
   */
  async getCurrentUsage(subscriptionId: string) {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
      with: { plan: true },
    })

    if (!subscription) {
      throw new Error('Assinatura não encontrada')
    }

    // Busca registros de uso do período atual
    const usageRecord = await db.query.usageRecords.findFirst({
      where: and(
        eq(usageRecords.subscription_id, subscriptionId),
        gte(usageRecords.period_start, subscription.current_period_start),
        lte(usageRecords.period_end, subscription.current_period_end)
      ),
      orderBy: [desc(usageRecords.created_at)],
    })

    return {
      subscription,
      usage: usageRecord,
      limits: {
        max_members: subscription.plan.max_members,
        max_units: subscription.plan.max_units,
        max_demands: subscription.plan.max_demands,
        max_storage_gb: subscription.plan.max_storage_gb,
      },
    }
  }

  /**
   * Verifica se a organização pode criar mais recursos
   */
  async canCreateResource(
    organizationId: string,
    resourceType: 'member' | 'unit' | 'demand'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.getActiveSubscription(organizationId)

    if (!subscription) {
      return { allowed: false, reason: 'Nenhuma assinatura ativa' }
    }

    const usage = await this.getCurrentUsage(subscription.id)
    const limits = usage.limits
    const currentUsage = usage.usage

    if (!currentUsage) {
      return { allowed: true }
    }

    switch (resourceType) {
      case 'member':
        if (limits.max_members && currentUsage.members_count >= limits.max_members) {
          return { allowed: false, reason: 'Limite de membros atingido' }
        }
        break
      case 'unit':
        if (limits.max_units && currentUsage.units_count >= limits.max_units) {
          return { allowed: false, reason: 'Limite de unidades atingido' }
        }
        break
      case 'demand':
        if (limits.max_demands && currentUsage.demands_count >= limits.max_demands) {
          return { allowed: false, reason: 'Limite de demandas atingido' }
        }
        break
    }

    return { allowed: true }
  }
}

export const billingService = new BillingService()
