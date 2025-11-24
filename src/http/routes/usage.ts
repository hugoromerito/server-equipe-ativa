import type { FastifyInstance } from 'fastify'
import { authPreHandler } from '../middlewares/auth.ts'

/**
 * Rotas de uso e estatísticas de assinatura
 */
export async function usageRoutes(app: FastifyInstance) {
  const { usageTrackingService } = await import('../../services/usage-tracking.ts')
  
  /**
   * Obtém estatísticas de uso da organização
   */
  app.get('/organizations/:organizationId/usage', {
    preHandler: [authPreHandler],
  }, async (request, reply) => {
    const { organizationId } = request.params as { organizationId: string }

    const stats = await usageTrackingService.getUsageStats(organizationId)

    if (!stats) {
      return reply.code(404).send({
        message: 'Organização não possui assinatura ativa',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      })
    }

    return reply.send(stats)
  })

  /**
   * Força atualização do registro de uso (admin)
   * Útil para testes ou correções manuais
   */
  app.post('/admin/subscriptions/:subscriptionId/update-usage', {
    preHandler: [authPreHandler],
  }, async (request, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string }

    try {
      const record = await usageTrackingService.updateUsageRecord(subscriptionId)
      return reply.send({
        message: 'Uso atualizado com sucesso',
        record,
      })
    } catch (error) {
      return reply.code(500).send({
        message: error instanceof Error ? error.message : 'Erro ao atualizar uso',
      })
    }
  })

  /**
   * Verifica se pode criar recurso (útil para UI mostrar aviso antes)
   */
  app.get('/organizations/:organizationId/can-create/:resourceType', {
    preHandler: [authPreHandler],
  }, async (request, reply) => {
    const { organizationId, resourceType } = request.params as {
      organizationId: string
      resourceType: 'member' | 'unit' | 'demand'
    }

    const result = await usageTrackingService.canCreateResource(organizationId, resourceType)

    return reply.send(result)
  })
}
