import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { isCPF } from 'validation-br'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const getCheckApplicantRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/applicant',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Applicants'],
        summary: 'Get applicant by CPF within an organization',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        body: z.object({
          cpf: z.string(),
        }),
        response: {
          200: z.object({
            id: z.string().uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug } = request.params
      const { cpf } = request.body

      if (!isCPF(cpf)) {
        throw new BadRequestError('CPF inválido.')
      }

      // Busca a organização pelo slug
      const organization = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1)
        .then((rows) => rows[0])

      if (!organization) {
        throw new BadRequestError('Organização não encontrada.')
      }

      await request.getUserMembership(organizationSlug)

      // Busca o applicant vinculado à organização e ao CPF
      const applicant = await db
        .select()
        .from(applicants)
        .where(
          and(
            eq(applicants.cpf, cpf),
            eq(applicants.organization_id, organization.id)
          )
        )
        .limit(1)
        .then((rows) => rows[0])

      if (!applicant) {
        throw new BadRequestError('CPF não cadastrado nesta organização.')
      }

      return reply.status(200).send({
        id: applicant.id,
      })
    }
  )
}
