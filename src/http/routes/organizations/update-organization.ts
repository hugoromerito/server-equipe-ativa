import { and, eq, not } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { organizationSchema } from '../../../db/auth/models/organization.ts'
import { db } from '../../../db/connection.ts'
import { organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const updateOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).put(
    '/organizations/:slug',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Organizations'],
        summary: 'Update organization details',
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string(),
          domain: z.string().nullable(),
          shouldAttachUsersByDomain: z.boolean().optional(),
        }),
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

      const { name, domain, shouldAttachUsersByDomain } = request.body

      const authOrganization = organizationSchema.parse(organization)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('update', authOrganization)) {
        throw new UnauthorizedError(
          'Você não possui permissão para atualizar essa organização.'
        )
      }

      if (domain) {
        const organizationByDomain = await db.query.organizations.findFirst({
          where: and(
            eq(organizations.domain, domain),
            not(eq(organizations.id, organization.id))
          ),
        })

        if (organizationByDomain) {
          throw new BadRequestError(
            'Another organization with same domain already exists.'
          )
        }
      }

      const [updateOrganization] = await db
        .update(organizations)
        .set({
          name,
          domain,
          should_attach_users_by_domain: shouldAttachUsersByDomain,
        })
        .where(eq(organizations.id, organization.id))
        .returning()

      if (!updateOrganization) {
        throw new BadRequestError('Não foi possível atualizar a organização.')
      }

      return reply.status(204).send()
    }
  )
}
