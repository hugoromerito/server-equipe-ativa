import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { tokens, users } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'
import { createOperationResponses } from '../_errors/response-schemas.ts'

// Schema para validação do corpo da requisição
const requestPasswordRecoverBodySchema = z.object({
  email: z
    .string()
    .email('E-mail deve ter um formato válido.')
    .toLowerCase()
    .trim(),
})

export const requestPasswordRecoverRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/password/recover',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Solicitar recuperação de senha',
        description: 'Inicia o processo de recuperação de senha enviando um token por e-mail. Por motivos de segurança, sempre retorna sucesso.',
        body: requestPasswordRecoverBodySchema,
        response: createOperationResponses(z.null()),
      },
    },
    async (request, reply) => {
      const startTime = Date.now()
      const { email } = request.body

      try {
        logger.info(`Solicitação de recuperação de senha para: ${email}`)

        // Buscar usuário por e-mail
        const userFromEmail = await db.query.users.findFirst({
          where: eq(users.email, email),
          columns: {
            id: true,
            email: true,
            name: true,
          },
        })

        // Por motivos de segurança, sempre retorna sucesso mesmo se o e-mail não existir
        if (!userFromEmail) {
          logger.info(`Tentativa de recuperação para e-mail inexistente: ${email}`)
          const duration = Date.now() - startTime
          logger.info(`Resposta de segurança enviada em ${duration}ms`)
          return reply.status(201).send()
        }

        // Criar token de recuperação
        const [newToken] = await db
          .insert(tokens)
          .values({
            type: 'PASSWORD_RECOVER',
            user_id: userFromEmail.id,
          })
          .returning()

        if (!newToken) {
          logger.error('Falha ao criar token de recuperação de senha')
          throw new InternalServerError('Erro interno ao processar solicitação.')
        }

        const duration = Date.now() - startTime
        logger.info(`Token de recuperação criado para ${email} em ${duration}ms`, {
          tokenId: newToken.id,
          userId: userFromEmail.id,
        })

        // TODO: Enviar e-mail com token de recuperação
        // await emailService.sendPasswordRecoveryEmail(email, newToken.id)

        return reply.status(201).send()
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (error instanceof InternalServerError) {
          logger.warn(`Erro ao processar recuperação de senha em ${duration}ms: ${error.message}`)
          throw error
        }
        
        logger.error(`Erro interno na recuperação de senha em ${duration}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          email,
        })
        throw new InternalServerError('Erro interno ao processar solicitação.')
      }
    }
  )
}
