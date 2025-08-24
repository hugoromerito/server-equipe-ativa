import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { invites, members, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'

export const acceptInviteRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/invites/:inviteId/accept',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Invites'],
        summary: 'Aceitar convite',
        description: 'Aceita um convite e adiciona o usuário à organização/unidade',
        security: [{ bearerAuth: [] }],
        params: z.object({
          inviteId: z.string().uuid(),
        }),
        response: withAuthErrorResponses({
          204: z.null(),
        }),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { inviteId } = request.params

      const invite = await db
        .select()
        .from(invites)
        .where(eq(invites.id, inviteId))
        .limit(1)

      if (!invite[0]) {
        throw new NotFoundError('Convite não encontrado ou expirado.')
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user[0]) {
        throw new NotFoundError('Usuário não encontrado.')
      }

      if (invite[0].email !== user[0].email) {
        throw new BadRequestError('Este convite pertence a outro usuário.')
      }

      // Verificar se já é membro
      const existingMembership = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.user_id, userId),
            eq(members.organization_id, invite[0].organization_id),
            invite[0].unit_id
              ? eq(members.unit_id, invite[0].unit_id)
              : isNull(members.unit_id)
          )
        )
        .limit(1)

      if (existingMembership[0]) {
        throw new BadRequestError('Você já é membro desta organização/unidade.')
      }

      await db.transaction(async (tx) => {
        await tx.insert(members).values({
          user_id: userId,
          organization_id: invite[0].organization_id,
          unit_id: invite[0].unit_id,
          organization_role: invite[0].role,
          unit_role: invite[0].unit_id ? invite[0].role : null,
        })

        await tx.delete(invites).where(eq(invites.id, inviteId))
      })

      return reply.status(204).send()
    }
  )
}
