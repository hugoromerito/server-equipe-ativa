import { z } from 'zod/v4'

/**
 * Schema para criação de cargo/função
 */
export const createJobTitleSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional(),
  unit_id: z.string().uuid('ID da unidade inválido').optional(),
})

/**
 * Schema para atualização de cargo/função
 */
export const updateJobTitleSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .optional(),
  description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional(),
})

/**
 * Schema para query params de listagem
 */
export const listJobTitlesQuerySchema = z.object({
  unit_id: z.string().uuid('ID da unidade inválido').optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
