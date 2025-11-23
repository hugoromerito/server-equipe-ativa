import type { FastifyReply, FastifyRequest } from 'fastify'
import { billingService } from '../../services/billing.ts'

/**
 * Middleware para verificar se a organização tem uma assinatura ativa
 */
export async function requireActiveSubscription(
  request: FastifyRequest<{ Params: { organizationId: string } }>,
  reply: FastifyReply
) {
  const { organizationId } = request.params

  if (!organizationId) {
    return reply.status(400).send({
      message: 'ID da organização é obrigatório',
    })
  }

  const subscription = await billingService.getActiveSubscription(organizationId)

  if (!subscription) {
    return reply.status(403).send({
      message: 'Organização não possui assinatura ativa',
      code: 'NO_ACTIVE_SUBSCRIPTION',
    })
  }

  // Verifica se a assinatura não expirou
  const now = new Date()
  if (subscription.current_period_end < now && subscription.status !== 'trialing') {
    return reply.status(403).send({
      message: 'Assinatura expirada',
      code: 'SUBSCRIPTION_EXPIRED',
    })
  }

  // Adiciona informações da assinatura ao request para uso posterior
  ;(request as any).subscription = subscription
}

/**
 * Middleware para verificar limites de recursos do plano
 */
export function checkResourceLimit(resourceType: 'member' | 'unit' | 'demand') {
  return async (
    request: FastifyRequest<{ Params: { organizationId: string } }>,
    reply: FastifyReply
  ) => {
    const { organizationId } = request.params

    if (!organizationId) {
      return reply.status(400).send({
        message: 'ID da organização é obrigatório',
      })
    }

    const result = await billingService.canCreateResource(organizationId, resourceType)

    if (!result.allowed) {
      return reply.status(403).send({
        message: result.reason || 'Limite do plano atingido',
        code: 'RESOURCE_LIMIT_EXCEEDED',
        resource_type: resourceType,
      })
    }
  }
}

/**
 * Middleware para verificar limite de armazenamento
 */
export async function checkStorageLimit(
  request: FastifyRequest<{ 
    Params: { organizationId: string }
    Body: { file_size?: number }
  }>,
  reply: FastifyReply
) {
  const { organizationId } = request.params
  const fileSize = request.body?.file_size || 0

  if (!organizationId) {
    return reply.status(400).send({
      message: 'ID da organização é obrigatório',
    })
  }

  const subscription = await billingService.getActiveSubscription(organizationId)

  if (!subscription) {
    return reply.status(403).send({
      message: 'Organização não possui assinatura ativa',
      code: 'NO_ACTIVE_SUBSCRIPTION',
    })
  }

  const usage = await billingService.getCurrentUsage(subscription.id)

  // Se o plano tem limite de armazenamento
  if (usage.limits.max_storage_gb && usage.usage) {
    const currentStorageGB = parseFloat(usage.usage.storage_used_gb)
    const fileSizeGB = fileSize / (1024 * 1024 * 1024)
    const maxStorageGB = usage.limits.max_storage_gb

    if (currentStorageGB + fileSizeGB > maxStorageGB) {
      return reply.status(403).send({
        message: 'Limite de armazenamento do plano atingido',
        code: 'STORAGE_LIMIT_EXCEEDED',
        current_usage: currentStorageGB,
        limit: maxStorageGB,
      })
    }
  }
}

/**
 * Função helper para verificar se organização pode criar recurso
 * Útil para usar em lógica de negócio sem middleware
 */
export async function canCreateResource(
  organizationId: string,
  resourceType: 'member' | 'unit' | 'demand'
): Promise<{ allowed: boolean; reason?: string }> {
  return await billingService.canCreateResource(organizationId, resourceType)
}
