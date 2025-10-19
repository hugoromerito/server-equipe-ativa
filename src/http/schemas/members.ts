import { z } from 'zod/v4'
import { weekdayZodEnum } from '../../db/schema/enums.ts'

/**
 * Schema para validação de dias da semana
 * Aceita nomes dos dias: DOMINGO, SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO
 */
export const workingDaysSchema = z
  .array(weekdayZodEnum)
  .nullable()
  .optional()
  .refine(
    (days) => {
      if (!days) return true
      // Verificar se não há dias duplicados
      const uniqueDays = new Set(days)
      return uniqueDays.size === days.length
    },
    {
      message: 'Dias da semana não podem estar duplicados',
    }
  )

/**
 * Schema para atualizar dias de trabalho de um membro
 */
export const updateMemberWorkingDaysBodySchema = z.object({
  workingDays: workingDaysSchema,
})

/**
 * Mapeamento de dias da semana para número (para compatibilidade com datas)
 */
export const WEEKDAY_TO_NUMBER = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
} as const

/**
 * Mapeamento de número para nome do dia
 */
export const NUMBER_TO_WEEKDAY = {
  0: 'DOMINGO',
  1: 'SEGUNDA',
  2: 'TERCA',
  3: 'QUARTA',
  4: 'QUINTA',
  5: 'SEXTA',
  6: 'SABADO',
} as const
