import { and, asc, desc, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
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
  jobTitles,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// Helper function to build filter conditions
function buildFilterConditions(filters: {
  organizationSlug: string
  unitSlug: string
  category?: DemandCategoryType
  status?: DemandStatusType
  priority?: DemandPriorityType
  created_at?: Date
  updated_at?: Date
  search?: string
  responsibleId?: string
}) {
  const conditions = [
    eq(organizations.slug, filters.organizationSlug),
    eq(units.slug, filters.unitSlug),
  ]

  // Apply basic filters
  if (filters.category) {
    conditions.push(eq(demands.category, filters.category))
  }
  if (filters.status) {
    conditions.push(eq(demands.status, filters.status))
  }
  if (filters.priority) {
    conditions.push(eq(demands.priority, filters.priority))
  }
  if (filters.responsibleId) {
    conditions.push(eq(demands.responsible_id, filters.responsibleId))
  }
  if (filters.created_at) {
    conditions.push(gte(demands.created_at, filters.created_at))
  }
  if (filters.updated_at) {
    conditions.push(gte(demands.updated_at, filters.updated_at))
  }

  // Apply search condition
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    const searchCondition = or(
      ilike(demands.title, searchTerm),
      ilike(demands.description, searchTerm),
      ilike(applicants.name, searchTerm)
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  return conditions
}

// Helper function to get order by clause
function getOrderByClause(sortBy: string, sortOrder: string) {
  const orderDirection = sortOrder === 'asc' ? asc : desc

  switch (sortBy) {
    case 'created_at':
      return [orderDirection(demands.created_at)]
    case 'updated_at':
      return [orderDirection(demands.updated_at)]
    case 'priority':
      return [orderDirection(demands.priority)]
    case 'status':
      return [orderDirection(demands.status)]
    
    case 'scheduled_datetime':
      // Workaround para o problema de tipagem do 'nullsLast'
      // Usamos o helper 'sql' para construir a ordenação
      const order = sortOrder === 'asc' ? sql`asc nulls last` : sql`desc nulls last`
      
      // O desempate pode usar o 'asc'/'desc' normal
      const tieBreaker = sortOrder === 'asc' 
        ? asc(demands.created_at) 
        : desc(demands.created_at)

      return [
        sql`${demands.scheduled_date} ${order}`,
        sql`${demands.scheduled_time} ${order}`,
        tieBreaker, // Adiciona created_at como desempate
      ]

    default:
      // O Zod já garante que o 'sort_by' default é 'scheduled_datetime',
      // mas é bom ter o fallback original.
      return [orderDirection(demands.created_at)]
  }
}

// Helper function to create base query with joins
function createBaseQuery(conditions: SQL<unknown>[]) {
  // Criar aliases para tabelas que serão usadas múltiplas vezes
  const responsibleUsers = alias(users, 'responsible_users')
  const responsibleJobTitles = alias(jobTitles, 'responsible_job_titles')

  return db
    .select({
      id: demands.id,
      title: demands.title,
      description: demands.description,
      status: demands.status,
      priority: demands.priority,
      category: demands.category,
      scheduled_date: demands.scheduled_date,
      scheduled_time: demands.scheduled_time,
      responsible_id: demands.responsible_id,
      created_at: demands.created_at,
      updated_at: demands.updated_at,
      author: users.name,
      created_by_member_name: demands.created_by_member_name,
      applicant_name: applicants.name,
      // Informações do responsável
      responsible_name: responsibleUsers.name,
      responsible_email: responsibleUsers.email,
      responsible_job_title: responsibleJobTitles.name,
    })
    .from(demands)
    .innerJoin(units, eq(demands.unit_id, units.id))
    .innerJoin(organizations, eq(units.organization_id, organizations.id))
    .leftJoin(users, eq(demands.owner_id, users.id))
    .leftJoin(applicants, eq(demands.applicant_id, applicants.id))
    // Joins para buscar informações do responsável
    .leftJoin(members, eq(demands.responsible_id, members.id))
    .leftJoin(responsibleUsers, eq(members.user_id, responsibleUsers.id))
    .leftJoin(responsibleJobTitles, eq(members.job_title_id, responsibleJobTitles.id))
    .where(and(...conditions))
}

// Helper function to create count query
function createCountQuery(conditions: SQL<unknown>[]) {
  return db
    .select({ count: sql<number>`count(*)` })
    .from(demands)
    .innerJoin(units, eq(demands.unit_id, units.id))
    .innerJoin(organizations, eq(units.organization_id, organizations.id))
    .leftJoin(applicants, eq(demands.applicant_id, applicants.id))
    .where(and(...conditions))
}

// Helper function to calculate pagination info
function calculatePagination(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  }
}

export const getDemandsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units/:unitSlug/demands',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Listar demandas com filtros',
        description: 'Retorna demandas com paginação, filtros e busca',
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
          responsibleId: z.string().uuid('ID do responsável deve ser um UUID válido').optional(),

          // Busca global (independente da página)
          search: z.string().min(1).optional(),

          // Ordenação
          sort_by: z
            .enum(['created_at', 'updated_at', 'priority', 'status', 'scheduled_datetime'])
            .default('scheduled_datetime'),
          sort_order: z.enum(['asc', 'desc']).default('asc'),
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
                scheduled_date: z.string().nullable(),
                scheduled_time: z.string().nullable(),
                responsible_id: z.string().uuid().nullable(),
                created_at: z.date(),
                updated_at: z.date().nullable(),
                author: z.string().nullable(),
                applicant_name: z.string().nullable(),
                created_by_member_name: z.string(),
                // Informações do responsável
                responsible: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  email: z.string(),
                  job_title: z.string().nullable(),
                }).nullable(),
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

      // Authorization validation
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

      // Build conditions using helper function
      const conditions = buildFilterConditions({
        organizationSlug,
        unitSlug,
        category,
        status,
        priority,
        created_at,
        updated_at,
        search,
      })

      // Get order by clause
      const orderBy = getOrderByClause(sort_by, sort_order)

      // Execute queries in parallel
      const [totalResult, demandsResult] = await Promise.all([
        createCountQuery(conditions),
        createBaseQuery(conditions)
          .orderBy(...orderBy)
          .limit(limit)
          .offset((page - 1) * limit),
      ])

      const total = Number(totalResult[0]?.count || 0)
      const pagination = calculatePagination(page, limit, total)

      // Transform data to include responsible object
      const transformedDemands = demandsResult.map(demand => ({
        id: demand.id,
        title: demand.title,
        description: demand.description,
        status: demand.status,
        priority: demand.priority,
        category: demand.category,
        scheduled_date: demand.scheduled_date,
        scheduled_time: demand.scheduled_time,
        responsible_id: demand.responsible_id,
        created_at: demand.created_at,
        updated_at: demand.updated_at,
        author: demand.author,
        applicant_name: demand.applicant_name,
        created_by_member_name: demand.created_by_member_name,
        responsible: demand.responsible_id ? {
          id: demand.responsible_id,
          name: demand.responsible_name || '',
          email: demand.responsible_email || '',
          job_title: demand.responsible_job_title,
        } : null,
      }))

      return {
        demands: transformedDemands,
        pagination,
      }
    }
  )
}
