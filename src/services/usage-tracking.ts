import { sql } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import { members } from '../db/schema/organization.ts'
import { units } from '../db/schema/organization.ts'
import { demands } from '../db/schema/demands.ts'
import { subscriptions, usageRecords } from '../db/schema/billings.ts'
import { eq, and } from 'drizzle-orm'

/**
 * Serviço para calcular e atualizar o uso dos recursos
 * Conta diretamente do banco de dados (fonte da verdade)
 */
export class UsageTrackingService {
  /**
   * Calcula uso atual de uma organização em tempo real
   */
  async calculateCurrentUsage(organizationId: string) {
    // Conta membros
    const membersResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(members)
      .where(eq(members.organization_id, organizationId))
    const membersCount = membersResult[0]?.count || 0

    // Conta unidades
    const unitsResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(units)
      .where(eq(units.organization_id, organizationId))
    const unitsCount = unitsResult[0]?.count || 0

    // Conta demandas do período atual (mês)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const demandsResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(demands)
      .innerJoin(units, eq(demands.unit_id, units.id))
      .where(
        and(
          eq(units.organization_id, organizationId),
          sql`${demands.created_at} >= ${startOfMonth}`
        )
      )
    const demandsCount = demandsResult[0]?.count || 0

    // TODO: Calcular storage usado (soma de attachments)
    const storageUsedGB = 0

    return {
      members_count: membersCount,
      units_count: unitsCount,
      demands_count: demandsCount,
      storage_used_gb: storageUsedGB.toFixed(2),
    }
  }

