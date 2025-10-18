import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { jobTitles, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const deleteJobTitleRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).delete(
    '/organizations/:organizationSlug/job-titles/:jobTitleId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Job Titles'],
        summary: 'Deletar cargo/função',
        description: 'Deleta um cargo/função (o campo job_title_id dos membros será definido como null)',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          jobTitleId: z.string().uuid(),
        }),
        response: {
          204: z.void(),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, jobTitleId } = request.params
      const userId = await request.getCurrentUserId()
      const { membership } = await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('manage', 'Organization')) {
        throw new UnauthorizedError(
          'Você não possui permissão para deletar cargos.'
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

      // Deletar cargo (membros com este cargo terão job_title_id = null devido ao ON DELETE SET NULL)
      await db.delete(jobTitles).where(eq(jobTitles.id, jobTitleId))

      return reply.status(204).send()
    }
  )
}
