import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { roleZodEnum } from '../../../db/schema/enums.ts'
import { members, organizations } from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'

export const getOrganizationsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations',
    {
      schema: {
        tags: ['organizations'],
        summary: 'Get organization where user is a member',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            organizations: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
                slug: z.string(),
                avatarUrl: z.url().nullable(),
                orgRole: roleZodEnum,
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()

      const organizationsResult = await db
        .selectDistinct({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          avatarUrl: organizations.avatar_url,
          orgRole: members.organization_role,
        })
        .from(organizations)
        .innerJoin(
          members,
          and(
            eq(members.organization_id, organizations.id),
            eq(members.user_id, userId)
          )
        )

      const organizationsWithUserRole = organizationsResult.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        avatarUrl: org.avatarUrl,
        orgRole: org.orgRole,
      }))

      return { organizations: organizationsWithUserRole }
    }
  )
}
