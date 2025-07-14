import { eq } from 'drizzle-orm'
// import { auth } from '@/http/middlewares/auth'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { schema } from '../../../db/schema/index.ts'
import { users } from '../../../db/schema/modules/users.ts'

export const requestPasswordRecoverRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/password/recover',
    {
      schema: {
        tags: ['auth'],
        summary: 'Request password recover.',
        body: z.object({
          email: z.email(),
        }),
        response: {
          201: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body

      const userFromEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
      })

      if (!userFromEmail) {
        return reply.status(201).send()
      }

      const [newToken] = await db
        .insert(schema.tokens)
        .values({
          type: 'PASSWORD_RECOVER',
          user_id: userFromEmail.id,
        })
        .returning()

      if (!newToken) {
        throw new Error('Token não criado.')
      }

      return reply.status(201).send()
    }
  )
}
