import { and, eq, or } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, units } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'

export const getUnitsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Units'],
        summary: 'Listar unidades do usuário',
        description: 'Retorna unidades onde o usuário é proprietário ou membro',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
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
          400: z.object({
            error: z.string(),
            code: z.string(),
            message: z.string(),
          }),
          403: z.object({
            error: z.string(),
            code: z.string(),
            message: z.string(),
          }),
          404: z.object({
            error: z.string(),
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { organizationSlug } = request.params

      const { organization, membership } =
        await request.getUserMembership(organizationSlug)

      if (!organization) {
        return reply.status(404).send({
          error: 'Not Found',
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organização não encontrada',
        })
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

      return reply.status(200).send({ units: unitsWithUserRole })
    }
  )
}
