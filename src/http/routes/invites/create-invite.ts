import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { roleZodEnum } from '../../../db/schema/enums.ts'
import {
  invites,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts' // Ajuste o caminho conforme necessário
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// Função auxiliar para buscar organização
async function getOrganizationBySlug(slug: string) {
  const organization = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1)

  if (!organization[0]) {
    throw new BadRequestError('Organização não encontrada.')
  }

  return organization[0]
}

// Função auxiliar para verificar membership
async function getUserMembership(userId: string, organizationId: string) {
  const membership = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.user_id, userId),
        eq(members.organization_id, organizationId)
      )
    )
    .limit(1)

  if (!membership[0]) {
    throw new UnauthorizedError('Você não pertence a esta organização.')
  }

  return membership[0]
}

// Função auxiliar para verificar domínio automático
function checkAutomaticDomain(
  org: typeof organizations.$inferSelect,
  email: string
) {
  const [, domain] = email.split('@')

  if (org.should_attach_users_by_domain && org.domain === domain) {
    throw new BadRequestError(
      `Users with "${domain}" domain will join your organization automatically on login.`
    )
  }
}

// Função auxiliar para buscar unidade
async function getUnitBySlug(unitSlug: string, organizationId: string) {
  const unitResult = await db
    .select()
    .from(units)
    .where(
      and(eq(units.slug, unitSlug), eq(units.organization_id, organizationId))
    )
    .limit(1)

  if (!unitResult[0]) {
    throw new BadRequestError(
      'Unidade não encontrada ou não pertence à organização.'
    )
  }

  return unitResult[0]
}

// Função auxiliar para verificar convite existente
async function checkExistingInvite(
  email: string,
  organizationId: string,
  unitId: string | null
) {
  const conditions = [
    eq(invites.email, email),
    eq(invites.organization_id, organizationId),
    unitId ? eq(invites.unit_id, unitId) : isNull(invites.unit_id),
  ]

  const existingInvite = await db
    .select()
    .from(invites)
    .where(and(...conditions))
    .limit(1)

  if (existingInvite[0]) {
    throw new BadRequestError(
      unitId
        ? 'Já existe outro convite com o mesmo e-mail para esta unidade.'
        : 'Já existe outro convite com o mesmo e-mail para esta organização.'
    )
  }
}

// Função auxiliar para verificar membro existente para convite de unidade
async function checkExistingMemberForUnit(
  email: string,
  organizationId: string,
  unitId: string,
  role: string
) {
  const memberInUnit = await db
    .select({
      id: members.id,
      organization_role: members.organization_role,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.user_id))
    .where(
      and(
        eq(users.email, email),
        eq(members.organization_id, organizationId),
        eq(members.unit_id, unitId)
      )
    )
    .limit(1)

  if (memberInUnit[0]) {
    throw new BadRequestError(
      'Um membro com este e-mail já pertence a esta unidade.'
    )
  }

  // Verificar se já é membro da organização
  const memberInOrg = await db
    .select({
      id: members.id,
      organization_role: members.organization_role,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.user_id))
    .where(
      and(eq(users.email, email), eq(members.organization_id, organizationId))
    )
    .limit(1)

  if (memberInOrg[0] && memberInOrg[0].organization_role !== role) {
    throw new BadRequestError(
      `Este usuário já é membro da organização com o cargo "${memberInOrg[0].organization_role}". Para convidar para uma unidade, use o mesmo cargo.`
    )
  }
}

// Função auxiliar para verificar membro existente para convite de organização
async function checkExistingMemberForOrganization(
  email: string,
  organizationId: string
) {
  const memberInOrg = await db
    .select({
      id: members.id,
      organization_role: members.organization_role,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.user_id))
    .where(
      and(eq(users.email, email), eq(members.organization_id, organizationId))
    )
    .limit(1)

  if (memberInOrg[0]) {
    throw new BadRequestError(
      'Um membro com este e-mail já pertence à organização.'
    )
  }
}

export const createInviteRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/invites',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Invites'],
        summary: 'Create a new invite for organization or unit',
        security: [{ bearerAuth: [] }],
        body: z.object({
          email: z.email(),
          role: roleZodEnum,
          unitSlug: z.string().optional(),
        }),
        params: z.object({
          organizationSlug: z.string(),
        }),
        response: {
          201: z.object({
            inviteId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug } = request.params
      const userId = await request.getCurrentUserId()
      const { email, role, unitSlug } = request.body

      // Buscar organização
      const org = await getOrganizationBySlug(organizationSlug)

      // Verificar membership e permissões
      const membership = await getUserMembership(userId, org.id)
      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role
      )

      if (cannot('create', 'Invite')) {
        throw new UnauthorizedError(
          'Você não possui permissão para convidar um usuário.'
        )
      }

      // Verificar domínio automático
      checkAutomaticDomain(org, email)

      // Processar unidade se fornecida
      let unitId: string | null = null
      if (unitSlug) {
        const unit = await getUnitBySlug(unitSlug, org.id)
        unitId = unit.id
      }

      // Verificar convite existente
      await checkExistingInvite(email, org.id, unitId)

      // Verificar membro existente
      if (unitId) {
        await checkExistingMemberForUnit(email, org.id, unitId, role)
      } else {
        await checkExistingMemberForOrganization(email, org.id)
      }

      // Criar o convite
      const newInvite = await db
        .insert(invites)
        .values({
          organization_id: org.id,
          email,
          role,
          unit_id: unitId,
          author_id: userId,
        })
        .returning({ id: invites.id })

      return reply.status(201).send({
        inviteId: newInvite[0].id,
      })
    }
  )
}
