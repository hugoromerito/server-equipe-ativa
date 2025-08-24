import { eq, sql, count, and } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { roleZodEnum } from '../../../db/schema/enums.ts'
import { db } from '../../../db/connection.ts'
import { members, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { getOperationResponses } from '../_errors/response-schemas.ts'

export const getUsersRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/users',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Users'],
        summary: 'Listar usuários da organização',
        description: 'Retorna usuários da organização com paginação, filtros e busca',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        querystring: z.object({
          page: z.coerce.number().default(1),
          pageSize: z.coerce.number().max(50).default(10),
          search: z.string().optional(),
          role: roleZodEnum.optional(),
        }),
        response: getOperationResponses(
          z.object({
            users: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string().nullable(),
                email: z.string().email(),
                avatarUrl: z.string().nullable(),
                role: roleZodEnum,
              })
            ),
            totalPages: z.number(),
            totalUsers: z.number(),
          })
        ),
      },
    },
    async (request) => {
      const { organizationSlug } = request.params
      const { page, pageSize, search, role } = request.query
      const userId = await request.getCurrentUserId()
      const { membership } = await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(userId, membership.organization_role)

      if (cannot('get', 'User')) {
        throw new ForbiddenError('Você não possui permissão para listar usuários.')
      }

      // Construir condições de where
      const whereConditions = [eq(members.organization_id, membership.organization_id)]
      
      if (search) {
        whereConditions.push(sql`${users.name} ILIKE ${`%${search}%`}`)
      }

      if (role) {
        whereConditions.push(eq(members.organization_role, role))
      }

      let query = db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatar_url,
          role: members.organization_role,
        })
        .from(users)
        .innerJoin(members, eq(users.id, members.user_id))
        .where(and(...whereConditions))

      // Paginação
      const offset = (page - 1) * pageSize
      const results = await query.limit(pageSize).offset(offset).orderBy(users.name)

      // Contagem total
      const [{ count: totalUsers }] = await db
        .select({ count: count() })
        .from(users)
        .innerJoin(members, eq(users.id, members.user_id))
        .where(and(...whereConditions))
      const totalPages = Math.ceil(totalUsers / pageSize)

      return {
        users: results,
        totalPages,
        totalUsers,
      }
    }
  )
}
