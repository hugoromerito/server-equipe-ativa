import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { isCPF } from 'validation-br'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, organizations } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'

export const getCheckApplicantRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/applicant',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Applicants'],
        summary: 'Check if applicant exists by CPF within an organization',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        querystring: z.object({
          cpf: z.string(),
        }),
        response: {
          200: z.object({
            exists: z.boolean(),
            applicant: z.object({
              id: z.string().uuid(),
              name: z.string(),
            }).optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug } = request.params
      const { cpf } = request.query
      const userId = await request.getCurrentUserId()

      // Normalizar CPF
      const normalizedCpf = cpf.replace(/\D/g, '')

      if (!isCPF(normalizedCpf)) {
        throw new BadRequestError('CPF inválido.')
      }

      // Verificar se a organização existe e obter membership
      try {
        const { organization, membership } = await request.getUserMembership(organizationSlug)

        // Verificar permissões
        const { cannot } = getUserPermissions(
          userId,
          membership.unit_role || membership.organization_role
        )

        if (cannot('get', 'Applicant')) {
          throw new ForbiddenError(
            'Você não possui permissão para verificar solicitantes.'
          )
        }

        // Buscar o applicant vinculado à organização e ao CPF
        const applicant = await db
          .select({
            id: applicants.id,
            name: applicants.name,
          })
          .from(applicants)
          .where(
            and(
              eq(applicants.cpf, normalizedCpf),
              eq(applicants.organization_id, organization.id)
            )
          )
          .limit(1)
          .then((rows) => rows[0])

        if (!applicant) {
          return reply.status(200).send({
            exists: false,
          })
        }

        return reply.status(200).send({
          exists: true,
          applicant: {
            id: applicant.id,
            name: applicant.name,
          },
        })
      } catch (error) {
        if (error instanceof Error && error.message.includes('Organization not found')) {
          throw new NotFoundError('Organização não encontrada.')
        }
        throw error
      }
    }
  )
}
