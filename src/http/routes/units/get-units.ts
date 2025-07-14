import { and, eq, or } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { schema } from '../../../db/schema/index.ts'
import { members } from '../../../db/schema/modules/members.ts'
import { auth } from '../../middlewares/auth.ts'

export const getUnitsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationsSlug/units',
    {
      schema: {
        tags: ['units'],
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
          id: schema.organizations.id,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.slug, organizationsSlug))

      if (!organization) {
        return { units: [] }
      }

      const unitsResult = await db
        .select({
          id: schema.units.id,
          name: schema.units.name,
          slug: schema.units.slug,
          description: schema.units.description,
          location: schema.units.location,
          ownerId: schema.units.owner_id,
        })
        .from(schema.units)
        .leftJoin(
          members,
          and(eq(members.unit_id, schema.units.id), eq(members.user_id, userId))
        )
        .where(
          and(
            eq(schema.units.organization_id, organization.id),
            or(eq(schema.units.owner_id, userId), eq(members.user_id, userId))
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
