import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { workingDaysSchema } from '../../schemas/members.ts'

export const updateMemberWorkingDaysRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:slug/members/:memberId/working-days',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Atualizar dias de trabalho do membro',
        description:
          'Atualiza os dias da semana em que o membro trabalha (0=Domingo, 1=Segunda, ..., 6=Sábado)',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          memberId: z.string().uuid(),
        }),
        body: z.object({
          workingDays: workingDaysSchema,
        }),
        response: withAuthErrorResponses({
          204: z.null(),
        }),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { slug, memberId } = request.params
      const { workingDays } = request.body

      // Verificar permissões
      const { membership } = await request.getUserMembership(slug)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('update', 'User')) {
        throw new BadRequestError(
          'Você não tem permissão para atualizar membros.'
        )
      }

      const [member] = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.id, memberId),
            eq(members.organization_id, membership.organization_id)
          )
        )
        .limit(1)

      if (!member) {
        throw new NotFoundError('Membro não encontrado.')
      }

      await db
        .update(members)
        .set({
          working_days: workingDays || null,
        })
        .where(eq(members.id, memberId))

      return reply.status(204).send()
    }
  )
}
