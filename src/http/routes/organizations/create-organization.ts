import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { members, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { createSlug } from '../../utils/create-slug.ts'
import { ConflictError } from '../_errors/conflict-error.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'
import { createOperationResponses } from '../_errors/response-schemas.ts'

export const createOrganizationRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Organizations'],
        summary: 'Criar nova organização',
        description: 'Cria uma nova organização e define o usuário como administrador',
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string().min(1, 'Nome é obrigatório'),
        }),
        response: createOperationResponses(
          z.object({
            organization: z.object({
              id: z.string().uuid(),
              name: z.string(),
              slug: z.string(),
              ownerId: z.string().uuid(),
            }),
          })
        ),
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
        throw new ConflictError('Já existe outra organização com o mesmo nome.')
      }

      try {
        const [newOrganization] = await db
          .insert(organizations)
          .values({
            name,
            slug,
            owner_id: userId,
          })
          .returning()

        if (!newOrganization) {
          throw new InternalServerError('Erro ao criar organização.')
        }

        await db.insert(members).values({
          organization_id: newOrganization.id,
          user_id: userId,
          organization_role: 'ADMIN',
        })

        return reply.status(201).send({
          organization: {
            id: newOrganization.id,
            name: newOrganization.name,
            slug: newOrganization.slug,
            ownerId: newOrganization.owner_id,
          },
        })
      } catch (error) {
        if (error instanceof ConflictError) {
          throw error
        }
        throw new InternalServerError('Erro interno ao criar organização.')
      }
    }
  )
}
