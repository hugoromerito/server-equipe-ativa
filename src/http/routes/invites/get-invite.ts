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
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withPublicErrorResponses } from '../_errors/error-helpers.ts'

export const getInviteRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/organizations/:organizationSlug/invites/:inviteId',
    {
      schema: {
        tags: ['Invites'],
        summary: 'Obter detalhes do convite',
        description: 'Retorna informações detalhadas de um convite específico',
        params: z.object({
          organizationSlug: z.string(),
          inviteId: z.uuid(),
        }),
        response: withPublicErrorResponses({
          200: z.object({
            invite: z.object({
              id: z.uuid(),
              email: z.email(),
              role: roleZodEnum,
              createdAt: z.date(),
              author: z
                .object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                  avatarUrl: z.url().nullable(),
                })
                .nullable(),
              unit: z
                .object({
                  name: z.string(),
                  location: z.string(),
                  organization: z.object({
                    name: z.string(),
                  }),
                })
                .nullable(),
            }),
          }),
        }),
      },
    },
    async (request, reply) => {
      const { organizationSlug, inviteId } = request.params

      // Verificar se a organização existe
      const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1)

      if (!organization[0]) {
        throw new NotFoundError('Organização não encontrada.')
      }

      const inviteData = await db
        .select({
          id: invites.id,
          email: invites.email,
          role: invites.role,
          createdAt: invites.created_at,
          organizationId: invites.organization_id,
          authorId: users.id,
          authorName: users.name,
          authorAvatarUrl: users.avatar_url,
          unitName: units.name,
          unitLocation: units.location,
          organizationName: organizations.name,
        })
        .from(invites)
        .leftJoin(users, eq(invites.author_id, users.id))
        .leftJoin(units, eq(invites.unit_id, units.id))
        .leftJoin(organizations, eq(invites.organization_id, organizations.id))
        .where(eq(invites.id, inviteId))
        .limit(1)

      if (!inviteData[0] || inviteData[0].organizationId !== organization[0].id) {
        throw new NotFoundError('Convite não encontrado.')
      }

      const invite = {
        id: inviteData[0].id,
        email: inviteData[0].email,
        role: inviteData[0].role,
        createdAt: new Date(inviteData[0].createdAt),
        author: inviteData[0].authorId
          ? {
              id: inviteData[0].authorId,
              name: inviteData[0].authorName,
              avatarUrl: inviteData[0].authorAvatarUrl,
            }
          : null,
        unit:
          inviteData[0].unitName &&
          inviteData[0].organizationName &&
          inviteData[0].unitLocation
            ? {
                name: inviteData[0].unitName,
                location: inviteData[0].unitLocation,
                organization: {
                  name: inviteData[0].organizationName,
                },
              }
            : null,
      }

      return reply.status(200).send({ invite })
    }
  )
}
