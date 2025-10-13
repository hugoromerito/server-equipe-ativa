import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'

export const getApplicantRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/applicant/:applicantSlug',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Applicants'],
        summary: 'Obter detalhes do solicitante',
        description: 'Retorna informações detalhadas de um solicitante específico',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          applicantSlug: z.string(),
        }),
        response: {
          200: z.object({
            applicant: z.object({
              id: z.uuid(),
              name: z.string(),
              birthdate: z.date(),
              phone: z.string(),
              cpf: z.string(),
              ticket: z.string().nullable(),
              mother: z.string().nullable(),
              father: z.string().nullable(),
              observation: z.string().nullable(),
              created_at: z.date(),
              updated_at: z.date().nullable(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { organizationSlug, applicantSlug } = request.params
      const userId = await request.getCurrentUserId()

      // Verificar se a organização existe e obter membership
      const { organization, membership } = await request.getUserMembership(organizationSlug)

      // Verificar permissões
      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('get', 'Applicant')) {
        throw new ForbiddenError(
          'Você não possui permissão para visualizar solicitantes.'
        )
      }

      // Buscar o solicitante
      const applicant = await db
        .select({
          id: applicants.id,
          name: applicants.name,
          birthdate: applicants.birthdate,
          phone: applicants.phone,
          cpf: applicants.cpf,
          ticket: applicants.ticket,
          sus_card: applicants.sus_card,
          mother: applicants.mother,
          father: applicants.father,
          zip_code: applicants.zip_code,
          state: applicants.state,
          city: applicants.city,
          street: applicants.street,
          neighborhood: applicants.neighborhood,
          complement: applicants.complement,
          number: applicants.number,
          observation: applicants.observation,
          created_at: applicants.created_at,
          updated_at: applicants.updated_at,
        })
        .from(applicants)
        .where(
          and(
            eq(applicants.id, applicantSlug),
            eq(applicants.organization_id, organization.id)
          )
        )
        .limit(1)

      if (!applicant[0]) {
        throw new NotFoundError('Solicitante não encontrado.')
      }

      return {
        applicant: {
          id: applicant[0].id,
          name: applicant[0].name,
          birthdate: new Date(applicant[0].birthdate),
          phone: applicant[0].phone,
          cpf: applicant[0].cpf,
          ticket: applicant[0].ticket,
          sus_card: applicant[0].sus_card,
          mother: applicant[0].mother,
          father: applicant[0].father,
          zip_code: applicant[0].zip_code,
          state: applicant[0].state,
          city: applicant[0].city,
          street: applicant[0].street,
          neighborhood: applicant[0].neighborhood,
          complement: applicant[0].complement,
          number: applicant[0].number,
          observation: applicant[0].observation,
          created_at: applicant[0].created_at,
          updated_at: applicant[0].updated_at,
        },
      }
    }
  )
}
