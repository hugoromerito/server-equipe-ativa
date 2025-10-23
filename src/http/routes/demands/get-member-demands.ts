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
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// Helper function to build filter conditions
function buildFilterConditions(filters: {
  organizationSlug: string
  unitSlug: string
  memberId: string
  category?: DemandCategoryType
  status?: DemandStatusType
  priority?: DemandPriorityType
  created_at?: Date
  updated_at?: Date
  search?: string
}) {
  const conditions = [
    eq(organizations.slug, filters.organizationSlug),
    eq(units.slug, filters.unitSlug),
    eq(demands.responsible_id, filters.memberId), // Filtrar apenas demandas do profissional
  ]

  if (filters.category) {
    conditions.push(eq(demands.category, filters.category))
  }
  if (filters.status) {
    conditions.push(eq(demands.status, filters.status))
  }
  if (filters.priority) {
    conditions.push(eq(demands.priority, filters.priority))
  }
  if (filters.created_at) {
    conditions.push(gte(demands.created_at, filters.created_at))
  }
  if (filters.updated_at) {
    conditions.push(gte(demands.updated_at, filters.updated_at))
  }

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

// Helper function to get order by clause (mesma lógica da rota de demands)
function getOrderByClause(sortBy: string = 'scheduled_datetime', sortOrder: string = 'asc'): SQL<unknown>[] {
  const isAsc = sortOrder === 'asc'
  const statusPriority = sql`CASE ${demands.status}
    WHEN 'CHECK_IN' THEN 1
    WHEN 'IN_PROGRESS' THEN 2
    WHEN 'PENDING' THEN 3
    WHEN 'RESOLVED' THEN 4
    WHEN 'BILLED' THEN 5
    WHEN 'REJECTED' THEN 6
    ELSE 7
  END`

  switch (sortBy) {
    case 'created_at':
      return isAsc ? [asc(demands.created_at)] : [desc(demands.created_at)]
    
    case 'updated_at':
      return isAsc ? [asc(demands.updated_at)] : [desc(demands.updated_at)]
    
    case 'priority':
      return isAsc ? [asc(demands.priority)] : [desc(demands.priority)]
    
    case 'status':
      return isAsc ? [asc(demands.status)] : [desc(demands.status)]
    
    case 'scheduled_datetime':
    default:
      // Ordenação por status + data + hora (padrão)
      if (isAsc) {
        return [
          statusPriority,
          sql`${demands.scheduled_date} ASC NULLS LAST`,
          sql`${demands.scheduled_time} ASC NULLS LAST`
        ]
      } else {
        return [
          statusPriority,
          sql`${demands.scheduled_date} DESC NULLS LAST`,
          sql`${demands.scheduled_time} DESC NULLS LAST`
        ]
      }
  }
}

// Helper function to create base query with joins
function createBaseQuery(conditions: SQL<unknown>[]) {
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
      responsible_name: responsibleUsers.name,
      responsible_email: responsibleUsers.email,
      responsible_job_title: responsibleJobTitles.name,
    })
    .from(demands)
    .innerJoin(units, eq(demands.unit_id, units.id))
    .innerJoin(organizations, eq(units.organization_id, organizations.id))
    .leftJoin(users, eq(demands.owner_id, users.id))
    .leftJoin(applicants, eq(demands.applicant_id, applicants.id))
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

export const getMemberDemandsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units/:unitSlug/my-demands',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Listar minhas demandas (profissional)',
        description: 'Retorna demandas atribuídas ao profissional logado com paginação e filtros',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string().min(1),
          unitSlug: z.string().min(1),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          category: demandCategoryZodEnum.optional(),
          status: demandStatusZodEnum.optional(),
          priority: demandPriorityZodEnum.optional(),
          created_at: z.coerce.date().optional(),
          updated_at: z.coerce.date().optional(),
          search: z.string().min(1).optional(),
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
      const query = request.query
      
      // Garantir valores padrão explicitamente
      const page = query.page ?? 1
      const limit = query.limit ?? 20
      const sort_by = query.sort_by ?? 'scheduled_datetime'
      const sort_order = query.sort_order ?? 'asc'
      
      const {
        category,
        status,
        priority,
        created_at,
        updated_at,
        search,
      } = query

      // Buscar o member do usuário logado na unidade
      const userId = await request.getCurrentUserId()
      const { membership } = await request.getUserMembership(organizationSlug)

      const [member] = await db
        .select({ id: members.id })
        .from(members)
        .innerJoin(units, eq(members.unit_id, units.id))
        .where(
          and(
            eq(members.user_id, userId),
            eq(units.slug, unitSlug),
            eq(members.organization_id, membership.organization_id)
          )
        )
        .limit(1)

      if (!member) {
        throw new UnauthorizedError(
          'Você não é membro desta unidade.'
        )
      }

      // Build conditions (incluindo filtro por member)
      const conditions = buildFilterConditions({
        organizationSlug,
        unitSlug,
        memberId: member.id,
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

      // Transform data
      const transformedDemands = demandsResult.map(demand => ({
        id: demand.id,
        title: demand.title,
        description: demand.description,
        status: demand.status,
        priority: demand.priority,
        category: demand.category,
        scheduled_date: demand.scheduled_date ?
          (typeof (demand.scheduled_date as any)?.toISOString === 'function'
            ? ((demand.scheduled_date as unknown) as Date).toISOString().slice(0, 10)
            : String(demand.scheduled_date))
          : null,
        scheduled_time: demand.scheduled_time ?
          (typeof demand.scheduled_time === 'string'
            ? demand.scheduled_time.slice(0, 5)
            : String(demand.scheduled_time).slice(0, 5))
          : null,
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
