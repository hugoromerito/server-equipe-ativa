import { and, eq, sql } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { demands, jobTitles, members, units, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'
import { NUMBER_TO_WEEKDAY } from '../../schemas/members.ts'

/**
 * Retorna o dia da semana (0-6) para uma data no formato YYYY-MM-DD
 * 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
 */
function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString + 'T00:00:00.000Z')
  return date.getUTCDay()
}

/**
 * Converte o número do dia da semana para o nome do enum
 */
function getWeekdayName(dayNumber: number): string {
  return NUMBER_TO_WEEKDAY[dayNumber as keyof typeof NUMBER_TO_WEEKDAY]
}

/**
 * Gera uma lista de horários de trabalho com intervalos de 30 minutos
 */
function generateTimeSlots(startHour = 8, endHour = 18): string[] {
  const slots: string[] = []
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    slots.push(`${hour.toString().padStart(2, '0')}:30`)
  }
  return slots
}

/**
 * Gera uma lista de datas a partir de uma data inicial por um número de dias
 */
function generateDateRange(startDate: string, days: number): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00.000Z')
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(start)
    currentDate.setUTCDate(start.getUTCDate() + i)
    dates.push(currentDate.toISOString().split('T')[0])
  }
  
  return dates
}

export const getScheduleAvailabilityRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/units/:unitSlug/members/schedule-availability',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Buscar agenda de disponibilidade dos membros',
        description:
          'Retorna a agenda de disponibilidade de todos os membros da unidade, organizados por cargo, com horários e datas disponíveis',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          unitSlug: z.string(),
        }),
        querystring: z.object({
          startDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
            .default(() => new Date().toISOString().split('T')[0]),
          days: z.coerce.number().min(1).max(30).default(7),
          jobTitleIds: z
            .string()
            .optional()
            .transform((val) => {
              if (!val) return undefined
              return val.split(',').filter(Boolean)
            }),
          startHour: z.coerce.number().min(0).max(23).default(8),
          endHour: z.coerce.number().min(1).max(24).default(18),
        }),
        response: withAuthErrorResponses({
          200: z.object({
            schedule: z.object({
              dates: z.array(z.string()),
              timeSlots: z.array(z.string()),
              jobTitles: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  members: z.array(
                    z.object({
                      id: z.string().uuid(),
                      userId: z.string().uuid(),
                      userName: z.string(),
                      userEmail: z.string().email(),
                      userAvatarUrl: z.string().nullable(),
                      workingDays: z.array(z.string()).nullable(),
                      availability: z.record(
                        z.string(), // date
                        z.record(
                          z.string(), // time
                          z.object({
                            available: z.boolean(),
                            reason: z.string().optional(), // 'not-working-day' | 'conflict' | 'available'
                          })
                        )
                      ),
                    })
                  ),
                })
              ),
            }),
            filters: z.object({
              startDate: z.string(),
              days: z.number(),
              jobTitleIds: z.array(z.string()).optional(),
              startHour: z.number(),
              endHour: z.number(),
            }),
          }),
        }),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { slug, unitSlug } = request.params
      const { startDate, days, jobTitleIds, startHour, endHour } = request.query

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

      // Gerar datas e horários
      const dates = generateDateRange(startDate, days)
      const timeSlots = generateTimeSlots(startHour, endHour)

      // Buscar todos os membros da unidade com job titles
      const membersWithJobTitles = await db
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
        .innerJoin(jobTitles, eq(members.job_title_id, jobTitles.id))
        .where(eq(members.unit_id, unit.id))

      // Filtrar por job titles se especificado
      let filteredMembers = membersWithJobTitles
      if (jobTitleIds && jobTitleIds.length > 0) {
        filteredMembers = membersWithJobTitles.filter(
          (member) => member.jobTitleId && jobTitleIds.includes(member.jobTitleId)
        )
      }

      // Buscar todos os agendamentos conflitantes no período
      const conflictingDemands = await db
        .select({
          responsibleId: demands.responsible_id,
          scheduledDate: demands.scheduled_date,
          scheduledTime: demands.scheduled_time,
        })
        .from(demands)
        .where(
          and(
            sql`${demands.scheduled_date} >= ${startDate}`,
            sql`${demands.scheduled_date} <= ${dates[dates.length - 1]}`,
            sql`${demands.responsible_id} IS NOT NULL`
          )
        )

      // Criar mapa de conflitos por membro
      const conflictsMap = new Map<string, Set<string>>()
      conflictingDemands.forEach((conflict) => {
        if (conflict.responsibleId && conflict.scheduledDate && conflict.scheduledTime) {
          const key = `${conflict.scheduledDate}-${conflict.scheduledTime}`
          if (!conflictsMap.has(conflict.responsibleId)) {
            conflictsMap.set(conflict.responsibleId, new Set())
          }
          conflictsMap.get(conflict.responsibleId)!.add(key)
        }
      })

      // Organizar por job titles
      const jobTitlesMap = new Map<string, any>()

      filteredMembers.forEach((member) => {
        if (!member.jobTitleId || !member.jobTitleName) return

        if (!jobTitlesMap.has(member.jobTitleId)) {
          jobTitlesMap.set(member.jobTitleId, {
            id: member.jobTitleId,
            name: member.jobTitleName,
            members: [],
          })
        }

        // Calcular disponibilidade para cada data e horário
        const availability: Record<string, Record<string, { available: boolean; reason?: string }>> = {}

        dates.forEach((date) => {
          const dayOfWeek = getDayOfWeek(date)
          const weekdayName = getWeekdayName(dayOfWeek)
          availability[date] = {}

          timeSlots.forEach((time) => {
            // Verificar se trabalha neste dia
            const weekdayName = getWeekdayName(dayOfWeek) as 'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO'
            const worksThisDay = !member.workingDays || 
                               member.workingDays.length === 0 || 
                               member.workingDays.includes(weekdayName)

            if (!worksThisDay) {
              availability[date][time] = {
                available: false,
                reason: 'not-working-day',
              }
              return
            }

            // Verificar conflitos
            const conflictKey = `${date}-${time}`
            const memberConflicts = conflictsMap.get(member.id)
            const hasConflict = memberConflicts?.has(conflictKey) || false

            availability[date][time] = {
              available: !hasConflict,
              reason: hasConflict ? 'conflict' : 'available',
            }
          })
        })

        jobTitlesMap.get(member.jobTitleId).members.push({
          id: member.id,
          userId: member.userId,
          userName: member.userName,
          userEmail: member.userEmail,
          userAvatarUrl: member.userAvatarUrl,
          workingDays: member.workingDays,
          availability,
        })
      })

      const jobTitlesList = Array.from(jobTitlesMap.values())

      return reply.send({
        schedule: {
          dates,
          timeSlots,
          jobTitles: jobTitlesList,
        },
        filters: {
          startDate,
          days,
          jobTitleIds,
          startHour,
          endHour,
        },
      })
    }
  )
}