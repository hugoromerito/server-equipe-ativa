import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { organizationSchema } from '../../../db/auth/models/organization.ts'
import { db } from '../../../db/connection.ts'
import { organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { deleteOperationResponses } from '../_errors/response-schemas.ts'

export const shutdownOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).delete(
    '/organizations/:slug',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Organizations'],
        summary: 'Shutdown organization',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { slug } = await request.params
      const userId = await request.getCurrentUserId()
      const { membership, organization } = await request.getUserMembership(slug)

      const authOrganization = organizationSchema.parse({
        id: organization.id,
        ownerId: organization.owner_id,
      })

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('delete', authOrganization)) {
        throw new ForbiddenError(
          'Você não possui permissão para encerrar essa organização.'
        )
      }

      await db
        .delete(organizations)
        .where(eq(organizations.id, organization.id))

      return reply.status(200).send()
    }
  )
}
