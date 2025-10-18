import { and, eq, sql } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { demands, jobTitles, members, units, users } from '../../../db/schema/index.ts'
import { DEMAND_CATEGORY_VALUES } from '../../../db/schema/enums.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'

/**
 * Retorna o dia da semana (0-6) para uma data no formato YYYY-MM-DD
 * 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
 */
function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString + 'T12:00:00') // Usar meio-dia para evitar problemas de timezone
  return date.getDay()
}

export const getAvailableMembersRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/units/:unitSlug/members/available',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Buscar membros disponíveis',
        description:
          'Retorna membros disponíveis para atendimento em uma data/hora específica, considerando categoria profissional e agendamentos existentes',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          unitSlug: z.string(),
        }),
        querystring: z.object({
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
          time: z
            .string()
            .regex(/^\d{2}:\d{2}$/, 'Hora deve estar no formato HH:MM'),
          category: z.enum(DEMAND_CATEGORY_VALUES).optional(),
        }),
        response: withAuthErrorResponses({
          200: z.object({
            availableMembers: z.array(
              z.object({
                id: z.string().uuid(),
                userId: z.string().uuid(),
                userName: z.string(),
                userEmail: z.string().email(),
                userAvatarUrl: z.string().nullable(),
                jobTitleId: z.string().uuid().nullable(),
                jobTitleName: z.string().nullable(),
                workingDays: z.array(z.number()).nullable(),
                hasConflict: z.boolean(),
              })
            ),
            searchCriteria: z.object({
              date: z.string(),
              time: z.string(),
              dayOfWeek: z.number(),
              dayOfWeekName: z.string(),
              category: z.string().optional(),
            }),
          }),
        }),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { slug, unitSlug } = request.params
      const { date, time, category } = request.query

      // Verificar permissões
      await request.getUserMembership(slug, unitSlug)

      // Buscar unidade
      const [unit] = await db
        .select({ id: units.id })
        .from(units)
        .where(eq(units.slug, unitSlug))
        .limit(1)

      if (!unit) {
        throw new NotFoundError('Unidade não encontrada.')
      }

      // Calcular dia da semana
      const dayOfWeek = getDayOfWeek(date)
      const dayNames = [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
      ]

      // Buscar todos os membros da unidade com suas informações
      let query = db
        .select({
          id: members.id,
          userId: members.user_id,
          userName: users.name,
          userEmail: users.email,
          userAvatarUrl: users.avatar_url,
          jobTitleId: members.job_title_id,
          jobTitleName: jobTitles.name,
          workingDays: members.working_days,
        })
        .from(members)
        .innerJoin(users, eq(members.user_id, users.id))
        .leftJoin(jobTitles, eq(members.job_title_id, jobTitles.id))
        .where(eq(members.unit_id, unit.id))

      const allMembers = await query

      // Filtrar membros por categoria se especificado
      let filteredByCategory = allMembers
      if (category) {
        // Buscar job titles que correspondem à categoria
        const relevantJobTitles = await db
          .select({ id: jobTitles.id })
          .from(jobTitles)
          .where(eq(jobTitles.name, category))

        const relevantJobTitleIds = new Set(
          relevantJobTitles.map((jt) => jt.id)
        )

        filteredByCategory = allMembers.filter(
          (member) =>
            member.jobTitleId && relevantJobTitleIds.has(member.jobTitleId)
        )
      }

      // Filtrar membros que trabalham no dia especificado
      const membersWorkingOnDay = filteredByCategory.filter((member) => {
        // Se working_days não está definido, assumir que trabalha todos os dias
        if (!member.workingDays || member.workingDays.length === 0) {
          return true
        }
        return member.workingDays.includes(dayOfWeek)
      })

      // Buscar agendamentos conflitantes (mesma data e hora)
      const conflictingDemands = await db
        .select({
          responsibleId: demands.responsible_id,
        })
        .from(demands)
        .where(
          and(
            eq(demands.scheduled_date, date),
            eq(demands.scheduled_time, time),
            sql`${demands.responsible_id} IS NOT NULL`
          )
        )

      const conflictingMemberIds = new Set(
        conflictingDemands
          .map((d) => d.responsibleId)
          .filter((id): id is string => id !== null)
      )

      // Marcar membros com conflito
      const availableMembers = membersWorkingOnDay.map((member) => ({
        ...member,
        hasConflict: conflictingMemberIds.has(member.id),
      }))

      // Ordenar: membros sem conflito primeiro
      availableMembers.sort((a, b) => {
        if (a.hasConflict === b.hasConflict) return 0
        return a.hasConflict ? 1 : -1
      })

      return reply.status(200).send({
        availableMembers,
        searchCriteria: {
          date,
          time,
          dayOfWeek,
          dayOfWeekName: dayNames[dayOfWeek],
          category,
        },
      })
    }
  )
}
