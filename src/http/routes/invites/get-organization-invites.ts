import { and, desc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { roleZodEnum } from '../../../db/schema/enums.ts'
import {
  invites,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'

export const getOrganizationInvitesRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/invites',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Invites'],
        summary: 'Listar convites da organização',
        description: 'Retorna convites da organização com paginação',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        response: withAuthErrorResponses({
          200: z.object({
            invites: z.array(
              z.object({
                id: z.uuid(),
                email: z.email(),
                role: roleZodEnum,
                createdAt: z.date(),
                author: z
                  .object({
                    id: z.uuid(),
                    name: z.string().nullable(),
                  })
                  .nullable(),
                unit: z
                  .object({
                    id: z.uuid(),
                    name: z.string(),
                    slug: z.string(),
                  })
                  .nullable(),
              })
            ),
          }),
        }),
      },
    },
    async (request, reply) => {
      const { organizationSlug } = request.params
      const userId = await request.getCurrentUserId()

      // Buscar organização
      const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1)

      if (!organization[0]) {
        throw new NotFoundError('Organização não encontrada.')
      }

      // Verificar membership e permissões
      const membership = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.user_id, userId),
            eq(members.organization_id, organization[0].id)
          )
        )
        .limit(1)

      if (!membership[0]) {
        throw new UnauthorizedError('Você não pertence a esta organização.')
      }

      const { cannot } = getUserPermissions(
        userId,
        membership[0].organization_role
      )

      if (cannot('get', 'Invite')) {
        throw new UnauthorizedError(
          'Você não possui permissão para visualizar convites.'
        )
      }

      // Buscar convites da organização
      const invitesList = await db
        .select({
          id: invites.id,
          email: invites.email,
          role: invites.role,
          createdAt: invites.created_at,
          authorId: users.id,
          authorName: users.name,
          unitId: units.id,
          unitName: units.name,
          unitSlug: units.slug,
        })
        .from(invites)
        .leftJoin(users, eq(invites.author_id, users.id))
        .leftJoin(units, eq(invites.unit_id, units.id))
        .where(eq(invites.organization_id, organization[0].id))
        .orderBy(desc(invites.created_at))

      const formattedInvites = invitesList.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        createdAt: invite.createdAt,
        author: invite.authorId
          ? {
              id: invite.authorId,
              name: invite.authorName,
            }
          : null,
        unit: invite.unitId
          ? {
              id: invite.unitId,
              name: invite.unitName!,
              slug: invite.unitSlug!,
            }
          : null,
      }))

      return reply.status(200).send({ invites: formattedInvites })
    }
  )
}
