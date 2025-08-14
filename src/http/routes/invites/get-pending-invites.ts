import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { roleZodEnum } from '../../../db/schema/enums.ts'
import {
  invites,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const getPendingInvitesRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/pending-invites',
    {
      schema: {
        tags: ['Invites'],
        summary: 'Get all user pending invites',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            invites: z.array(
              z.object({
                id: z.uuid(),
                role: roleZodEnum,
                email: z.email(),
                createdAt: z.date(),
                unit: z
                  .object({
                    name: z.string(),
                    organization: z.object({
                      name: z.string(),
                    }),
                  })
                  .nullable(),
                author: z
                  .object({
                    id: z.uuid(),
                    name: z.string().nullable(),
                    avatarUrl: z.url().nullable(),
                  })
                  .nullable(),
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()

      const currentUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!currentUser.length) {
        throw new BadRequestError('Usuário não encontrado.')
      }

      const invitesData = await db
        .select({
          id: invites.id,
          email: invites.email,
          role: invites.role,
          createdAt: invites.created_at,
          authorId: users.id,
          authorName: users.name,
          authorAvatarUrl: users.avatar_url,
          unitName: units.name,
          organizationName: organizations.name,
        })
        .from(invites)
        .leftJoin(users, eq(invites.author_id, users.id))
        .leftJoin(units, eq(invites.unit_id, units.id))
        .leftJoin(organizations, eq(units.organization_id, organizations.id))
        .where(eq(invites.email, currentUser[0].email))

      const transformedInvites = invitesData.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        createdAt: invite.createdAt,
        author: invite.authorId
          ? {
              id: invite.authorId,
              name: invite.authorName,
              avatarUrl: invite.authorAvatarUrl,
            }
          : null,
        unit:
          invite.unitName && invite.organizationName
            ? {
                name: invite.unitName,
                organization: {
                  name: invite.organizationName,
                },
              }
            : null,
      }))

      return { invites: transformedInvites }
    }
  )
}
