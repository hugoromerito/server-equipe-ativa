import { sql, gte } from 'drizzle-orm'
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

    // Conta applicants (solicitantes) da organização
    const { applicants } = await import('../db/schema/demands.ts')
    const applicantsResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(applicants)
      .where(eq(applicants.organization_id, organizationId))
    const applicantsCount = applicantsResult[0]?.count || 0

    // TODO: Calcular storage usado (soma de attachments)
    const storageUsedGB = 0

    return {
      members_count: membersCount,
      units_count: unitsCount,
      applicants_count: applicantsCount,
      storage_used_gb: storageUsedGB.toFixed(2),
    }
  }

  /**
   * Verifica se organização pode criar recurso (verificação em tempo real)
   * Busca limites diretamente do Stripe
   */
  async canCreateResource(
    organizationId: string,
    resourceType: 'member' | 'unit' | 'applicant'
  ): Promise<{
    allowed: boolean
    reason?: string
    current?: number
    limit?: number
  }> {
    // Busca organização com stripe_customer_id
    const { organizations } = await import('../db/schema/organization.ts')
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    })

    if (!org || !org.stripe_customer_id) {
      return {
        allowed: false,
        reason: 'Nenhuma assinatura ativa',
      }
    }

    // Busca assinatura no Stripe
    const Stripe = (await import('stripe')).default
    const { env } = await import('../config/env.ts')
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    })

    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: 'active',
      expand: ['data.items.data.price'],
    })

    if (stripeSubscriptions.data.length === 0) {
      return {
        allowed: false,
        reason: 'Nenhuma assinatura ativa',
      }
    }

    const stripeSub = stripeSubscriptions.data[0]
    const price = stripeSub.items.data[0].price
    const productId = typeof price.product === 'string' ? price.product : price.product.id
    const product = await stripe.products.retrieve(productId)

    const metadata = product.metadata || {}
    let limit: number | null = null
    let currentCount = 0

    switch (resourceType) {
      case 'member':
        limit = metadata.max_members ? parseInt(metadata.max_members) : null
        if (limit !== null) {
          const result = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(members)
            .where(eq(members.organization_id, organizationId))
          currentCount = result[0]?.count || 0
        }
        break

      case 'unit':
        limit = metadata.max_units ? parseInt(metadata.max_units) : null
        if (limit !== null) {
          const result = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(units)
            .where(eq(units.organization_id, organizationId))
          currentCount = result[0]?.count || 0
        }
        break

      case 'applicant':
        limit = metadata.max_applicants ? parseInt(metadata.max_applicants) : null
        if (limit !== null) {
          const { applicants } = await import('../db/schema/demands.ts')
          const result = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(applicants)
            .where(eq(applicants.organization_id, organizationId))
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
    const price = stripeSub.items.data[0].price
    
    // Busca o produto separadamente (não pode expandir 4 níveis)
    const productId = typeof price.product === 'string' ? price.product : price.product.id
    const product = await stripe.products.retrieve(productId)

    // Extrai limites do metadata do produto
    const metadata = product.metadata || {}
    const productName = product.name
    const max_members = metadata.max_members ? parseInt(metadata.max_members) : null
    const max_units = metadata.max_units ? parseInt(metadata.max_units) : null
    const max_applicants = metadata.max_applicants ? parseInt(metadata.max_applicants) : null
    const max_storage_gb = metadata.max_storage_gb ? parseInt(metadata.max_storage_gb) : null

    // Calcula uso atual
    const usage = await this.calculateCurrentUsage(organizationId)

    // Retorna com os limites do Stripe metadata
    return {
      plan_name: productName,
      members: {
        current: usage.members_count,
        limit: max_members,
        percentage: max_members
          ? Math.round((usage.members_count / max_members) * 100)
          : 0,
      },
      units: {
        current: usage.units_count,
        limit: max_units,
        percentage: max_units
          ? Math.round((usage.units_count / max_units) * 100)
          : 0,
      },
      applicants: {
        current: usage.applicants_count,
        limit: max_applicants,
        percentage: max_applicants
          ? Math.round((usage.applicants_count / max_applicants) * 100)
          : 0,
      },
      storage: {
        current: parseFloat(usage.storage_used_gb),
        limit: max_storage_gb,
        percentage: max_storage_gb
          ? Math.round((parseFloat(usage.storage_used_gb) / max_storage_gb) * 100)
          : 0,
      },
    }
  }
}

export const usageTrackingService = new UsageTrackingService()
