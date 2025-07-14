// import { auth } from '@/http/middlewares/auth'
// import { prisma } from '@/lib/prisma'
// import type { FastifyInstance } from 'fastify'
// import type { ZodTypeProvider } from 'fastify-type-provider-zod'
// import z from 'zod'
// import { BadRequestError } from '../_errors/bad-request-error'
// import { getUserPermissions } from '@/utils/get-user-permissions'
// import { UnauthorizedError } from '../_errors/unauthorized-error'
// import { roleSchema } from '@/auth/src'

import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { roleSchema } from '../../../db/auth/roles.ts'
import { auth } from '../../middlewares/auth.ts'

export const createInviteRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/units/:unitSlug/invites',
    {
      schema: {
        tags: ['invites'],
        summary: 'Create a new invite',
        security: [{ bearerAuth: [] }],
        body: z.object({
          email: z.email(),
          role: roleSchema,
        }),
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
        }),
        response: {
          201: z.object({
            inviteId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug } = request.params
      const userId = await request.getCurrentUserId()
      const { organization, membership } = await request.getUserMembership(
        organizationSlug,
        unitSlug
      )

      const { cannot } = getUserPermissions(userId, membership.role)

      if (cannot('create', 'Invite')) {
        throw new UnauthorizedError(
          'Você não possui permissão para convidar um usuário.'
        )
      }

      const { email, role } = request.body

      const [, domain] = email.split('@')

      if (
        organization.shouldAttachUsersByDomain &&
        organization.domain === domain
      ) {
        throw new BadRequestError(
          `Users with "${domain}" domain will join your organization automatically on login.`
        )
      }

      const unit = await prisma.unit.findFirst({
        where: {
          slug: unitSlug,
          organization: {
            slug: organizationSlug,
          },
        },
      })

      if (!unit) {
        throw new BadRequestError(
          'Unidade não encontrada ou não pertence à organização.'
        )
      }

      const inviteWithSameEmail = await prisma.invite.findUnique({
        where: {
          email_organizationId_unitId: {
            email,
            organizationId: organization.id,
            unitId: unit.id,
          },
        },
      })

      if (inviteWithSameEmail) {
        throw new BadRequestError('Já existe outro convite com o mesmo e-mail.')
      }

      // Verifica se já existe um membro com o mesmo e-mail na mesma unidade e organização
      const memberWithSameEmail = await prisma.member.findFirst({
        where: {
          organizationId: organization.id,
          unitId: unit.id, // Usando o id da unit verificada
          user: {
            email,
          },
        },
      })

      if (memberWithSameEmail) {
        throw new BadRequestError(
          'Um membro com este e-mail já pertence à sua organização.'
        )
      }

      const memberWithSameEmailOrgWide = await prisma.member.findFirst({
        where: {
          organizationId: organization.id,
          user: {
            email,
          },
        },
      })

      if (memberWithSameEmailOrgWide) {
        if (memberWithSameEmailOrgWide.role !== role) {
          throw new BadRequestError(
            `Este e-mail já pertence a um membro da organização com o cargo "${memberWithSameEmailOrgWide.role}". Você não pode convidar com um cargo diferente.`
          )
        }

        // Verifica se esse membro já pertence à mesma unidade
        if (memberWithSameEmailOrgWide.unitId === unit.id) {
          throw new BadRequestError(
            'Um membro com este e-mail já pertence a esta unidade da organização.'
          )
        }

        // Se é o mesmo membro na org mas não na unidade, você pode optar por permitir o convite para outra unidade, se desejar.
        // Caso NÃO queira permitir, lance erro aqui também.
        // throw new BadRequestError('Este membro já pertence à organização e não pode ser convidado para outra unidade.')
      }

      const invite = await prisma.invite.create({
        data: {
          organizationId: organization.id,
          email,
          role,
          unitId: unit.id,
          authorId: userId,
        },
      })

      return reply.status(201).send({
        inviteId: invite.id,
      })
    }
  )
}
