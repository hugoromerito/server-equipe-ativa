import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, units } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { createSlug } from '../../utils/create-slug.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const createUnitRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/units',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Units'],
        summary: 'Create a new unit from organization.',
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string(),
          description: z.string().nullable(),
          location: z.string(),
        }),
        params: z.object({
          organizationSlug: z.string(),
        }),
        response: {
          201: z.object({
            unitId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()

      const { organizationSlug } = request.params

      const { organization, membership } =
        await request.getUserMembership(organizationSlug)

      const { name, description, location } = request.body

      if (!organization) {
        throw new BadRequestError('Organização não encontrada')
      }

      // Verifica se o usuário tem permissão ADMIN
      if (membership.organization_role !== 'ADMIN') {
        throw new BadRequestError('Apenas administradores podem criar unidades')
      }

      const unitSlug = createSlug(name)

      const existing = await db.query.units.findFirst({
        where: and(
          eq(units.slug, unitSlug),
          eq(units.organization_id, organization.id)
        ),
      })

      if (existing) {
        throw new BadRequestError(
          'Já existe uma unidade com o mesmo nome na organização.'
        )
      }

      const [newUnit] = await db
        .insert(units)
        .values({
          name,
          slug: unitSlug,
          description,
          location,
          organization_id: organization.id,
          owner_id: userId,
        })
        .returning()

      if (!newUnit) {
        throw new BadRequestError('Erro ao criar unidade.')
      }

      await db.insert(members).values({
        unit_id: newUnit.id,
        organization_id: organization.id,
        user_id: userId,
        organization_role: membership.organization_role,
        unit_role: 'ADMIN',
      })

      return reply.status(201).send({
        unitId: newUnit.id,
      })
    }
  )
}
