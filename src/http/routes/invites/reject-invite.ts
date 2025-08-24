import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { invites, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'

export const rejectInviteRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/invites/:inviteId/reject',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Invites'],
        summary: 'Rejeitar convite',
        description: 'Rejeita um convite recebido pelo usuário',
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

      await db.delete(invites).where(eq(invites.id, invite[0].id))

      return reply.status(204).send()
    }
  )
}
