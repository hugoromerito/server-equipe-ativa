import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, roleZodEnum, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

type RoleType = z.infer<typeof roleZodEnum>

// Tipo para o membro com informações do usuário
interface MemberWithUser {
  id: string
  orgRole: RoleType
  userId: string
  name: string | null
  email: string
  avatarUrl: string | null
}

export const getMembersOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/members',
    {
      preHandler: [authPreHandler],
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
                orgRole: roleZodEnum,
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

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('get', 'User')) {
        throw new UnauthorizedError(
          'Você não possui autorização para visualizar os membros dessa unidade.'
        )
      }

      const membersResult = await db
        .select({
          id: members.id,
          orgRole: members.organization_role,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatar_url,
          },
        })
        .from(members)
        .leftJoin(users, eq(users.id, members.user_id))
        .where(eq(members.organization_id, organization.id))
        .orderBy(asc(members.organization_role))

      // const membersWithRoles = membersResult.map(({ user, ...member }) => {
      //   if (!user) {
      //     throw new Error('User not found for member')
      //   }

      //   return {
      //     id: member.id,
      //     orgRole: member.orgRole,
      //     userId: user.id,
      //     name: user.name,
      //     email: user.email,
      //     avatarUrl: user.avatarUrl,
      //   }
      // })

      const uniqueUsers = new Map<string, MemberWithUser>()

      for (const { user, ...member } of membersResult) {
        if (!user) {
          continue
        }

        if (!uniqueUsers.has(user.id)) {
          uniqueUsers.set(user.id, {
            id: member.id,
            orgRole: member.orgRole as RoleType,
            userId: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          })
        }
      }

      const membersWithRoles = Array.from(uniqueUsers.values())

      return reply.send({ members: membersWithRoles })
    }
  )
}
