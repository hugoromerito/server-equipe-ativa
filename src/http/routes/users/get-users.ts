import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { db } from '../../../db/connection.ts'
import { schema } from '../../../db/schema/index.ts'

export const getUsersRoute: FastifyPluginCallbackZod = (app) => {
  app.get('/users', async () => {
    const results = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatar_url: schema.users.avatar_url,
      })
      .from(schema.users)
      .orderBy(schema.users.created_at)

    return results
  })
}
