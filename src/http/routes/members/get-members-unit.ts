import { differenceInMinutes } from 'date-fns'
import { and, asc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  members,
  organizations,
  roleZodEnum,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const getMembersUnitRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units/:unitSlug/members',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Get all members from a specific unit within the organization',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
        }),
        response: {
          200: z.object({
            members: z.array(
              z.object({
                id: z.uuid(),
                userId: z.uuid(),
                unitRole: roleZodEnum,
                name: z.string().nullable(),
                email: z.email(),
                avatarUrl: z.url().nullable(),
                lastSeen: z.date(),
                isOnline: z.boolean(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug } = request.params
      const userId = await request.getCurrentUserId()
      const { organization, membership } =
        await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('get', 'User')) {
        throw new UnauthorizedError(
          'Você não possui autorização para visualizar os membros dessa unidade.'
        )
      }

      const unit = await db
        .select({ id: units.id, slug: units.slug })
        .from(units)
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .where(
          and(
            eq(organizations.slug, organizationSlug),
            eq(units.slug, unitSlug)
          )
        )
        .limit(1)

      if (!unit.length) {
        throw new BadRequestError('Unidade não encontrada na organização.')
      }

      const membersResult = await db
        .select({
          id: members.id,
          unitRole: members.unit_role,
          orgRole: members.organization_role,
          userId: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatar_url,
          lastSeen: users.last_seen,
        })
        .from(members)
        .leftJoin(users, eq(members.user_id, users.id))
        .where(
          and(
            eq(members.organization_id, organization.id),
            eq(members.unit_id, unit[0].id)
          )
        )
        .orderBy(asc(members.unit_role || members.organization_role))

      const membersWithRoles = membersResult
        .filter((member) => member.userId !== null) // Filtra membros sem usuário associado
        .map((member) => {
          // Se não tiver unitRole, usa orgRole
          const finalRole = member.unitRole || member.orgRole

          if (!finalRole) {
            throw new Error('Member sem unitRole nem orgRole.')
          }
          if (!member.lastSeen) {
            throw new Error(
              `lastSeen está ausente para o usuário ${member.userId}`
            )
          }

          const isOnline =
            member.lastSeen &&
            differenceInMinutes(new Date(), new Date(member.lastSeen)) <= 5

          return {
            id: member.id,
            userId: member.userId || '', // ou throw error se null
            unitRole: finalRole,
            name: member.name,
            email: member.email || '', // ou throw error se null
            avatarUrl: member.avatarUrl,
            lastSeen: member.lastSeen,
            isOnline,
          }
        })

      return reply.send({ members: membersWithRoles })
    }
  )
}
