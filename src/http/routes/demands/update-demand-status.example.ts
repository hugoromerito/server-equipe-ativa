/**
 * 📚 EXEMPLO DE INTEGRAÇÃO COMPLETA
 * 
 * Este arquivo mostra como integrar:
 * 1. Validação de transições de status
 * 2. Verificação de permissões CASL
 * 3. Auditoria de mudanças
 * 
 * Em uma rota real de atualização de demand
 */

import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { demands, users } from '../../../db/schema/index.ts'
import { demandStatusZodEnum } from '../../../db/schema/enums.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { validateCompleteStatusTransition } from '../../../utils/demand-status-transitions.ts'
import { logDemandStatusChange } from '../../../utils/audit-logger.ts'

/**
 * Rota para atualizar o status de uma demand
 * 
 * Integra:
 * - Validação de permissões (CASL)
 * - Validação de transições de status
 * - Auditoria automática
 * 
 * @route PATCH /organizations/:slug/units/:unitSlug/demands/:demandId/status
 */
export const updateDemandStatusRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:slug/units/:unitSlug/demands/:demandId/status',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Atualizar status de uma demand',
        description:
          'Atualiza o status de uma demand com validação de permissões e auditoria automática. ' +
          'Apenas transições válidas são permitidas conforme a role do usuário.',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string().describe('Slug da organização'),
          unitSlug: z.string().describe('Slug da unidade'),
          demandId: z.string().uuid().describe('ID da demand'),
        }),
        body: z.object({
          status: demandStatusZodEnum.describe('Novo status da demand'),
          reason: z
            .string()
            .optional()
            .describe('Motivo da mudança de status (opcional)'),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            demand: z.object({
              id: z.string(),
              status: demandStatusZodEnum,
              updated_at: z.date().nullable(),
            }),
            audit: z.object({
              id: z.string(),
              changed_by: z.string().nullable(),
              changed_at: z.date(),
            }),
          }),
          400: z.object({
            message: z.string(),
          }),
          403: z.object({
            message: z.string(),
          }),
          404: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { slug, unitSlug, demandId } = request.params
      const { status: newStatus, reason } = request.body
      const userId = await request.getCurrentUserId()

      // 1. Verifica membership e permissões básicas
      const { membership } = await request.getUserMembership(slug, unitSlug)
      const userRole = membership.unit_role || membership.organization_role

      const { cannot } = getUserPermissions(userId, userRole)

      // Verifica se tem permissão básica para atualizar demands
      if (cannot('update', 'Demand')) {
        throw new ForbiddenError(
          'Você não tem permissão para atualizar demands.'
        )
      }

      // 2. Busca a demand atual
      const [demand] = await db
        .select({
          id: demands.id,
          status: demands.status,
          member_id: demands.member_id,
          unit_id: demands.unit_id,
          applicant_id: demands.applicant_id,
        })
        .from(demands)
        .where(
          and(
            eq(demands.id, demandId),
            eq(demands.unit_id, membership.unit_id ?? '')
          )
        )
        .limit(1)

      if (!demand) {
        throw new NotFoundError('Demand não encontrada.')
      }

      const previousStatus = demand.status

      // 3. Validação especial para ANALYST (médico)
      // Médico só pode atualizar demands atribuídas a ele
      if (userRole === 'ANALYST') {
        if (!demand.member_id || demand.member_id !== membership.id) {
          throw new ForbiddenError(
            'Você só pode atualizar demands atribuídas a você.'
          )
        }
      }

      // 4. Valida a transição de status (validação + permissões)
      try {
        validateCompleteStatusTransition(userRole, previousStatus, newStatus)
      } catch (error) {
        // Retorna erro específico de validação
        throw new BadRequestError(
          error instanceof Error ? error.message : 'Transição de status inválida'
        )
      }

      // 5. Busca informações do usuário para auditoria
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user) {
        throw new Error('Usuário não encontrado')
      }

      // 6. Atualiza o status da demand
      const [updatedDemand] = await db
        .update(demands)
        .set({
          status: newStatus,
          updated_at: new Date(),
          updated_by_member_name: user.name,
        })
        .where(eq(demands.id, demandId))
        .returning({
          id: demands.id,
          status: demands.status,
          updated_at: demands.updated_at,
        })

      // 7. Registra auditoria
      const auditLog = await logDemandStatusChange({
        demandId,
        previousStatus,
        newStatus,
        changedByUserId: userId,
        changedByMemberId: membership.id ?? null,
        changedByUserName: user.name,
        changedByRole: userRole,
        reason,
        metadata: {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          unitId: membership.unit_id ?? undefined,
          organizationId: membership.organization_id,
        },
      })

      // 8. Retorna sucesso com informações
      return reply.status(200).send({
        success: true,
        demand: updatedDemand,
        audit: {
          id: auditLog!.id,
          changed_by: user.name ?? null,
          changed_at: auditLog!.changed_at,
        },
      })
    }
  )
}

/**
 * 📋 CHECKLIST DE VALIDAÇÕES IMPLEMENTADAS:
 * 
 * ✅ 1. Verifica se usuário está autenticado (authPreHandler)
 * ✅ 2. Verifica membership da organização/unidade
 * ✅ 3. Verifica permissão básica de atualizar demands (CASL)
 * ✅ 4. Verifica se demand existe na unidade
 * ✅ 5. Para ANALYST: verifica se demand está atribuída a ele
 * ✅ 6. Valida se a transição de status é permitida pelo fluxo
 * ✅ 7. Valida se a role tem permissão para essa transição específica
 * ✅ 8. Registra auditoria com metadados completos
 * 
 * 🎯 BENEFÍCIOS:
 * - Segurança: múltiplas camadas de validação
 * - Rastreabilidade: auditoria completa de mudanças
 * - Clareza: mensagens de erro específicas para cada caso
 * - Manutenibilidade: lógica separada em funções reutilizáveis
 */
