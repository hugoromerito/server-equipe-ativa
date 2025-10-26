import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  demands,
  members,
  organizations,
  units,
  users,
  jobTitles,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { validateMemberScheduling } from '../../utils/schedule-validation.ts'
import { logDemandStatusChange } from '../../../utils/audit-logger.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

export const assignMemberToDemandRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:organizationSlug/units/:unitSlug/demands/:demandId/assign',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Atribuir profissional à demanda',
        description: 'Atribui um profissional responsável e agenda horário para uma demanda específica',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
          demandId: z.string().uuid('ID da demanda deve ser um UUID válido'),
        }),
        body: z.object({
          responsibleId: z
            .string()
            .uuid('ID do responsável deve ser um UUID válido'),
          scheduledDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
          scheduledTime: z
            .string()
            .regex(/^\d{2}:\d{2}$/, 'Hora deve estar no formato HH:MM'),
        }),
        response: withAuthErrorResponses({
          200: z.object({
            demand: z.object({
              id: z.string().uuid(),
              title: z.string(),
              status: z.string(),
              scheduledDate: z.string(),
              scheduledTime: z.string(),
              responsible: z.object({
                id: z.string().uuid(),
                name: z.string(),
                email: z.string().email(),
                jobTitle: z.string().nullable(),
              }),
            }),
            message: z.string(),
          }),
        }),
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug, demandId } = request.params
      const { responsibleId, scheduledDate, scheduledTime } = request.body
      const userId = await request.getCurrentUserId()

      // Verificar permissões
      const { membership } = await request.getUserMembership(organizationSlug)
      const userRole = membership.organization_role === 'ADMIN' 
        ? membership.organization_role 
        : membership.unit_role ?? membership.organization_role
      
      const { cannot } = getUserPermissions(userId, userRole)

      if (cannot('update', 'Demand')) {
        throw new UnauthorizedError(
          'Você não possui permissão para atribuir profissionais às demandas.'
        )
      }

      // Verificar se a demanda existe e pertence à organização
      const [demand] = await db
        .select({
          id: demands.id,
          title: demands.title,
          status: demands.status,
          unit_id: demands.unit_id,
          responsible_id: demands.responsible_id,
        })
        .from(demands)
        .innerJoin(units, eq(demands.unit_id, units.id))
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .where(
          and(
            eq(demands.id, demandId),
            eq(units.slug, unitSlug),
            eq(organizations.slug, organizationSlug)
          )
        )
        .limit(1)

      if (!demand) {
        throw new NotFoundError('Demanda não encontrada.')
      }

      // Para ANALYST: validar ownership (só pode reatribuir suas próprias demands)
      if (userRole === 'ANALYST') {
        // Buscar o member_id do ANALYST na unidade
        const [analystMember] = await db
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.user_id, userId),
              eq(members.unit_id, demand.unit_id)
            )
          )
          .limit(1)

        if (!analystMember) {
          throw new UnauthorizedError('Você não é membro desta unidade.')
        }

        // Se a demand já tem um responsável e não é ele mesmo, bloquear
        if (demand.responsible_id && demand.responsible_id !== analystMember.id) {
          throw new UnauthorizedError(
            'Você só pode gerenciar suas próprias demandas.'
          )
        }
      }

      // Verificar se a demanda não está finalizada
      if (['RESOLVED', 'REJECTED', 'BILLED'].includes(demand.status)) {
        throw new BadRequestError('Não é possível atribuir profissional a uma demanda finalizada.')
      }

      // Verificar se o profissional responsável existe na unidade
      const [responsibleMember] = await db
        .select({
          id: members.id,
          user_id: members.user_id,
          working_days: members.working_days,
        })
        .from(members)
        .where(
          and(
            eq(members.id, responsibleId),
            eq(members.unit_id, demand.unit_id)
          )
        )
        .limit(1)

      if (!responsibleMember) {
        throw new BadRequestError('Profissional não encontrado nesta unidade.')
      }

      // Validar disponibilidade do profissional
      const validation = await validateMemberScheduling(
        responsibleId,
        responsibleMember.working_days,
        scheduledDate,
        scheduledTime,
        demandId // Exclui a demanda atual se já estiver agendada
      )

      if (!validation.available) {
        if (validation.reason === 'schedule-conflict') {
          throw new BadRequestError(
            `O profissional já possui um agendamento neste horário (${scheduledDate} às ${scheduledTime}).`
          )
        }
        if (validation.reason === 'not-working-day') {
          throw new BadRequestError('O profissional não trabalha neste dia da semana.')
        }
      }

      // Buscar dados completos do usuário e job title
      const [memberWithDetails] = await db
        .select({
          userId: members.user_id,
          userName: users.name,
          userEmail: users.email,
          jobTitleName: jobTitles.name,
        })
        .from(members)
        .innerJoin(users, eq(members.user_id, users.id))
        .leftJoin(jobTitles, eq(members.job_title_id, jobTitles.id))
        .where(eq(members.id, responsibleId))
        .limit(1)

      // Atualizar a demanda com o agendamento
      const previousStatus = demand.status
      const newStatus = demand.status === 'PENDING' ? 'IN_PROGRESS' : demand.status
      
      const [updatedDemand] = await db
        .update(demands)
        .set({
          responsible_id: responsibleId,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          status: newStatus,
          updated_at: new Date(),
        })
        .where(eq(demands.id, demandId))
        .returning({
          id: demands.id,
          title: demands.title,
          status: demands.status,
        })

      if (!updatedDemand) {
        throw new NotFoundError('Falha ao atualizar a demanda.')
      }

      // Registrar auditoria se o status mudou
      if (previousStatus !== newStatus) {
        const [currentUser] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        const userRole = membership.organization_role === 'ADMIN' 
          ? membership.organization_role 
          : membership.unit_role ?? membership.organization_role

        await logDemandStatusChange({
          demandId,
          previousStatus,
          newStatus,
          changedByUserId: userId,
          changedByMemberId: membership.id ?? null,
          changedByUserName: currentUser?.name ?? null,
          changedByRole: userRole,
          reason: `Profissional atribuído: ${memberWithDetails?.userName}`,
          metadata: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            responsibleId,
            scheduledDate,
            scheduledTime,
          },
        })
      }

      return reply.send({
        demand: {
          id: updatedDemand.id,
          title: updatedDemand.title,
          status: updatedDemand.status,
          scheduledDate,
          scheduledTime,
          responsible: {
            id: responsibleId,
            name: memberWithDetails?.userName || 'Usuário não encontrado',
            email: memberWithDetails?.userEmail || '',
            jobTitle: memberWithDetails?.jobTitleName || null,
          },
        },
        message: `Profissional ${memberWithDetails?.userName} foi atribuído à demanda para ${scheduledDate} às ${scheduledTime}.`,
      })
    }
  )
}