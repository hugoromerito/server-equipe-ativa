import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { tokens, users } from '../../../db/schema/index.ts'

export const resetPasswordRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/password/reset',
    {
      schema: {
        tags: ['auth'],
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

      const tokenFromCode = await db.query.tokens.findFirst({
        where: eq(tokens.id, code),
      })

      if (!tokenFromCode) {
        throw new Error('Token inválido ou expirado.')
      }

      const password_hash = await hash(password, 12)

      const [updatePassword] = await db
        .update(users)
        .set({ password_hash })
        .where(eq(users.id, tokenFromCode.user_id))
        .returning()

      if (!updatePassword) {
        throw new Error('Erro ao atualizar a senha.')
      }

      await db.delete(tokens).where(eq(tokens.id, code))

      return reply.status(204).send()
    }
  )
}
