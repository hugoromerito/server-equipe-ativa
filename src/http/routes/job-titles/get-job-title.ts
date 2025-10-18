import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { jobTitles, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'

export const getJobTitleRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/job-titles/:jobTitleId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Job Titles'],
        summary: 'Buscar cargo/função',
        description: 'Busca um cargo/função específico pelo ID',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          jobTitleId: z.string().uuid(),
        }),
        response: {
          200: z.object({
            jobTitle: z.object({
              id: z.string().uuid(),
              name: z.string(),
              description: z.string().nullable(),
              organizationId: z.string().uuid(),
              unitId: z.string().uuid().nullable(),
              createdAt: z.date(),
              updatedAt: z.date().nullable(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, jobTitleId } = request.params
      await request.getUserMembership(organizationSlug)

      // Buscar organização
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))

      if (!organization) {
        throw new BadRequestError('Organização não encontrada.')
      }

      // Buscar cargo
      const [jobTitle] = await db
        .select()
        .from(jobTitles)
        .where(
          and(
            eq(jobTitles.id, jobTitleId),
            eq(jobTitles.organization_id, organization.id)
          )
        )

      if (!jobTitle) {
        throw new NotFoundError('Cargo não encontrado.')
      }

      return reply.send({
        jobTitle: {
          id: jobTitle.id,
          name: jobTitle.name,
          description: jobTitle.description,
          organizationId: jobTitle.organization_id,
          unitId: jobTitle.unit_id,
          createdAt: jobTitle.created_at,
          updatedAt: jobTitle.updated_at,
        },
      })
    }
  )
}
