import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { tokens, users } from '../../../db/schema/index.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const resetPasswordRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/password/reset',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Reset password.',
        body: z.object({
          code: z.string(),
          password: z.string().min(8),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { code, password } = request.body

      // Validar se o code é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(code)) {
        throw new BadRequestError('Token inválido ou expirado.')
      }

      const tokenFromCode = await db.query.tokens.findFirst({
        where: eq(tokens.id, code),
      })

      if (!tokenFromCode) {
        throw new BadRequestError('Token inválido ou expirado.')
      }

      const password_hash = await hash(password, 12)

      const [updatePassword] = await db
        .update(users)
        .set({ password_hash })
        .where(eq(users.id, tokenFromCode.user_id))
        .returning()

      if (!updatePassword) {
        throw new BadRequestError('Erro ao atualizar a senha.')
      }

      await db.delete(tokens).where(eq(tokens.id, code))

      return reply.status(204).send()
    }
  )
}
