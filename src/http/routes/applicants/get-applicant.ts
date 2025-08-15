import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const getApplicantRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/applicant/:applicantSlug',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Applicants'],
        summary: 'Get applicant.',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          applicantSlug: z.string(),
        }),
        response: {
          200: z.object({
            id: z.uuid(),
            name: z.string(),
            birthdate: z.date(),
          }),
        },
      },
    },
    async (request) => {
      const { organizationSlug, applicantSlug } = request.params

      const organization = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1)

      if (!organization[0]) {
        throw new BadRequestError('Organização não encontrada.')
      }

      const applicant = await db
        .select({
          id: applicants.id,
          name: applicants.name,
          birthdate: applicants.birthdate,
        })
        .from(applicants)
        .where(
          and(
            eq(applicants.id, applicantSlug),
            eq(applicants.organization_id, organization[0].id)
          )
        )
        .limit(1)

      if (!applicant[0]) {
        throw new BadRequestError('Solicitante não encontrado.')
      }

      return {
        id: applicant[0].id,
        name: applicant[0].name,
        birthdate: new Date(applicant[0].birthdate),
      }
    }
  )
}
