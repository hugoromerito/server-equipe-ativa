import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { organizationSchema } from '../../../db/auth/models/organization.ts'
import { db } from '../../../db/connection.ts'
import { organizations } from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const shutdownOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).delete(
    '/organizations/:slug',
    {
      schema: {
        tags: ['organizations'],
        summary: 'Shutdown organization',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          204: z.null(),
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
        throw new UnauthorizedError(
          'Você não possui permissão para encerrar essa organização.'
        )
      }

      await db
        .delete(organizations)
        .where(eq(organizations.id, organization.id))

      return reply.status(204).send()
    }
  )
}
