import { and, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  demandCategoryZodEnum,
  demandPriorityZodEnum,
  demandStatusZodEnum,
} from '../../../db/schema/enums.ts'
import {
  applicants,
  demands,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const getDemandRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/units/:unitSlug/demands/:demandId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Obter detalhes da demanda',
        description: 'Retorna informações detalhadas de uma demanda específica na unidade',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
          demandId: z.string(), // Aceita UUID
        }),
        response: {
          200: z.object({
            demand: z.object({
              id: z.uuid(),
              title: z.string(),
              description: z.string(),
              status: demandStatusZodEnum,
              priority: demandPriorityZodEnum,
              category: demandCategoryZodEnum,
              scheduledDate: z.string().nullable(),
              scheduledTime: z.string().nullable(),
              responsibleId: z.string().uuid().nullable(),
              createdAt: z.date(),
              updatedAt: z.date().nullable(),

              owner: z
                .object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                  email: z.email(),
                  avatarUrl: z.url().nullable(),
                })
                .nullable(),

              unit: z.object({
                id: z.uuid(),
                name: z.string(),
                slug: z.string(),
                organization: z.object({
                  id: z.uuid(),
                  name: z.string(),
                  slug: z.string(),
                  avatarUrl: z.url().nullable(),
                }),
              }),

              applicant: z.object({
                id: z.uuid(),
                name: z.string(),
                birthdate: z.date(),
                avatarUrl: z.url().nullable(),
                phone: z.string(),
              }),

              member: z
                .object({
                  user: z.object({
                    id: z.uuid(),
                    name: z.string().nullable(),
                    email: z.email(),
                    avatarUrl: z.url().nullable(),
                  }),
                })
                .nullable(),
            }),
          }),
        },
      },
    },
    async (request, _reply) => {
      const { organizationSlug, unitSlug, demandId } = request.params
      const userId = await request.getCurrentUserId()

      const { membership } = await request.getUserMembership(organizationSlug)
      const userRole = membership.unit_role || membership.organization_role

      const { cannot } = getUserPermissions(userId, userRole)

      if (cannot('get', 'Demand')) {
        throw new UnauthorizedError(
          'Você não possui permissão para visualizar as demandas.'
        )
      }

      // Verificar se a unidade existe na organização
      const unit = await db
        .select()
        .from(units)
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .where(
          and(
            eq(units.slug, unitSlug),
            eq(organizations.slug, organizationSlug)
          )
        )
        .limit(1)

      if (unit.length === 0) {
        throw new BadRequestError('Unidade não encontrada na organização.')
      }

      // Buscar a demanda com todos os relacionamentos
      const ownerUsers = alias(users, 'owner_users')
      const memberUsers = alias(users, 'member_users')

      // Buscar a demanda com todos os relacionamentos
      const demandResult = await db
        .select({
          // Campos da demanda
          id: demands.id,
          title: demands.title,
          description: demands.description,
          status: demands.status,
          priority: demands.priority,
          category: demands.category,
          scheduledDate: demands.scheduled_date,
          scheduledTime: demands.scheduled_time,
          responsibleId: demands.responsible_id,
          createdAt: demands.created_at,
          updatedAt: demands.updated_at,

          // Owner (pode ser null)
          ownerId: ownerUsers.id,
          ownerName: ownerUsers.name,
          ownerEmail: ownerUsers.email,
          ownerAvatarUrl: ownerUsers.avatar_url,

          // Unit
          unitId: units.id,
          unitName: units.name,
          unitSlug: units.slug,

          // Organization
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationSlug: organizations.slug,
          organizationAvatarUrl: organizations.avatar_url,

          // Applicant
          applicantId: applicants.id,
          applicantName: applicants.name,
          applicantBirthdate: applicants.birthdate,
          applicantAvatarUrl: applicants.avatar_url,
          applicantPhone: applicants.phone,

          // Member user (pode ser null)
          memberUserId: memberUsers.id,
          memberUserName: memberUsers.name,
          memberUserEmail: memberUsers.email,
          memberUserAvatarUrl: memberUsers.avatar_url,
        })
        .from(demands)
        .innerJoin(units, eq(demands.unit_id, units.id))
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .innerJoin(applicants, eq(demands.applicant_id, applicants.id))
        .leftJoin(ownerUsers, eq(demands.owner_id, ownerUsers.id))
        .leftJoin(members, eq(demands.member_id, members.id))
        .leftJoin(memberUsers, eq(members.user_id, memberUsers.id))
        .where(
          and(
            eq(demands.id, demandId), // Busca diretamente por ID (UUID)
            eq(units.slug, unitSlug),
            eq(organizations.slug, organizationSlug)
          )
        )
        .limit(1)

      if (demandResult.length === 0) {
        throw new NotFoundError('Demanda não encontrada.')
      }

      const demandData = demandResult[0]

      // Para ANALYST: validar ownership (só pode ver suas próprias demands)
      if (userRole === 'ANALYST') {
        // Buscar o member_id do ANALYST na unidade
        const [member] = await db
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.user_id, userId),
              eq(members.unit_id, unit[0].units.id)
            )
          )
          .limit(1)

        if (!member) {
          throw new UnauthorizedError(
            'Você não é membro desta unidade.'
          )
        }

        // Verificar se a demand está atribuída a ele
        if (demandData.responsibleId !== member.id) {
          throw new UnauthorizedError(
            'Você só pode visualizar suas próprias demandas.'
          )
        }
      }

      // Estruturar a resposta conforme o schema
      const demand = {
        id: demandData.id,
        title: demandData.title,
        description: demandData.description,
        status: demandData.status,
        priority: demandData.priority,
        category: demandData.category,
        scheduledDate: demandData.scheduledDate,
        scheduledTime: demandData.scheduledTime,
        responsibleId: demandData.responsibleId,
        createdAt: new Date(demandData.createdAt),
        updatedAt: demandData.updatedAt ? new Date(demandData.updatedAt) : null,

        owner: demandData.ownerId
          ? {
              id: demandData.ownerId,
              name: demandData.ownerName,
              email: demandData.ownerEmail as string,
              avatarUrl: demandData.ownerAvatarUrl,
            }
          : null,

        unit: {
          id: demandData.unitId,
          name: demandData.unitName,
          slug: demandData.unitSlug,
          organization: {
            id: demandData.organizationId,
            name: demandData.organizationName,
            slug: demandData.organizationSlug,
            avatarUrl: demandData.organizationAvatarUrl,
          },
        },

        applicant: {
          id: demandData.applicantId,
          name: demandData.applicantName,
          birthdate: new Date(demandData.applicantBirthdate),
          avatarUrl: demandData.applicantAvatarUrl,
          phone: demandData.applicantPhone,
        },

        member: demandData.memberUserId
          ? {
              user: {
                id: demandData.memberUserId,
                name: demandData.memberUserName,
                email: demandData.memberUserEmail as string,
                avatarUrl: demandData.memberUserAvatarUrl,
              },
            }
          : null,
      }

      return { demand }
    }
  )
}
