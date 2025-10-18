import { and, count, eq, isNull } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { jobTitles, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { listJobTitlesQuerySchema } from '../../schemas/job-titles.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const getJobTitlesRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/job-titles',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Job Titles'],
        summary: 'Listar cargos/funções',
        description: 'Lista todos os cargos/funções da organização ou de uma unidade específica',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        querystring: listJobTitlesQuerySchema,
        response: {
          200: z.object({
            jobTitles: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().nullable(),
                organizationId: z.string().uuid(),
                unitId: z.string().uuid().nullable(),
                createdAt: z.date(),
                updatedAt: z.date().nullable(),
              })
            ),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug } = request.params
      const { unit_id, page, limit } = request.query
      await request.getUserMembership(organizationSlug)

      // Buscar organização
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))

      if (!organization) {
        throw new BadRequestError('Organização não encontrada.')
      }

      // Construir query base
      const baseConditions = [eq(jobTitles.organization_id, organization.id)]

      if (unit_id) {
        baseConditions.push(eq(jobTitles.unit_id, unit_id))
      } else {
        // Se não especificou unit_id, buscar apenas cargos gerais da organização
        baseConditions.push(isNull(jobTitles.unit_id))
      }

      // Contar total
      const [{ value: total }] = await db
        .select({ value: count() })
        .from(jobTitles)
        .where(and(...baseConditions))

      // Buscar cargos com paginação
      const offset = (page - 1) * limit
      const jobTitlesList = await db
        .select()
        .from(jobTitles)
        .where(and(...baseConditions))
        .orderBy(jobTitles.name)
        .limit(limit)
        .offset(offset)

      const totalPages = Math.ceil(total / limit)

      return reply.send({
        jobTitles: jobTitlesList.map((jt) => ({
          id: jt.id,
          name: jt.name,
          description: jt.description,
          organizationId: jt.organization_id,
          unitId: jt.unit_id,
          createdAt: jt.created_at,
          updatedAt: jt.updated_at,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      })
    }
  )
}
