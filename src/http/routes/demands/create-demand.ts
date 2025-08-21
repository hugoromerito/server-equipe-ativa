import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import type {
  DemandCategoryType,
  DemandPriorityType,
} from '../../../db/schema/enums.ts'
import {
  applicants,
  demands,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { classifyDemandAi } from '../../utils/classify-demand-ai.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const createDemandRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/units/:unitSlug/applicants/:applicantSlug/demands',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Cria uma nova demanda para uma unidade',
        security: [{ bearerAuth: [] }],
        body: z.object({
          title: z.string(),
          description: z.string(),
          zip_code: z.string().nullable(),
          state: z.string().nullable(),
          city: z.string().nullable(),
          street: z.string().nullable(),
          neighborhood: z.string().nullable(),
          complement: z.string().nullable(),
          number: z.string().nullable(),
        }),
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
          applicantSlug: z.string(),
        }),
        response: {
          201: z.object({
            demandId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug, applicantSlug } = request.params
      const userId = await request.getCurrentUserId()

      // Buscar organização primeiro
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1)

      if (!org) {
        throw new BadRequestError('Organização não encontrada')
      }

      // Buscar unidade 
      const [unit] = await db
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

      if (!unit) {
        throw new BadRequestError('Unidade não encontrada')
      }

      // Agora verificar permissões (sabendo que org e unit existem)
      const { membership } = await request.getUserMembership(
        organizationSlug,
        unitSlug
      )

      // And in your route, update the call to:
      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('create', 'Demand')) {
        throw new UnauthorizedError(
          'Você não possui permissão para registrar demandas.'
        )
      }

      // Buscar solicitante
      const [applicant] = await db
        .select()
        .from(applicants)
        .where(eq(applicants.id, applicantSlug))
        .limit(1)

      if (!applicant) {
        throw new BadRequestError('Solicitante não encontrado')
      }

      // Buscar usuário
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user?.name) {
        throw new BadRequestError('Usuário não encontrado')
      }

      const {
        title,
        description,
        zip_code,
        state,
        city,
        street,
        neighborhood,
        complement,
        number,
      } = request.body

      const result = await classifyDemandAi({ description })
      const finalPriority = result.priority as DemandPriorityType
      const finalCategory = result.category as DemandCategoryType

      // Criar demanda
      const [demand] = await db
        .insert(demands)
        .values({
          title,
          description,
          priority: finalPriority,
          category: finalCategory,
          zip_code,
          state,
          city,
          street,
          neighborhood,
          complement,
          number,
          unit_id: unit.units.id, // Accessing the unit from the join result
          applicant_id: applicant.id,
          owner_id: userId,
          created_by_member_name: user.name,
        })
        .returning({ id: demands.id })

      return reply.status(201).send({
        demandId: demand.id,
      })
    }
  )
}
