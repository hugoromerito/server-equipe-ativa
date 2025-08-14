import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { invites, members, users } from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const acceptInviteRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/invites/:inviteId/accept',
    {
      schema: {
        tags: ['invites'],
        summary: 'Accept an invite',
        security: [{ bearerAuth: [] }],
        params: z.object({
          inviteId: z.uuid(),
        }),
        response: {
          204: z.null(),
        },
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
        throw new BadRequestError('Convite não encontrado ou expirado.')
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user[0]) {
        throw new BadRequestError('Usuário não encontrado.')
      }

      if (invite[0].email !== user[0].email) {
        throw new BadRequestError('Este convite pertence a outro usuário.')
      }

      await db.transaction(async (tx) => {
        await tx.insert(members).values({
          user_id: userId,
          organization_id: invite[0].organization_id,
          unit_id: invite[0].unit_id,
          organization_role: invite[0].role,
          unit_role: invite[0].role,
        })

        await tx.delete(invites).where(eq(invites.id, inviteId))
      })

      return reply.status(204).send()
    }
  )
}
