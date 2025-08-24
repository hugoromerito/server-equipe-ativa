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
import { NotFoundError } from '../_errors/not-found-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'

export const getMembersUnitRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units/:unitSlug/members',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Listar membros da unidade',
        description: 'Retorna todos os membros de uma unidade específica dentro da organização',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
        }),
        querystring: z.object({
          role: roleZodEnum.optional(),
        }),
        response: {
          200: z.object({
            members: z.array(
              z.object({
                id: z.uuid(),
                unit_role: roleZodEnum.nullable(),
                organization_role: roleZodEnum,
                user: z.object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                  email: z.email(),
                  avatar_url: z.string().nullable(),
                  last_seen: z.date(),
                }),
                is_online: z.boolean(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug } = request.params
      const { role } = request.query
      const userId = await request.getCurrentUserId()
      
      // Tratamento de organização não encontrada
      try {
        const { organization, membership } =
          await request.getUserMembership(organizationSlug)

        const { cannot } = getUserPermissions(
          userId,
          membership.unit_role || membership.organization_role
        )

        if (cannot('get', 'User')) {
          throw new ForbiddenError(
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
          throw new NotFoundError('Unidade não encontrada na organização.')
        }

        // Construir condições de filtro
        const whereConditions = [
          eq(members.organization_id, organization.id),
          eq(members.unit_id, unit[0].id)
        ]

        const membersResult = await db
          .select({
            id: members.id,
            unit_role: members.unit_role,
            organization_role: members.organization_role,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              avatar_url: users.avatar_url,
              last_seen: users.last_seen,
            },
          })
          .from(members)
          .leftJoin(users, eq(members.user_id, users.id))
          .where(and(...whereConditions))
          .orderBy(asc(members.unit_role || members.organization_role))

        // Filtrar membros com usuários válidos
        const validMembers = membersResult
          .filter((member): member is typeof member & { user: NonNullable<typeof member.user> } => 
            member.user !== null && member.user.id !== null && member.user.last_seen !== null
          )
          .map((member) => {
            const isOnline = member.user.last_seen && 
              differenceInMinutes(new Date(), new Date(member.user.last_seen)) <= 5

            return {
              id: member.id,
              unit_role: member.unit_role,
              organization_role: member.organization_role,
              user: member.user,
              is_online: isOnline,
            }
          })

        // Filtrar por role se especificado
        const filteredMembers = role 
          ? validMembers.filter(member => 
              member.unit_role === role || 
              (!member.unit_role && member.organization_role === role)
            )
          : validMembers

        return reply.send({ members: filteredMembers })
      } catch (error) {
        if (error instanceof Error && error.message.includes('Organization not found')) {
          throw new NotFoundError('Organização não encontrada.')
        }
        throw error
      }
    }
  )
}
