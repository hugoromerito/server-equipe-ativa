import { and, eq, sql, gte, lte, isNotNull, inArray } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { demands, jobTitles, members, organizations, units, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { withAuthErrorResponses } from '../_errors/error-helpers.ts'
import { NUMBER_TO_WEEKDAY } from '../../schemas/members.ts'
import type { WeekdayType } from '../../../db/schema/enums.ts'

/**
 * Gera array de horários entre hora inicial e final com intervalo específico
 */
function generateTimeSlots(startHour: number, endHour: number, intervalMinutes: number = 30): string[] {
  const slots: string[] = []
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      // Se é a última hora, parar antes do final
      if (hour === endHour && minute > 0) break
      
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      slots.push(timeString)
    }
  }
  
  return slots
}

/**
 * Gera array de datas consecutivas
 */
function generateDateRange(startDate: string, days: number): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T12:00:00.000Z') // Usar meio-dia para evitar problemas de timezone
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000)) // Adicionar milissegundos
    dates.push(date.toISOString().split('T')[0])
  }
  
  return dates
}

/**
 * Verifica se um membro trabalha em um dia específico
 */
function isWorkingDay(workingDays: WeekdayType[] | null, dateString: string): boolean {
  if (!workingDays || workingDays.length === 0) return true
  
  const date = new Date(dateString + 'T12:00:00Z')
  const dayOfWeek = date.getUTCDay()
  const weekdayName = NUMBER_TO_WEEKDAY[dayOfWeek as keyof typeof NUMBER_TO_WEEKDAY]
  
  return workingDays.includes(weekdayName as WeekdayType)
}

export const getMemberAvailabilityScheduleRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/units/:unitSlug/members/availability-schedule',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members'],
        summary: 'Obter agenda completa de disponibilidade',
        description: 'Retorna uma grade completa de disponibilidade de todos os membros para um período específico',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          unitSlug: z.string(),
        }),
        querystring: z.object({
          startDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início deve estar no formato YYYY-MM-DD')
            .optional()
            .default(() => new Date().toISOString().split('T')[0]),
          days: z
            .coerce
            .number()
            .int()
            .min(1, 'Número de dias deve ser pelo menos 1')
            .max(30, 'Número de dias não pode exceder 30')
            .optional()
            .default(7),
          startHour: z
            .coerce
            .number()
            .int()
            .min(0, 'Hora inicial deve ser entre 0 e 23')
            .max(23, 'Hora inicial deve ser entre 0 e 23')
            .optional()
            .default(8),
          endHour: z
            .coerce
            .number()
            .int()
            .min(0, 'Hora final deve ser entre 0 e 23')
            .max(23, 'Hora final deve ser entre 0 e 23')
            .optional()
            .default(18),
          intervalMinutes: z
            .coerce
            .number()
            .int()
            .min(15, 'Intervalo deve ser pelo menos 15 minutos')
            .max(120, 'Intervalo não pode exceder 120 minutos')
            .optional()
            .default(30),
          jobTitleId: z
            .string()
            .uuid('ID do cargo deve ser um UUID válido')
            .optional(),
        }),
        response: withAuthErrorResponses({
          200: z.object({
            schedule: z.object({
              dates: z.array(z.string()),
              timeSlots: z.array(z.string()),
              members: z.array(z.object({
                id: z.string().uuid(),
                name: z.string(),
                email: z.string(),
                jobTitle: z.string().nullable(),
                jobTitleId: z.string().uuid().nullable(),
                workingDays: z.array(z.string()).nullable(),
                availability: z.record(z.string(), z.record(z.string(), z.object({
                  available: z.boolean(),
                  reason: z.enum(['available', 'not-working-day', 'conflict', 'outside-hours']),
                  conflictingDemandId: z.string().uuid().optional(),
                }))),
              })),
            }),
            metadata: z.object({
              startDate: z.string(),
              days: z.number(),
              startHour: z.number(),
              endHour: z.number(),
              intervalMinutes: z.number(),
              totalSlots: z.number(),
              jobTitleId: z.string().optional(),
            }),
          }),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { slug, unitSlug } = request.params
        const { 
          startDate, 
          days, 
          startHour, 
          endHour, 
          intervalMinutes,
          jobTitleId 
        } = request.query

        // Validar horas
        if (startHour >= endHour) {
          throw new BadRequestError('Hora inicial deve ser menor que hora final.')
        }

      // Verificar permissões
      await request.getUserMembership(slug, unitSlug)

      // Buscar unidade na organização
      const [unit] = await db
        .select({ id: units.id })
        .from(units)
        .innerJoin(organizations, eq(units.organization_id, organizations.id))
        .where(
          and(
            eq(units.slug, unitSlug),
            eq(organizations.slug, slug)
          )
        )
        .limit(1)

      if (!unit) {
        throw new NotFoundError('Unidade não encontrada.')
      }

        // Gerar datas e horários
        const dates = generateDateRange(startDate, days)
        const timeSlots = generateTimeSlots(startHour, endHour, intervalMinutes)
        
        // Validar se as datas foram geradas corretamente
        if (dates.length === 0) {
          throw new BadRequestError('Erro ao gerar datas para o período especificado.')
        }
        
        if (timeSlots.length === 0) {
          throw new BadRequestError('Erro ao gerar horários para o período especificado.')
        }      // Buscar membros da unidade
      let membersQuery = db
        .select({
          id: members.id,
          name: users.name,
          email: users.email,
          jobTitleId: members.job_title_id,
          jobTitleName: jobTitles.name,
          workingDays: members.working_days,
        })
        .from(members)
        .innerJoin(users, eq(members.user_id, users.id))
        .leftJoin(jobTitles, eq(members.job_title_id, jobTitles.id))
        .where(eq(members.unit_id, unit.id))

      const allMembers = await membersQuery

      // Filtrar por job title se especificado
      const filteredMembers = jobTitleId 
        ? allMembers.filter(member => member.jobTitleId === jobTitleId)
        : allMembers

        // Buscar todos os agendamentos do período
        const endDate = dates[dates.length - 1]
        if (!endDate) {
          throw new BadRequestError('Data final não pode ser determinada.')
        }
        
        // Consulta específica para verificar se existe demanda no dia 20/10 às 08:00 para Hugo
        const specificCheck = await db
          .select({
            responsibleId: demands.responsible_id,
            scheduledDate: demands.scheduled_date,
            scheduledTime: demands.scheduled_time,
            demandId: demands.id,
            status: demands.status,
          })
          .from(demands)
          .where(
            and(
              eq(demands.responsible_id, '0b5a1eb2-2d73-49f7-8541-62c8d20ca96a'),
              eq(demands.scheduled_date, '2025-10-20'),
              eq(demands.scheduled_time, '08:00')
            )
          )
        
        console.log('Specific check for Hugo 2025-10-20 08:00:', specificCheck)

        const allConflicts = await db
          .select({
            responsibleId: demands.responsible_id,
            scheduledDate: demands.scheduled_date,
            scheduledTime: demands.scheduled_time,
            demandId: demands.id,
            status: demands.status,
          })
          .from(demands)
          .where(
            and(
              gte(demands.scheduled_date, startDate),
              lte(demands.scheduled_date, endDate),
              isNotNull(demands.responsible_id),
              inArray(demands.status, ['PENDING', 'IN_PROGRESS'])
            )
          )      // Log para debug detalhado
      console.log('=== DEBUG CONFLICTS ===')
      console.log('Query conflicts result:', {
        conflictCount: allConflicts.length,
        startDate,
        endDate,
        filteredMemberIds: filteredMembers.map(m => m.id),
        allConflicts: allConflicts.map(c => ({
          responsibleId: c.responsibleId,
          date: c.scheduledDate,
          time: c.scheduledTime,
          demandId: c.demandId
        }))
      })

      // Criar mapa de conflitos para acesso rápido
      const conflictMap = new Map<string, string>() // key: "memberId-date-time", value: demandId
      allConflicts.forEach(conflict => {
        if (conflict.responsibleId && conflict.scheduledDate && conflict.scheduledTime && conflict.demandId) {
          const key = `${conflict.responsibleId}-${conflict.scheduledDate}-${conflict.scheduledTime}`
          conflictMap.set(key, conflict.demandId)
          console.log(`Conflict mapped: ${key} -> ${conflict.demandId}`)
        }
      })
      
      console.log('Total conflicts mapped:', conflictMap.size)
      console.log('Conflict keys:', Array.from(conflictMap.keys()))

      // Construir grade de disponibilidade para cada membro
      const membersWithAvailability = filteredMembers.map(member => {
        const availability: Record<string, Record<string, any>> = {}

        dates.forEach(date => {
          availability[date] = {}
          
          timeSlots.forEach(time => {
            const conflictKey = `${member.id}-${date}-${time}`
            const hasConflict = conflictMap.has(conflictKey)
            const isWorking = isWorkingDay(member.workingDays, date)

            if (!isWorking) {
              availability[date][time] = {
                available: false,
                reason: 'not-working-day'
              }
            } else if (hasConflict) {
              availability[date][time] = {
                available: false,
                reason: 'conflict',
                conflictingDemandId: conflictMap.get(conflictKey)
              }
            } else {
              availability[date][time] = {
                available: true,
                reason: 'available'
              }
            }
          })
        })

        return {
          id: member.id,
          name: member.name || '',
          email: member.email || '',
          jobTitle: member.jobTitleName || null,
          jobTitleId: member.jobTitleId || null,
          workingDays: member.workingDays || null,
          availability
        }
      })

        return reply.status(200).send({
          schedule: {
            dates,
            timeSlots,
            members: membersWithAvailability,
          },
          metadata: {
            startDate,
            days,
            startHour,
            endHour,
            intervalMinutes,
            totalSlots: dates.length * timeSlots.length,
            jobTitleId,
          },
        })
      } catch (error) {
        // Log detalhado do erro para debug
        console.error('Error in getMemberAvailabilityScheduleRoute:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          params: request.params,
          query: request.query,
        })
        
        // Re-throw para que o error handler global processe
        throw error
      }
    }
  )
}