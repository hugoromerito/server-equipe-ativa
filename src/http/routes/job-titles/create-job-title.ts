import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { jobTitles, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { createJobTitleSchema } from '../../schemas/job-titles.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const createJobTitleRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/job-titles',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Job Titles'],
        summary: 'Criar cargo/função',
        description: 'Cria um novo cargo/função na organização ou unidade',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        body: createJobTitleSchema,
        response: {
          201: z.object({
            jobTitleId: z.string().uuid(),
            jobTitle: z.object({
              id: z.string().uuid(),
              name: z.string(),
              description: z.string().nullable(),
              organizationId: z.string().uuid(),
              unitId: z.string().uuid().nullable(),
              createdAt: z.date(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug } = request.params
      const { name, description, unit_id } = request.body
      const userId = await request.getCurrentUserId()
      const { membership } = await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('manage', 'Organization')) {
        throw new UnauthorizedError(
          'Você não possui permissão para criar cargos.'
        )
      }

      // Buscar organização
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))

      if (!organization) {
        throw new BadRequestError('Organização não encontrada.')
      }

      // Criar cargo
      const [jobTitle] = await db
        .insert(jobTitles)
        .values({
          name,
          description: description || null,
          organization_id: organization.id,
          unit_id: unit_id || null,
          created_at: new Date(),
        })
        .returning()

      return reply.status(201).send({
        jobTitleId: jobTitle.id,
        jobTitle: {
          id: jobTitle.id,
          name: jobTitle.name,
          description: jobTitle.description,
          organizationId: jobTitle.organization_id,
          unitId: jobTitle.unit_id,
          createdAt: jobTitle.created_at,
        },
      })
    }
  )
}
