import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { jobTitles, members } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'

export const updateMemberJobTitleRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:slug/members/:memberId/job-title',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Atualizar cargo/função do membro',
        description: 'Atualiza o cargo/função (job title) de um membro da organização',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          memberId: z.string().uuid(),
        }),
        body: z.object({
          jobTitleId: z.string().uuid().nullable(),
        }),
        response: withAuthErrorResponses({
          200: z.object({
            member: z.object({
              id: z.string().uuid(),
              jobTitleId: z.string().uuid().nullable(),
              jobTitleName: z.string().nullable(),
            }),
          }),
        }),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { slug, memberId } = request.params
      const { jobTitleId } = request.body

      // Verificar permissões
      const { membership } = await request.getUserMembership(slug)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('update', 'User')) {
        throw new BadRequestError(
          'Você não tem permissão para atualizar membros.'
        )
      }

      // Buscar membro
      const [member] = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.id, memberId),
            eq(members.organization_id, membership.organization_id)
          )
        )
        .limit(1)

      if (!member) {
        throw new NotFoundError('Membro não encontrado.')
      }

      // Se jobTitleId foi fornecido, verificar se ele existe e pertence à organização
      if (jobTitleId) {
        const [jobTitle] = await db
          .select()
          .from(jobTitles)
          .where(
            and(
              eq(jobTitles.id, jobTitleId),
              eq(jobTitles.organization_id, membership.organization_id)
            )
          )
          .limit(1)

        if (!jobTitle) {
          throw new BadRequestError(
            'Cargo não encontrado ou não pertence a esta organização.'
          )
        }
      }

      // Atualizar cargo do membro
      await db
        .update(members)
        .set({
          job_title_id: jobTitleId,
        })
        .where(eq(members.id, memberId))

      // Buscar nome do cargo (se houver)
      let jobTitleName = null
      if (jobTitleId) {
        const [jobTitle] = await db
          .select({ name: jobTitles.name })
          .from(jobTitles)
          .where(eq(jobTitles.id, jobTitleId))
          .limit(1)
        
        jobTitleName = jobTitle?.name || null
      }

      return reply.status(200).send({
        member: {
          id: memberId,
          jobTitleId,
          jobTitleName,
        },
      })
    }
  )
}
