import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'

export const getProfileRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/profile',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Auth'],
        summary: 'Get profile',
        security: [
          {
            bearerAuth: [],
          },
        ],
        response: {
          200: z.object({
            user: z.object({
              id: z.uuid(),
              name: z.string().nullable(),
              email: z.email(),
              avatarUrl: z.url().nullable(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()

      const user = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatar_url,
        })
        .from(users)
        .where(eq(users.id, userId))
        .then((res) => res[0])

      if (!user) {
        throw new Error('Usuário não encontrado.')
      }

      return reply.send({ user })
    }
  )
}
