import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { jobTitles, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { updateJobTitleSchema } from '../../schemas/job-titles.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const updateJobTitleRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:organizationSlug/job-titles/:jobTitleId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Job Titles'],
        summary: 'Atualizar cargo/função',
        description: 'Atualiza um cargo/função existente',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          jobTitleId: z.string().uuid(),
        }),
        body: updateJobTitleSchema,
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
      const updateData = request.body
      const userId = await request.getCurrentUserId()
      const { membership } = await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('manage', 'Organization')) {
        throw new UnauthorizedError(
          'Você não possui permissão para atualizar cargos.'
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

      // Verificar se o cargo existe
      const [existingJobTitle] = await db
        .select()
        .from(jobTitles)
        .where(
          and(
            eq(jobTitles.id, jobTitleId),
            eq(jobTitles.organization_id, organization.id)
          )
        )

      if (!existingJobTitle) {
        throw new NotFoundError('Cargo não encontrado.')
      }

      // Atualizar cargo
      const [updatedJobTitle] = await db
        .update(jobTitles)
        .set({
          ...updateData,
          updated_at: new Date(),
        })
        .where(eq(jobTitles.id, jobTitleId))
        .returning()

      return reply.send({
        jobTitle: {
          id: updatedJobTitle.id,
          name: updatedJobTitle.name,
          description: updatedJobTitle.description,
          organizationId: updatedJobTitle.organization_id,
          unitId: updatedJobTitle.unit_id,
          createdAt: updatedJobTitle.created_at,
          updatedAt: updatedJobTitle.updated_at,
        },
      })
    }
  )
}
