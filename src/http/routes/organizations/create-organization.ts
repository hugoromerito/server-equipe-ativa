// import { createSlug } from '@/utils/create-slug'

import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, organizations } from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { createSlug } from '../../utils/create-slug.ts'

export const createOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations',
    {
      schema: {
        tags: ['organizations'],
        summary: 'Create a new organization',
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string(),
        }),
        response: {
          201: z.object({
            organizationId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()

      const { name } = request.body

      // Gera o slug a partir do nome
      const slug = createSlug(name)

      // Verifica se já existe organização com o mesmo slug
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug),
      })

      if (existing) {
        throw new Error('Já existe outra organização com o mesmo nome.')
      }

      const [newOrganization] = await db
        .insert(organizations)
        .values({
          name,
          slug,
          owner_id: userId,
        })
        .returning()

      if (!newOrganization) {
        throw new Error('Erro ao criar organização.')
      }

      await db.insert(members).values({
        organization_id: newOrganization.id,
        user_id: userId,
        organization_role: 'ADMIN',
      })

      return reply.status(201).send({
        organizationId: newOrganization.id,
      })
    }
  )
}
