import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { users } from '../../../db/schema/index.ts'

export const authenticateWithPasswordRoute: FastifyPluginCallbackZod = (
  app
) => {
  app.post(
    '/sessions/password',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Autenticar com e-mail e senha',
        description:
          'Realiza autenticação do usuário com e-mail e senha, retornando um token JWT',
        body: z.object({
          email: z.email('E-mail deve ter um formato válido.'),
          password: z
            .string()
            .min(8, 'Senha deve ter pelo menos 8 caracteres.'),
        }),
        response: {
          201: z.object({
            token: z.string().describe('Token JWT para autenticação.'),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body

      const userFromEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
      })

      if (!userFromEmail) {
        throw new Error('E-mail ou senha inválidos.')
      }

      if (userFromEmail.password_hash === null) {
        throw new Error('O usuário não possui uma senha, use o login social.')
      }

      const isPasswordValid = await compare(
        password,
        userFromEmail.password_hash
      )

      if (!isPasswordValid) {
        throw new Error('Credenciais inválidas.')
      }

      const token = await reply.jwtSign(
        {
          sub: userFromEmail.id,
        },
        {
          sign: {
            expiresIn: '7d',
          },
        }
      )

      return reply.status(201).send({ token })
    }
  )
}