  /**
   * Atualiza ou cria registro de uso para uma assinatura
   * Deve ser chamado periodicamente (cronjob) ou após operações importantes
   */
  async updateUsageRecord(subscriptionId: string) {
    // Busca a assinatura
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
      with: { organization: true },
    })

    if (!subscription) {
      throw new Error('Assinatura não encontrada')
    }

    // Calcula uso atual
    const usage = await this.calculateCurrentUsage(subscription.organization_id)

    // Verifica se já existe registro para o período atual
    const existingRecord = await db.query.usageRecords.findFirst({
      where: and(
        eq(usageRecords.subscription_id, subscriptionId),
        eq(usageRecords.period_start, subscription.current_period_start)
      ),
    })

    if (existingRecord) {
      // Atualiza registro existente
      const [updated] = await db
        .update(usageRecords)
        .set({
          members_count: usage.members_count,
          units_count: usage.units_count,
          demands_count: usage.demands_count,
          storage_used_gb: usage.storage_used_gb,
        })
        .where(eq(usageRecords.id, existingRecord.id))
        .returning()
      
      return updated
    }

    // Cria novo registro
    const [newRecord] = await db
      .insert(usageRecords)
      .values({
        subscription_id: subscriptionId,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        members_count: usage.members_count,
        units_count: usage.units_count,
        demands_count: usage.demands_count,
        storage_used_gb: usage.storage_used_gb,
      })
      .returning()

    return newRecord
  }

  /**
   * Atualiza uso de todas as assinaturas ativas
   * Ideal para rodar em cronjob (1x por hora ou 1x por dia)
   */
  async updateAllActiveSubscriptions() {
    const activeSubscriptions = await db.query.subscriptions.findMany({
      where: sql`${subscriptions.status} IN ('active', 'trialing')`,
    })

    console.log(`📊 Atualizando uso de ${activeSubscriptions.length} assinaturas...`)

    for (const subscription of activeSubscriptions) {
      try {
        await this.updateUsageRecord(subscription.id)
        console.log(`✅ Assinatura ${subscription.id} atualizada`)
      } catch (error) {
        console.error(`❌ Erro ao atualizar assinatura ${subscription.id}:`, error)
      }
    }

    console.log('✅ Atualização de uso concluída!')
  }

  /**
   * Verifica se organização pode criar recurso (verificação em tempo real)
   * NÃO depende de usageRecords - conta direto do banco
   */
  async canCreateResource(
    organizationId: string,
    resourceType: 'member' | 'unit' | 'demand'
  ): Promise<{
    allowed: boolean
    reason?: string
    current?: number
    limit?: number
  }> {
    // Busca assinatura ativa
    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.organization_id, organizationId),
        sql`${subscriptions.status} IN ('active', 'trialing')`
      ),
      with: { plan: true },
    })

    if (!subscription) {
      return {
        allowed: false,
        reason: 'Nenhuma assinatura ativa',
      }
    }

    // Busca limite do plano
    const plan = subscription.plan
    let limit: number | null = null
    let currentCount = 0

    switch (resourceType) {
      case 'member':
        limit = plan.max_members
        if (limit !== null) {
          const result = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(members)
            .where(eq(members.organization_id, organizationId))
          currentCount = result[0]?.count || 0
        }
        break

      case 'unit':
        limit = plan.max_units
        if (limit !== null) {
          const result = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(units)
            .where(eq(units.organization_id, organizationId))
          currentCount = result[0]?.count || 0
        }
        break

      case 'demand':
        limit = plan.max_demands
        if (limit !== null) {
          // Conta demandas do mês atual
          const startOfMonth = new Date()
          startOfMonth.setDate(1)
          startOfMonth.setHours(0, 0, 0, 0)

          const { applicants } = await import('../db/schema/demands.ts')
          const result = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(demands)
            .innerJoin(applicants, eq(demands.applicant_id, applicants.id))
            .where(
              and(
                eq(applicants.organization_id, organizationId),
                sql`${demands.created_at} >= ${startOfMonth}`
              )
            )
          currentCount = result[0]?.count || 0
        }
        break
    }

    // null = ilimitado
    if (limit === null) {
      return { allowed: true }
    }

    // Verifica se atingiu limite
    if (currentCount >= limit) {
      return {
        allowed: false,
        reason: `Limite de ${resourceType}s atingido (${currentCount}/${limit})`,
        current: currentCount,
        limit,
      }
    }

    return {
      allowed: true,
      current: currentCount,
      limit,
    }
  }

  /**
   * Obtém estatísticas de uso para exibir no dashboard
   */
  async getUsageStats(organizationId: string) {
    // Busca organização
    const { organizations } = await import('../db/schema/organization.ts')
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    })

    if (!org || !org.stripe_customer_id) {
      return null
    }

    // Busca assinatura no Stripe
    const Stripe = (await import('stripe')).default
    const { env } = await import('../config/env.ts')
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    })

    // Busca assinaturas ativas do customer
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: 'active',
      expand: ['data.items.data.price'],
    })

    if (stripeSubscriptions.data.length === 0) {
      return null
    }

    const stripeSub = stripeSubscriptions.data[0]
    const priceId = stripeSub.items.data[0].price.id

    // Busca plano no banco pelo stripe_price_id
    const { plans } = await import('../db/schema/billings.ts')
    const allPlans = await db.query.plans.findMany()
    const plan = allPlans.find(p => p.stripe_price_id === priceId)

    // Calcula uso atual
    const usage = await this.calculateCurrentUsage(organizationId)

    // Se não encontrou o plano, retorna sem limites
    if (!plan) {
      return {
        plan_name: 'Plano Ativo',
        members: {
          current: usage.members_count,
          limit: null,
          percentage: 0,
        },
        units: {
          current: usage.units_count,
          limit: null,
          percentage: 0,
        },
        demands: {
          current: usage.demands_count,
          limit: null,
          percentage: 0,
        },
        storage: {
          current: parseFloat(usage.storage_used_gb),
          limit: null,
          percentage: 0,
        },
      }
    }

    // Retorna com os limites do plano
    return {
      plan_name: plan.name,
      members: {
        current: usage.members_count,
        limit: plan.max_members,
        percentage: plan.max_members
          ? Math.round((usage.members_count / plan.max_members) * 100)
          : 0,
      },
      units: {
        current: usage.units_count,
        limit: plan.max_units,
        percentage: plan.max_units
          ? Math.round((usage.units_count / plan.max_units) * 100)
          : 0,
      },
      demands: {
        current: usage.demands_count,
        limit: plan.max_demands,
        percentage: plan.max_demands
          ? Math.round((usage.demands_count / plan.max_demands) * 100)
          : 0,
      },
      storage: {
        current: parseFloat(usage.storage_used_gb),
        limit: plan.max_storage_gb,
        percentage: plan.max_storage_gb
          ? Math.round((parseFloat(usage.storage_used_gb) / plan.max_storage_gb) * 100)
          : 0,
      },
    }
  }
}

export const usageTrackingService = new UsageTrackingService()
