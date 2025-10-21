import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { roleZodEnum } from '../../../db/schema/enums.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { getOperationResponses } from '../_errors/response-schemas.ts'

export const getMembershipRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/membership',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Organizations'],
        summary: 'Obter membership do usuário',
        description: 'Retorna informações sobre o membership do usuário na organização',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: getOperationResponses(
          z.object({
            membership: z.object({
              id: z.uuid(),
              userId: z.uuid(),
              organization_role: roleZodEnum,
              organizationId: z.uuid(),
            }),
          })
        ),
      },
    },
    async (request, reply) => {
      const { slug } = request.params
      
      try {
        const { membership } = await request.getUserMembership(slug)

        const response = {
          membership: {
            id: membership.id,
            organization_role: membership.organization_role,
            organizationId: membership.organization_id,
            userId: membership.user_id,
          },
        }

        return response
      } catch (error) {
        request.log.error({
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          slug,
        }, 'Erro ao obter membership')
        throw error
      }
    }
  )
}
