import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, demands, organizations } from '../../../db/schema/index.ts'
import { auth } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const getApplicantDemandsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/applicant/:applicantSlug/demands',
    {
      schema: {
        tags: ['applicants'],
        summary: 'Get demands of applicant.',
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
        .then((rows) => rows[0])

      if (!organization) {
        throw new BadRequestError('Organização não encontrada.')
      }

      // Busca o applicant com suas demands usando leftJoin
      const result = await db
        .select({
          id: applicants.id,
          name: applicants.name,
          birthdate: applicants.birthdate,
          phone: applicants.phone,
          demandId: demands.id,
          demandTitle: demands.title,
          demandStatus: demands.status,
        })
        .from(applicants)
        .leftJoin(demands, eq(demands.applicant_id, applicants.id))
        .where(
          and(
            eq(applicants.id, applicantSlug),
            eq(applicants.organization_id, organization.id)
          )
        )

      if (result.length === 0) {
        throw new BadRequestError('Solicitante não encontrado.')
      }

      // Agrupa os resultados para estruturar as demands
      const applicant = {
        id: result[0].id,
        name: result[0].name,
        birthdate: new Date(result[0].birthdate),
        phone: result[0].phone,
        demands: result
          .filter(
            (row) =>
              row.demandId !== null &&
              row.demandTitle !== null &&
              row.demandStatus !== null
          )
          .map((row) => ({
            id: row.demandId as string,
            title: row.demandTitle as string,
            status: row.demandStatus as string,
          })),
      }

      return applicant
    }
  )
}
