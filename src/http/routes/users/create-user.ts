import { hash } from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, organizations, users } from '../../../db/schema/index.ts'

// import { BadRequestError } from '../_errors/bad-request-error'

export const createUserRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/users',
    {
      schema: {
        tags: ['users'],
        summary: 'Create a new user',
        body: z.object({
          name: z.string().min(1),
          email: z.email(),
          password: z.string().min(8),
        }),
      },
    },
    async (request, reply) => {
      const { name, email, password } = request.body

      const userWithSameEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
      })

      if (userWithSameEmail) {
        throw new Error('Já existe um usuário com o mesmo e-mail.')
      }

      const [, domain] = email.split('@')

      const autoJoinOrganization = await db.query.organizations.findFirst({
        where: and(
          eq(organizations.domain, domain),
          eq(organizations.should_attach_users_by_domain, true)
        ),
      })

      const password_hash = await hash(password, 12)

      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          password_hash,
        })
        .returning()

      if (autoJoinOrganization) {
        await db.insert(members).values({
          user_id: newUser.id,
          organization_id: autoJoinOrganization.id,
        })
      }

      if (!newUser) {
        throw new Error('Failed to create new user.')
      }

      return reply.status(201).send({ message: 'Usuário criado.' })
    }
  )
}
