import { z } from 'zod/v4'

/**
 * Schema para validação de dias da semana
 * 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
 */
export const workingDaysSchema = z
  .array(z.number().int().min(0).max(6))
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
 * Dias da semana em português para referência
 */
export const WEEKDAYS = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
} as const
