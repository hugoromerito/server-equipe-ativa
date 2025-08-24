import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  demandStatusZodEnum,
  demandPriorityZodEnum,
  demands,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const updateDemandRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:organizationSlug/units/:unitSlug/demands/:demandId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Atualizar demanda',
        description: 'Atualiza status da demanda e membro responsável',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
          demandId: z.string(), // Aceita UUID
        }),
        body: z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          priority: demandPriorityZodEnum.optional(),
          status: demandStatusZodEnum.optional(),
        }),
        response: {
          200: z.object({
            demand: z.object({
              id: z.string(),
              title: z.string(),
              description: z.string(),
              priority: demandPriorityZodEnum,
              status: demandStatusZodEnum,
              updatedAt: z.date().nullable(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug, demandId } = request.params
      const userId = await request.getCurrentUserId()
      const updateData = request.body
      const { membership } = await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role ?? membership.organization_role
      )

      if (cannot('update', 'Demand')) {
        throw new UnauthorizedError(
          'Você não possui permissão para atualizar esta demanda.'
        )
      }

      // Verificar se a demanda existe e pertence à organização
      const [demand] = await db
        .select({
          id: demands.id,
          title: demands.title,
          description: demands.description,
          priority: demands.priority,
          status: demands.status,
          updated_at: demands.updated_at,
        })
        .from(demands)
        .innerJoin(units, eq(demands.unit_id, units.id))
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .where(
          and(
            eq(demands.id, demandId),
            eq(units.slug, unitSlug),
            eq(organizations.slug, organizationSlug)
          )
        )

      if (!demand) {
        throw new NotFoundError('Demanda não encontrada.')
      }

      // Atualizar a demanda
      const [updatedDemand] = await db
        .update(demands)
        .set({
          ...updateData,
          updated_at: new Date(),
        })
        .where(eq(demands.id, demandId))
        .returning()

      if (!updatedDemand) {
        throw new NotFoundError('Demanda não encontrada.')
      }

      return reply.send({
        demand: {
          id: updatedDemand.id,
          title: updatedDemand.title,
          description: updatedDemand.description,
          priority: updatedDemand.priority,
          status: updatedDemand.status,
          updatedAt: updatedDemand.updated_at || null,
        },
      })
    }
  )
}
