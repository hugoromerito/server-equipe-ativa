import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { auth, authPreHandler } from '../../middlewares/auth.ts'

export const getOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Organizations'],
        summary: 'Obter detalhes da organização',
        description: 'Retorna informações detalhadas de uma organização específica',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            organization: z.object({
              name: z.string(),
              id: z.string(),
              slug: z.string(),
              domain: z.string().nullable(),
              shouldAttachUsersByDomain: z.boolean(),
              avatarUrl: z.url().nullable(),
              createdAt: z.date(),
              updatedAt: z.date(),
              ownerId: z.uuid(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { slug } = request.params
      const { organization } = await request.getUserMembership(slug)

      return {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          domain: organization.slug,
          shouldAttachUsersByDomain:
            organization.should_attach_users_by_domain ?? false,
          avatarUrl: organization.avatar_url,
          createdAt: organization.created_at,
          updatedAt: organization.updated_at ?? new Date(),
          ownerId: organization.owner_id,
        },
      }
    }
  )
}
