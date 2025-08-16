import { and, asc, desc, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// Helper function to build filter conditions
function buildFilterConditions(filters: {
  organizationId: string
  name?: string
  birthdate?: Date
  created_at?: Date
  updated_at?: Date
  search?: string
}) {
  const conditions = [eq(applicants.organization_id, filters.organizationId)]

  // Apply basic filters
  if (filters.name) {
    conditions.push(ilike(applicants.name, `%${filters.name}%`))
  }
  if (filters.birthdate) {
    conditions.push(gte(applicants.birthdate, filters.birthdate.toISOString()))
  }
  if (filters.created_at) {
    conditions.push(gte(applicants.created_at, filters.created_at))
  }
  if (filters.updated_at) {
    conditions.push(gte(applicants.updated_at, filters.updated_at))
  }

  // Apply search condition
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    const searchCondition = or(
      ilike(applicants.name, searchTerm),
      ilike(applicants.cpf, searchTerm),
      ilike(applicants.phone, searchTerm),
      ilike(applicants.mother, searchTerm),
      ilike(applicants.father, searchTerm)
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

  const orderByMap = {
    created_at: orderDirection(applicants.created_at),
    updated_at: orderDirection(applicants.updated_at),
    name: orderDirection(applicants.name),
    birthdate: orderDirection(applicants.birthdate),
  }

  return orderByMap[sortBy as keyof typeof orderByMap]
}

// Helper function to create base query with joins
function createBaseQuery(conditions: SQL<unknown>[]) {
  return db
    .select({
      id: applicants.id,
      name: applicants.name,
      phone: applicants.phone,
      birthdate: applicants.birthdate,
      cpf: applicants.cpf,
      ticket: applicants.ticket,
      mother: applicants.mother,
      father: applicants.father,
      observation: applicants.observation,
      created_at: applicants.created_at,
      updated_at: applicants.updated_at,
    })
    .from(applicants)
    .where(and(...conditions))
}

// Helper function to create count query
function createCountQuery(conditions: SQL<unknown>[]) {
  return db
    .select({ count: sql<number>`count(*)` })
    .from(applicants)
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

export const getApplicantsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/applicants',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Applicants'],
        summary: 'Get applicants with pagination, filters and search.',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        querystring: z.object({
          // Paginação
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),

          // Filtros
          name: z.string().optional(),
          birthdate: z.coerce.date().optional(),
          created_at: z.coerce.date().optional(),
          updated_at: z.coerce.date().optional(),

          // Busca global (independente da página)
          search: z.string().min(1).optional(),

          // Ordenação
          sort_by: z
            .enum(['created_at', 'updated_at', 'name', 'birthdate'])
            .default('name'),
          sort_order: z.enum(['asc', 'desc']).default('asc'),
        }),
        response: {
          200: z.object({
            applicants: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
                phone: z.string(),
                birthdate: z.string(),
                cpf: z.string(),
                ticket: z.string().nullable(),
                mother: z.string().nullable(),
                father: z.string().nullable(),
                observation: z.string().nullable(),
                created_at: z.date(),
                updated_at: z.date().nullable(),
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
      const { organizationSlug } = request.params

      const {
        page,
        limit,
        name,
        birthdate,
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

      if (cannot('get', 'Applicant')) {
        throw new UnauthorizedError(
          'Você não possui permissão para visualizar applicants.'
        )
      }

      // Get organization
      const organization = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1)

      if (!organization[0]) {
        throw new BadRequestError('Organização não encontrada.')
      }

      // Build conditions using helper function
      const conditions = buildFilterConditions({
        organizationId: organization[0].id,
        name,
        birthdate,
        created_at,
        updated_at,
        search,
      })

      // Get order by clause
      const orderBy = getOrderByClause(sort_by, sort_order)

      // Execute queries in parallel
      const [totalResult, applicantsResult] = await Promise.all([
        createCountQuery(conditions),
        createBaseQuery(conditions)
          .orderBy(orderBy)
          .limit(limit)
          .offset((page - 1) * limit),
      ])

      const total = Number(totalResult[0]?.count || 0)
      const pagination = calculatePagination(page, limit, total)

      return {
        applicants: applicantsResult,
        pagination,
      }
    }
  )
}
