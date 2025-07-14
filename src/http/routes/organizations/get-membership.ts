import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { roleEnum } from '../../../db/schema/enums/role.ts'
import { auth } from '../../middlewares/auth.ts'

export const getMembershipRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/membership',
    {
      schema: {
        tags: ['organizations'],
        summary: 'Get user membership on organization',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            membership: z.object({
              id: z.uuid(),
              userId: z.uuid(),
              role: roleEnum,
              organizationId: z.uuid(),
              // unitId: z.string().uuid().nullable(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { slug } = request.params
      const { membership } = await request.getUserMembership(slug)

      return {
        membership: {
          id: membership.id,
          role: roleEnum.parse(membership.role),
          organizationId: membership.organization_id,
          userId: membership.user_id,
          // unitId: membership.unitId,
        },
      }
    }
  )
}
