// import type { FastifyInstance } from 'fastify'
// import type { ZodTypeProvider } from 'fastify-type-provider-zod'
// import { z } from 'zod'

import { and, asc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { roleSchema } from '../../../db/auth/roles.ts'
import { db } from '../../../db/connection.ts'
import { schema } from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// import { auth } from '@/http/middlewares/auth'
// import { UnauthorizedError } from '@/http/routes/_errors/unauthorized-error'
// import { prisma } from '@/lib/prisma'
// import { getUserPermissions } from '@/utils/get-user-permissions'
// import { BadRequestError } from '../_errors/bad-request-error'
// import { roleSchema } from '@/auth/src'

export const getMembersUnitRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units/:unitSlug/members',
    {
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
      const { organizationSlug, unitSlug } = request.params
      const userId = await request.getCurrentUserId()
      const { organization, membership } =
        await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(userId, membership.role)

      if (cannot('get', 'User')) {
        throw new UnauthorizedError(
          'Você não possui autorização para visualizar os membros dessa unidade.'
        )
      }

      const unit = await db
        .select({ id: schema.units.id, slug: schema.units.slug })
        .from(schema.units)
        .innerJoin(
          schema.organizations,
          eq(schema.units.organization_id, schema.organizations.id)
        )
        .where(
          and(
            eq(schema.organizations.slug, organizationSlug),
            eq(schema.units.slug, unitSlug)
          )
        )
        .limit(1)

      if (!unit.length) {
        throw new BadRequestError('Unidade não encontrada na organização.')
      }

      const membersResult = await db
        .select({
          id: schema.members.id,
          role: schema.members.role,
          userId: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          avatarUrl: schema.users.avatar_url,
        })
        .from(schema.members)
        .leftJoin(schema.users, eq(schema.members.user_id, schema.users.id))
        .where(
          and(
            eq(schema.members.organization_id, organization.id),
            eq(schema.members.unit_id, unit[0].id)
          )
        )
        .orderBy(asc(schema.members.role))

      const membersWithRoles = membersResult
        .filter((member) => member.userId !== null) // Filtra membros sem usuário associado
        .map((member) => ({
          id: member.id,
          userId: member.userId || '', // ou throw error se null
          role: member.role,
          name: member.name,
          email: member.email || '', // ou throw error se null
          avatarUrl: member.avatarUrl,
        }))

      return reply.send({ members: membersWithRoles })
    }
  )
}
