import { and, eq, or } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, organizations, units } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'

export const getUnitsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationsSlug/units',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Units'],
        summary: 'Get units where user is owner or member',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationsSlug: z.string(),
        }),
        response: {
          200: z.object({
            units: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                description: z.string().nullable(),
                location: z.string(),
                isOwner: z.boolean(),
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { organizationsSlug } = request.params

      const [organization] = await db
        .select({
          id: organizations.id,
        })
        .from(organizations)
        .where(eq(organizations.slug, organizationsSlug))

      if (!organization) {
        return { units: [] }
      }

      const unitsResult = await db
        .select({
          id: units.id,
          name: units.name,
          slug: units.slug,
          description: units.description,
          location: units.location,
          ownerId: units.owner_id,
        })
        .from(units)
        .leftJoin(
          members,
          and(eq(members.unit_id, units.id), eq(members.user_id, userId))
        )
        .where(
          and(
            eq(units.organization_id, organization.id),
            or(eq(units.owner_id, userId), eq(members.user_id, userId))
          )
        )

      const unitsWithUserRole = unitsResult.map(({ ownerId, ...unit }) => ({
        ...unit,
        isOwner: ownerId === userId,
      }))

      return { units: unitsWithUserRole }
    }
  )
}
