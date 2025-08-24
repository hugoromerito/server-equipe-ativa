import { and, eq, not } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { organizationSchema } from '../../../db/auth/models/organization.ts'
import { db } from '../../../db/connection.ts'
import { organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { ConflictError } from '../_errors/conflict-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { updateOperationResponses } from '../_errors/response-schemas.ts'

export const updateOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).put(
    '/organizations/:slug',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Organizations'],
        summary: 'Atualizar organização',
        description: 'Atualiza informações detalhadas da organização',
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          domain: z.string().nullable().optional(),
          shouldAttachUsersByDomain: z.boolean().optional(),
        }),
        params: z.object({
          slug: z.string(),
        }),
        response: updateOperationResponses(
          z.object({
            organization: z.object({
              id: z.string().uuid(),
              name: z.string(),
              slug: z.string(),
              domain: z.string().nullable(),
              shouldAttachUsersByDomain: z.boolean(),
            }),
          })
        ),
      },
    },
    async (request, reply) => {
      const { slug } = await request.params
      const userId = await request.getCurrentUserId()
      const { membership, organization } = await request.getUserMembership(slug)
      const { name, description, domain, shouldAttachUsersByDomain } = request.body

      const authOrganization = organizationSchema.parse(organization)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('update', authOrganization)) {
        throw new ForbiddenError(
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
          throw new ConflictError(
            'Another organization with same domain already exists.'
          )
        }
      }

      const [updateOrganization] = await db
        .update(organizations)
        .set({
          ...(name && { name }),
          ...(description && { description }),
          ...(domain && { domain }),
          ...(shouldAttachUsersByDomain !== undefined && { should_attach_users_by_domain: shouldAttachUsersByDomain }),
        })
        .where(eq(organizations.id, organization.id))
        .returning()

      if (!updateOrganization) {
        throw new BadRequestError('Não foi possível atualizar a organização.')
      }

      return reply.status(200).send({
        organization: {
          id: updateOrganization.id,
          name: updateOrganization.name,
          slug: updateOrganization.slug,
          domain: updateOrganization.domain,
          shouldAttachUsersByDomain: updateOrganization.should_attach_users_by_domain ?? false,
        },
      })
    }
  )
}
