import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { roleSchema } from '../../../db/auth/roles.ts'
import { db } from '../../../db/connection.ts'
import { schema } from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const getMembersOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/members',
    {
      schema: {
        tags: ['Members'],
        summary: 'Get all organization members',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            members: z.array(
              z.object({
                id: z.uuid(),
                userId: z.uuid(),
                role: roleSchema,
                name: z.string().nullable(),
                email: z.email(),
                avatarUrl: z.url().nullable(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params
      const userId = await request.getCurrentUserId()
      const { organization, membership } = await request.getUserMembership(slug)

      const { cannot } = getUserPermissions(userId, membership.role)

      if (cannot('get', 'User')) {
        throw new UnauthorizedError(
          'Você não possui autorização para visualizar os membros dessa unidade.'
        )
      }

      const membersResult = await db
        .select({
          id: schema.members.id,
          role: schema.members.role,
          user: {
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            avatarUrl: schema.users.avatar_url,
          },
        })
        .from(schema.members)
        .leftJoin(schema.users, eq(schema.users.id, schema.members.user_id))
        .where(eq(schema.members.organization_id, organization.id))
        .orderBy(asc(schema.members.role))

      const membersWithRoles = membersResult.map(({ user, ...member }) => {
        if (!user) {
          throw new Error('User not found for member')
        }

        return {
          id: member.id,
          role: member.role,
          userId: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }
      })

      return reply.send({ members: membersWithRoles })
    }
  )
}
