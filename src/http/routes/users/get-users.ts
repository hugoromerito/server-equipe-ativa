import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { db } from '../../../db/connection.ts'
import { users } from '../../../db/schema/index.ts'
import { authPreHandler } from '../../middlewares/auth.ts'

export const getUsersRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/users',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Users'],
        summary: 'Get all users',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const results = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatar_url: users.avatar_url,
        })
        .from(users)
        .orderBy(users.created_at)

      return results
    }
  )
}
