import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  demandStatusZodEnum,
  demandPriorityZodEnum,
  demands,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { validateMemberScheduling } from '../../utils/schedule-validation.ts'
import { 
  isValidStatusTransition, 
  getStatusTransitionErrorMessage 
} from '../../utils/validate-demand-status.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'
import { emitToUnit } from '../../../lib/socket-server.ts'
import { applicants } from '../../../db/schema/demands.ts'
import { jobTitles } from '../../../db/schema/job-titles.ts'
import type { PatientCalledData } from '../../../types/socket.ts'

export const updateDemandRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/organizations/:organizationSlug/units/:unitSlug/demands/:demandId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Atualizar demanda',
        description: 'Atualiza status da demanda e membro responsável',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          unitSlug: z.string(),
          demandId: z.string(), // Aceita UUID
        }),
        body: z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          priority: demandPriorityZodEnum.optional(),
          status: demandStatusZodEnum.optional(),
          scheduledDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
            .nullable()
            .optional(),
          scheduledTime: z
            .string()
            .regex(/^\d{2}:\d{2}$/, 'Hora deve estar no formato HH:MM')
            .nullable()
            .optional(),
          responsibleId: z
            .string()
            .uuid('ID do responsável deve ser um UUID válido')
            .nullable()
            .optional(),
        }),
        response: {
          200: z.object({
            demand: z.object({
              id: z.string(),
              title: z.string(),
              description: z.string(),
              priority: demandPriorityZodEnum,
              status: demandStatusZodEnum,
              scheduledDate: z.string().nullable(),
              scheduledTime: z.string().nullable(),
              responsibleId: z.string().nullable(),
              updatedAt: z.date().nullable(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, unitSlug, demandId } = request.params
      const userId = await request.getCurrentUserId()
      const updateData = request.body
      const { membership } = await request.getUserMembership(organizationSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.organization_role === 'ADMIN' 
          ? membership.organization_role 
          : membership.unit_role ?? membership.organization_role
      )

      if (cannot('update', 'Demand')) {
        throw new UnauthorizedError(
          'Você não possui permissão para atualizar esta demanda.'
        )
      }

      // Verificar se a demanda existe e pertence à organização
      const [demand] = await db
        .select({
          id: demands.id,
          title: demands.title,
          description: demands.description,
          priority: demands.priority,
          status: demands.status,
          scheduled_date: demands.scheduled_date,
          scheduled_time: demands.scheduled_time,
          responsible_id: demands.responsible_id,
          updated_at: demands.updated_at,
          unit_id: demands.unit_id,
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

      if (!demand) {
        throw new NotFoundError('Demanda não encontrada.')
      }

      // Validar transição de status se um novo status foi fornecido
      if (updateData.status && updateData.status !== demand.status) {
        if (!isValidStatusTransition(demand.status, updateData.status)) {
          throw new BadRequestError(
            getStatusTransitionErrorMessage(demand.status, updateData.status)
          )
        }
      }

      // Validar agendamento se há mudanças nos campos relacionados
      const { scheduledDate, scheduledTime, responsibleId } = updateData
      
      // Verificar se há dados de agendamento completos
      if (responsibleId || scheduledDate || scheduledTime) {
        const finalResponsibleId = responsibleId ?? demand.responsible_id
        const finalScheduledDate = scheduledDate ?? demand.scheduled_date
        const finalScheduledTime = scheduledTime ?? demand.scheduled_time

        // Se há responsável e agendamento, validar
        if (finalResponsibleId && finalScheduledDate && finalScheduledTime) {
          // Buscar dados do membro responsável
          const [responsibleMember] = await db
            .select({
              id: members.id,
              working_days: members.working_days,
            })
            .from(members)
            .where(
              and(
                eq(members.id, finalResponsibleId),
                eq(members.unit_id, demand.unit_id)
              )
            )
            .limit(1)

          if (!responsibleMember) {
            throw new BadRequestError('Profissional responsável não encontrado nesta unidade.')
          }

          // Validar disponibilidade (excluindo a demanda atual)
          const validation = await validateMemberScheduling(
            finalResponsibleId,
            responsibleMember.working_days,
            finalScheduledDate,
            finalScheduledTime,
            demandId // Exclui a demanda atual da verificação
          )

          if (!validation.available) {
            if (validation.reason === 'schedule-conflict') {
              throw new BadRequestError(
                `O profissional já possui um agendamento neste horário (${finalScheduledDate} às ${finalScheduledTime}).`
              )
            }
            if (validation.reason === 'not-working-day') {
              throw new BadRequestError('O profissional não trabalha neste dia da semana.')
            }
          }
        }

        // Se há data/hora mas não há responsável, limpar os campos de agendamento
        if ((scheduledDate || scheduledTime) && !finalResponsibleId) {
          throw new BadRequestError('É necessário especificar um profissional responsável para agendar a demanda.')
        }
      }

      // Atualizar a demanda
      const [updatedDemand] = await db
        .update(demands)
        .set({
          ...updateData,
          scheduled_date: updateData.scheduledDate,
          scheduled_time: updateData.scheduledTime,
          responsible_id: updateData.responsibleId,
          updated_at: new Date(),
        })
        .where(eq(demands.id, demandId))
        .returning()

      if (!updatedDemand) {
        throw new NotFoundError('Demanda não encontrada.')
      }

      // Emitir evento WebSocket se o status mudou para "IN_PROGRESS"
      if (updateData.status === 'IN_PROGRESS' && demand.status !== 'IN_PROGRESS') {
        // Buscar dados completos para o evento WebSocket
        const [demandData] = await db
          .select({
            demandId: demands.id,
            patientName: applicants.name,
            memberName: users.name,
            jobTitle: jobTitles.name,
            status: demands.status,
            priority: demands.priority,
            unitId: units.id,
            unitSlug: units.slug,
            organizationId: organizations.id,
            organizationSlug: organizations.slug,
          })
          .from(demands)
          .innerJoin(applicants, eq(demands.applicant_id, applicants.id))
          .innerJoin(units, eq(demands.unit_id, units.id))
          .innerJoin(organizations, eq(units.organization_id, organizations.id))
          .leftJoin(members, eq(demands.responsible_id, members.id))
          .leftJoin(users, eq(members.user_id, users.id))
          .leftJoin(jobTitles, eq(members.job_title_id, jobTitles.id))
          .where(eq(demands.id, demandId))
          .limit(1)

        if (demandData) {
          const patientCalledData: PatientCalledData = {
            demandId: demandData.demandId,
            patientName: demandData.patientName,
            memberName: demandData.memberName || 'Não atribuído',
            jobTitle: demandData.jobTitle,
            status: demandData.status,
            priority: demandData.priority,
            calledAt: new Date(),
            unitId: demandData.unitId,
            unitSlug: demandData.unitSlug,
            organizationId: demandData.organizationId,
          }

          // Emitir evento para a unidade
          emitToUnit(
            demandData.organizationSlug,
            demandData.unitSlug,
            'patient-called',
            patientCalledData
          )
        }
      }

      return reply.send({
        demand: {
          id: updatedDemand.id,
          title: updatedDemand.title,
          description: updatedDemand.description,
          priority: updatedDemand.priority,
          status: updatedDemand.status,
          scheduledDate: updatedDemand.scheduled_date,
          scheduledTime: updatedDemand.scheduled_time,
          responsibleId: updatedDemand.responsible_id,
          updatedAt: updatedDemand.updated_at || null,
        },
      })
    }
  )
}
