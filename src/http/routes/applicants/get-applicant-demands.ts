import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, demands, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'

export const getApplicantDemandsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/applicant/:applicantSlug/demands',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Applicants'],
        summary: 'Listar demandas do solicitante',
        description: 'Retorna todas as demandas de um solicitante específico',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          applicantSlug: z.string(),
        }),
        response: {
          200: z.object({
            demands: z.array(
              z.object({
                id: z.uuid(),
                title: z.string(),
                description: z.string().nullable(),
                status: z.string(),
                priority: z.string(),
                category: z.string(),
                created_at: z.date(),
                updated_at: z.date().nullable(),
              })
            ),
            applicant: z.object({
              id: z.uuid(),
              name: z.string(),
              phone: z.string(),
              birthdate: z.date(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { organizationSlug, applicantSlug } = request.params

      const userId = await request.getCurrentUserId()
      const { organization, membership } = await request.getUserMembership(organizationSlug)
      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('get', 'Applicant')) {
        throw new ForbiddenError('Insufficient permissions to view applicants')
      }

      const applicant = await db.query.applicants.findFirst({
        where: and(
          eq(applicants.id, applicantSlug),
          eq(applicants.organization_id, organization.id)
        ),
        columns: {
          id: true,
          name: true,
          phone: true,
          birthdate: true,
        },
      })

      if (!applicant) {
        throw new NotFoundError('Applicant not found')
      }

      const applicantDemands = await db.query.demands.findMany({
        where: eq(demands.applicant_id, applicantSlug),
        columns: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          category: true,
          created_at: true,
          updated_at: true,
        },
      })

      return {
        demands: applicantDemands,
        applicant: {
          ...applicant,
          birthdate: new Date(applicant.birthdate),
        },
      }
    }
  )
}
