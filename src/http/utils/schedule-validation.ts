import { and, eq, ne, gte, lte, sql } from 'drizzle-orm'
import { db } from '../../db/connection.ts'
import { demands } from '../../db/schema/index.ts'
import { NUMBER_TO_WEEKDAY } from '../schemas/members.ts'
import type { WeekdayType } from '../../db/schema/enums.ts'

/**
 * Verifica se um membro já possui um agendamento conflitante no mesmo horário
 * 
 * @param memberId ID do membro
 * @param scheduledDate Data no formato YYYY-MM-DD
 * @param scheduledTime Hora no formato HH:MM
 * @param excludeDemandId ID da demanda a ser excluída da verificação (útil para updates)
 * @returns true se houver conflito, false caso contrário
 */
export async function checkScheduleConflict(
  memberId: string,
  scheduledDate: string,
  scheduledTime: string,
  excludeDemandId?: string
): Promise<boolean> {
  const whereClause = and(
    eq(demands.responsible_id, memberId),
    eq(demands.scheduled_date, scheduledDate),
    eq(demands.scheduled_time, scheduledTime),
    // Exclui demandas rejeitadas (equivalente a canceladas)
    ne(demands.status, 'REJECTED'),
    // Se fornecido, exclui a demanda atual da verificação
    excludeDemandId ? ne(demands.id, excludeDemandId) : undefined
  )

  const [conflictingDemand] = await db
    .select({ id: demands.id })
    .from(demands)
    .where(whereClause)
    .limit(1)

  return !!conflictingDemand
}

/**
 * Verifica se um membro trabalha no dia da semana especificado
 * 
 * @param workingDays Array de dias da semana (DOMINGO, SEGUNDA, etc.)
 * @param scheduledDate Data no formato YYYY-MM-DD
 * @returns true se o membro trabalha neste dia, false caso contrário
 */
export function checkWorkingDay(
  workingDays: WeekdayType[] | null,
  scheduledDate: string
): boolean {
  if (!workingDays || workingDays.length === 0) {
    // Se não tem dias de trabalho definidos, assume que trabalha todos os dias
    return true
  }

  const date = new Date(scheduledDate + 'T00:00:00.000Z')
  const dayOfWeek = date.getUTCDay() // 0 = Domingo, 1 = Segunda, etc.
  const weekdayName = NUMBER_TO_WEEKDAY[dayOfWeek as keyof typeof NUMBER_TO_WEEKDAY]
  
  return workingDays.includes(weekdayName as WeekdayType)
}

/**
 * Valida se é possível agendar um membro para uma demanda
 * 
 * @param memberId ID do membro
 * @param workingDays Dias de trabalho do membro
 * @param scheduledDate Data no formato YYYY-MM-DD
 * @param scheduledTime Hora no formato HH:MM
 * @param excludeDemandId ID da demanda a ser excluída da verificação
 * @returns Objeto com informações sobre a disponibilidade
 */
export async function validateMemberScheduling(
  memberId: string,
  workingDays: WeekdayType[] | null,
  scheduledDate: string,
  scheduledTime: string,
  excludeDemandId?: string
): Promise<{
  available: boolean
  reason?: 'schedule-conflict' | 'not-working-day'
  conflictingDemandId?: string
}> {
  // Verificar se o membro trabalha neste dia
  if (!checkWorkingDay(workingDays, scheduledDate)) {
    return {
      available: false,
      reason: 'not-working-day'
    }
  }

  // Verificar conflitos de horário
  const hasConflict = await checkScheduleConflict(
    memberId,
    scheduledDate,
    scheduledTime,
    excludeDemandId
  )

  if (hasConflict) {
    // Buscar o ID da demanda conflitante para referência
    const whereClause = and(
      eq(demands.responsible_id, memberId),
      eq(demands.scheduled_date, scheduledDate),
      eq(demands.scheduled_time, scheduledTime),
      ne(demands.status, 'REJECTED'),
      excludeDemandId ? ne(demands.id, excludeDemandId) : undefined
    )

    const [conflictingDemand] = await db
      .select({ id: demands.id })
      .from(demands)
      .where(whereClause)
      .limit(1)

    return {
      available: false,
      reason: 'schedule-conflict',
      conflictingDemandId: conflictingDemand?.id
    }
  }

  return {
    available: true
  }
}

/**
 * Busca todas as demandas agendadas para um membro em um período
 * 
 * @param memberId ID do membro
 * @param startDate Data de início no formato YYYY-MM-DD
 * @param endDate Data de fim no formato YYYY-MM-DD
 * @returns Array com as demandas agendadas
 */
export async function getMemberScheduledDemands(
  memberId: string,
  startDate: string,
  endDate: string
) {
  return db
    .select({
      id: demands.id,
      title: demands.title,
      scheduledDate: demands.scheduled_date,
      scheduledTime: demands.scheduled_time,
      status: demands.status,
    })
    .from(demands)
    .where(
      and(
        eq(demands.responsible_id, memberId),
        // Data entre o período especificado usando sql template
        sql`${demands.scheduled_date} >= ${startDate}`,
        sql`${demands.scheduled_date} <= ${endDate}`,
        // Exclui demandas rejeitadas
        ne(demands.status, 'REJECTED')
      )
    )
    .orderBy(demands.scheduled_date, demands.scheduled_time)
}