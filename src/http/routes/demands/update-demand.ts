import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  demandStatusZodEnum,
  demands,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const updateDemandRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:organizationSlug/units/:unitSlug/demands/:demandSlug',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Update demand status and member',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
          demandSlug: z.string(),
        }),
        body: z.object({
          status: demandStatusZodEnum,
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug, demandSlug } = request.params
      const userId = await request.getCurrentUserId()
      const { status } = request.body
      const { membership } = await request.getUserMembership(
        organizationSlug,
        unitSlug
      )

      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role ?? membership.organization_role
      )

      if (cannot('update', 'Demand')) {
        throw new UnauthorizedError(
          'Você não possui permissão para atualizar esta demanda.'
        )
      }

      const unit = await db
        .select()
        .from(units)
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .where(
          and(
            eq(units.slug, unitSlug),
            eq(organizations.slug, organizationSlug)
          )
        )
        .limit(1)

      if (!unit[0]) {
        throw new BadRequestError('Unidade não encontrada na organização.')
      }

      const member = await db
        .select({
          id: members.id,
          userId: members.user_id,
          userName: users.name,
        })
        .from(members)
        .innerJoin(users, eq(members.user_id, users.id))
        .where(
          and(
            eq(members.user_id, userId),
            eq(members.unit_id, unit[0].units.id),
            eq(members.organization_id, unit[0].units.organization_id)
          )
        )
        .limit(1)

      if (!member[0]) {
        throw new BadRequestError('Membro da unidade não encontrado.')
      }

      await db
        .update(demands)
        .set({
          status,
          member_id: member[0].id,
          updated_by_member_name: member[0].userName ?? null,
        })
        .where(eq(demands.id, demandSlug))

      return reply.status(204).send()
    }
  )
}
