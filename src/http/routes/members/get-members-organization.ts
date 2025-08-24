import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, roleZodEnum, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'

export const getMembersOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/members',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Listar membros da organização',
        description: 'Retorna todos os membros da organização com paginação',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        querystring: z.object({
          page: z.coerce.number().min(1).optional().default(1),
          pageSize: z.coerce.number().min(1).max(50).optional().default(10),
        }),
        response: {
          200: z.object({
            members: z.array(
              z.object({
                id: z.uuid(),
                organization_role: roleZodEnum,
                user: z.object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                  email: z.email(),
                  avatar_url: z.string().nullable(),
                }),
              })
            ),
            totalCount: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params
      const { page, pageSize } = request.query
      const userId = await request.getCurrentUserId()
      
      // Tratamento de organização não encontrada
      try {
        const { organization, membership } = await request.getUserMembership(slug)

        const { cannot } = getUserPermissions(
          userId,
          membership.organization_role
        )

        if (cannot('get', 'User')) {
          throw new ForbiddenError(
            'Você não possui autorização para visualizar os membros dessa organização.'
          )
        }

        // Paginação
        const offset = (page - 1) * pageSize

        // Buscar total de membros
        const totalMembersResult = await db
          .select({
            id: members.id,
          })
          .from(members)
          .leftJoin(users, eq(users.id, members.user_id))
          .where(eq(members.organization_id, organization.id))

        const totalCount = totalMembersResult.length

        // Buscar membros com paginação
        const membersResult = await db
          .select({
            id: members.id,
            organization_role: members.organization_role,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              avatar_url: users.avatar_url,
            },
          })
          .from(members)
          .leftJoin(users, eq(users.id, members.user_id))
          .where(eq(members.organization_id, organization.id))
          .orderBy(asc(members.organization_role))
          .limit(pageSize)
          .offset(offset)

        // Filtrar membros com usuários válidos
        const validMembers = membersResult
          .filter((member): member is typeof member & { user: NonNullable<typeof member.user> } => 
            member.user !== null && member.user.id !== null
          )

        return reply.send({ 
          members: validMembers,
          totalCount
        })
      } catch (error) {
        if (error instanceof Error && error.message.includes('Organization not found')) {
          throw new NotFoundError('Organização não encontrada.')
        }
        throw error
      }
    }
  )
}
