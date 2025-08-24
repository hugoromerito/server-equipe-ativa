import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { roleZodEnum } from '../../../db/schema/enums.ts'
import { members, organizations } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'
import { createOperationResponses } from '../_errors/response-schemas.ts'

// Schema para resposta de sucesso
const getOrganizationsResponseSchema = z.object({
  organizations: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      avatarUrl: z.string().url().nullable(),
      orgRole: roleZodEnum,
    })
  ),
})

export const getOrganizationsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Organizations'],
        summary: 'Listar organizações do usuário',
        description: 'Retorna todas as organizações em que o usuário autenticado é membro',
        security: [{ bearerAuth: [] }],
        response: createOperationResponses(getOrganizationsResponseSchema),
      },
    },
    async (request) => {
      const startTime = Date.now()
      const userId = await request.getCurrentUserId()

      try {
        logger.info(`Buscando organizações para usuário: ${userId}`)

        // Buscar todas as organizações em que o usuário é membro
        const organizationsResult = await db
          .selectDistinct({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            avatarUrl: organizations.avatar_url,
            orgRole: members.organization_role,
          })
          .from(organizations)
          .innerJoin(
            members,
            and(
              eq(members.organization_id, organizations.id),
              eq(members.user_id, userId)
            )
          )

        // Mapear resultado para o formato da resposta
        const organizationsWithUserRole = organizationsResult.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          avatarUrl: org.avatarUrl,
          orgRole: org.orgRole,
        }))

        const duration = Date.now() - startTime
        logger.info(`Encontradas ${organizationsWithUserRole.length} organizações para usuário ${userId} em ${duration}ms`)

        return { organizations: organizationsWithUserRole }
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error(`Erro ao buscar organizações do usuário em ${duration}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId,
        })
        throw new InternalServerError('Erro interno ao buscar organizações.')
      }
    }
  )
}
