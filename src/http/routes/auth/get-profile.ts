import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { schema } from '../../../db/schema/index.ts'
import { users } from '../../../db/schema/modules/users.ts'
import { auth } from '../../middlewares/auth.ts'

export const getProfileRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/profile',
    {
      schema: {
        tags: ['auth'],
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
      // biome-ignore lint/suspicious/noConsole: teste
      console.log('[ROTA /profile] userId retornado:')

      const user = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          avatarUrl: schema.users.avatar_url,
        })
        .from(schema.users)
        .where(eq(users.id, userId))
        .then((res) => res[0])

      if (!user) {
        throw new Error('Usuário não encontrado.')
      }

      return reply.send({ user })
    }
  )
}
