import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { users } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { getOperationResponses } from '../_errors/response-schemas.ts'

// Schema para resposta do perfil
const profileResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string().email(),
    avatarUrl: z.string().url().nullable(),
    createdAt: z.date(),
    updatedAt: z.date().nullable(),
  }),
})

export const getProfileRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/profile',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Auth'],
        summary: 'Obter perfil do usuário',
        description: 'Retorna as informações do perfil do usuário autenticado',
        security: [
          {
            bearerAuth: [],
          },
        ],
        response: getOperationResponses(profileResponseSchema),
      },
    },
    async (request, reply) => {
      const startTime = Date.now()
      
      try {
        const userId = await request.getCurrentUserId()
        
        logger.info(`Buscando perfil do usuário: ${userId}`)

        const user = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatar_url,
            createdAt: users.created_at,
            updatedAt: users.updated_at,
          })
          .from(users)
          .where(eq(users.id, userId))
          .then((res) => res[0])

        if (!user) {
          logger.warn(`Usuário não encontrado: ${userId}`)
          throw new NotFoundError('Usuário não encontrado.')
        }

        const duration = Date.now() - startTime
        logger.info(`Perfil encontrado para ${userId} em ${duration}ms`)

        return reply.status(200).send({ user })
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (error instanceof NotFoundError) {
          logger.warn(`Erro ao buscar perfil em ${duration}ms: ${error.message}`)
          throw error
        }
        
        logger.error(`Erro interno ao buscar perfil em ${duration}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }
  )
}
