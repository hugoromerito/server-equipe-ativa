import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { roleEnum } from '../../../db/schema/enums/role.ts'
import { schema } from '../../../db/schema/index.ts'
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
                role: roleEnum,
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()

      const organizationsResult = await db
        .select({
          id: schema.organizations.id,
          name: schema.organizations.name,
          slug: schema.organizations.slug,
          avatarUrl: schema.organizations.avatar_url,
          role: schema.members.role,
        })
        .from(schema.organizations)
        .innerJoin(
          schema.members,
          and(
            eq(schema.members.organization_id, schema.organizations.id),
            eq(schema.members.user_id, userId)
          )
        )

      const organizationsWithUserRole = organizationsResult.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        avatarUrl: org.avatarUrl,
        role: org.role,
      }))

      return { organizations: organizationsWithUserRole }
    }
  )
}
