import { and, asc, desc, eq, gte, ilike, or, sql } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  type DemandCategoryType,
  type DemandPriorityType,
  type DemandStatusType,
  demandCategoryZodEnum,
  demandPriorityZodEnum,
  demandStatusZodEnum,
} from '../../../db/schema/enums.ts'
import {
  applicants,
  demands,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const getDemandsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units/:unitSlug/demands',
    {
      schema: {
        tags: ['demands'],
        summary: 'Get demands with pagination, filters and search',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string().min(1),
          unitSlug: z.string().min(1),
        }),
        querystring: z.object({
          // Paginação
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),

          // Filtros
          category: demandCategoryZodEnum.optional(),
          status: demandStatusZodEnum.optional(),
          priority: demandPriorityZodEnum.optional(),
          created_at: z.coerce.date().optional(),
          updated_at: z.coerce.date().optional(),

          // Busca global (independente da página)
          search: z.string().min(1).optional(),

          // Ordenação
          sort_by: z
            .enum(['created_at', 'updated_at', 'priority', 'status'])
            .default('created_at'),
          sort_order: z.enum(['asc', 'desc']).default('desc'),
        }),
        response: {
          200: z.object({
            demands: z.array(
              z.object({
                id: z.string().uuid(),
                title: z.string(),
                description: z.string(),
                status: demandStatusZodEnum,
                priority: demandPriorityZodEnum,
                category: demandCategoryZodEnum,
                street: z.string().nullable(),
                neighborhood: z.string().nullable(),
                complement: z.string().nullable(),
                number: z.string().nullable(),
                zip_code: z.string().nullable(),
                city: z.string().nullable(),
                state: z.string().nullable(),
                created_at: z.date(),
                updated_at: z.date().nullable(),
                author: z.string().nullable(),
                applicant_name: z.string().nullable(),
                created_by_member_name: z.string(),
              })
            ),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              total_pages: z.number(),
              has_next: z.boolean(),
              has_prev: z.boolean(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { organizationSlug, unitSlug } = request.params
      const {
        page,
        limit,
        category,
        status,
        priority,
        created_at,
        updated_at,
        search,
        sort_by,
        sort_order,
      } = request.query

      // Validação de autorização
      const userId = await request.getCurrentUserId()
      const { membership } = await request.getUserMembership(organizationSlug)
      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('get', 'Demand')) {
        throw new UnauthorizedError(
          'Você não possui permissão para visualizar as demandas.'
        )
      }

      // Condições base
      const conditions = [
        eq(organizations.slug, organizationSlug),
        eq(units.slug, unitSlug),
      ]

      // Aplicar filtros
      if (category) {
        conditions.push(eq(demands.category, category as DemandCategoryType))
      }
      if (status) {
        conditions.push(eq(demands.status, status as DemandStatusType))
      }
      if (priority) {
        conditions.push(eq(demands.priority, priority as DemandPriorityType))
      }
      if (created_at) {
        conditions.push(gte(demands.created_at, created_at))
      }
      if (updated_at) {
        conditions.push(gte(demands.updated_at, updated_at))
      }

      // Busca global (title, description, street, neighborhood, applicant_name)
      if (search) {
        const searchTerm = `%${search}%`
        const searchCondition = or(
          ilike(demands.title, searchTerm),
          ilike(demands.description, searchTerm),
          ilike(demands.street, searchTerm),
          ilike(demands.neighborhood, searchTerm),
          ilike(applicants.name, searchTerm)
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      // Query base com joins
      const baseQuery = db
        .select({
          id: demands.id,
          title: demands.title,
          description: demands.description,
          status: demands.status,
          priority: demands.priority,
          category: demands.category,
          street: demands.street,
          neighborhood: demands.neighborhood,
          complement: demands.complement,
          number: demands.number,
          zip_code: demands.zip_code,
          city: demands.city,
          state: demands.state,
          created_at: demands.created_at,
          updated_at: demands.updated_at,
          author: users.name,
          created_by_member_name: demands.created_by_member_name,
          applicant_name: applicants.name,
        })
        .from(demands)
        .innerJoin(units, eq(demands.unit_id, units.id))
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .leftJoin(users, eq(demands.owner_id, users.id))
        .leftJoin(applicants, eq(demands.applicant_id, applicants.id))
        .where(and(...conditions))

      // Ordenação
      const orderDirection = sort_order === 'asc' ? asc : desc
      const orderBy = {
        created_at: orderDirection(demands.created_at),
        updated_at: orderDirection(demands.updated_at),
        priority: orderDirection(demands.priority),
        status: orderDirection(demands.status),
      }[sort_by]

      // Executar queries em paralelo
      const [totalResult, demandsResult] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(demands)
          .innerJoin(units, eq(demands.unit_id, units.id))
          .innerJoin(organizations, eq(units.organization_id, organizations.id))
          .leftJoin(applicants, eq(demands.applicant_id, applicants.id))
          .where(and(...conditions)),

        baseQuery
          .orderBy(orderBy)
          .limit(limit)
          .offset((page - 1) * limit),
      ])

      const total = Number(totalResult[0]?.count || 0)
      const totalPages = Math.ceil(total / limit)

      return {
        demands: demandsResult,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      }
    }
  )
}
