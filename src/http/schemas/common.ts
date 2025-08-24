import { z } from 'zod/v4'
import { VALIDATION_RULES } from '../../config/constants.ts'

/**
 * Schemas de validação reutilizáveis seguindo DRY principle
 */

// Schemas básicos
export const emailSchema = z
  .string()
  .email('Formato de e-mail inválido')
  .max(VALIDATION_RULES.EMAIL.MAX_LENGTH, `E-mail deve ter no máximo ${VALIDATION_RULES.EMAIL.MAX_LENGTH} caracteres`)
  .toLowerCase()
  .trim()

export const passwordSchema = z
  .string()
  .min(VALIDATION_RULES.PASSWORD.MIN_LENGTH, `Senha deve ter pelo menos ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} caracteres`)
  .max(VALIDATION_RULES.PASSWORD.MAX_LENGTH, `Senha deve ter no máximo ${VALIDATION_RULES.PASSWORD.MAX_LENGTH} caracteres`)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número')

export const nameSchema = z
  .string()
  .min(VALIDATION_RULES.NAME.MIN_LENGTH, `Nome deve ter pelo menos ${VALIDATION_RULES.NAME.MIN_LENGTH} caracteres`)
  .max(VALIDATION_RULES.NAME.MAX_LENGTH, `Nome deve ter no máximo ${VALIDATION_RULES.NAME.MAX_LENGTH} caracteres`)
  .trim()
  .refine((value) => value.length > 0, 'Nome não pode estar vazio')

export const slugSchema = z
  .string()
  .min(VALIDATION_RULES.SLUG.MIN_LENGTH, `Slug deve ter pelo menos ${VALIDATION_RULES.SLUG.MIN_LENGTH} caracteres`)
  .max(VALIDATION_RULES.SLUG.MAX_LENGTH, `Slug deve ter no máximo ${VALIDATION_RULES.SLUG.MAX_LENGTH} caracteres`)
  .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
  .toLowerCase()
  .trim()

export const descriptionSchema = z
  .string()
  .max(VALIDATION_RULES.DESCRIPTION.MAX_LENGTH, `Descrição deve ter no máximo ${VALIDATION_RULES.DESCRIPTION.MAX_LENGTH} caracteres`)
  .trim()
  .optional()

export const cpfSchema = z
  .string()
  .length(VALIDATION_RULES.CPF.LENGTH, `CPF deve ter exatamente ${VALIDATION_RULES.CPF.LENGTH} dígitos`)
  .regex(/^\d{11}$/, 'CPF deve conter apenas números')
  .refine((cpf) => {
    // Implementar validação de CPF
    if (!cpf || cpf.length !== 11) return false
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false
    
    // Calcula os dígitos verificadores
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf[i]) * (10 - i)
    }
    let digit1 = 11 - (sum % 11)
    if (digit1 > 9) digit1 = 0
    
    sum = 0
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf[i]) * (11 - i)
    }
    let digit2 = 11 - (sum % 11)
    if (digit2 > 9) digit2 = 0
    
    return parseInt(cpf[9]) === digit1 && parseInt(cpf[10]) === digit2
  }, 'CPF inválido')

export const uuidSchema = z
  .string()
  .uuid('Formato de UUID inválido')

export const phoneSchema = z
  .string()
  .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX')
  .optional()

// Schemas de paginação
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val) || 1)),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val) || 20))),
})

export const searchSchema = z.object({
  search: z
    .string()
    .min(1, 'Termo de busca deve ter pelo menos 1 caractere')
    .max(100, 'Termo de busca deve ter no máximo 100 caracteres')
    .trim()
    .optional(),
})

// Schemas para parâmetros de rota
export const organizationParamsSchema = z.object({
  organizationSlug: slugSchema,
})

export const unitParamsSchema = z.object({
  organizationSlug: slugSchema,
  unitSlug: slugSchema,
})

export const userParamsSchema = z.object({
  organizationSlug: slugSchema,
  userId: uuidSchema,
})

export const applicantParamsSchema = z.object({
  organizationSlug: slugSchema,
  applicantId: uuidSchema,
})

export const demandParamsSchema = z.object({
  organizationSlug: slugSchema,
  unitSlug: slugSchema,
  demandId: uuidSchema,
})

export const attachmentParamsSchema = z.object({
  organizationSlug: slugSchema,
  attachmentId: uuidSchema,
})

export const inviteParamsSchema = z.object({
  inviteId: uuidSchema,
})

// Schemas para filtros comuns
export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .datetime('Data de início deve estar no formato ISO 8601')
    .optional(),
  endDate: z
    .string()
    .datetime('Data de fim deve estar no formato ISO 8601')
    .optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate)
    }
    return true
  },
  { message: 'Data de início deve ser anterior à data de fim' }
)

// Schema para arquivo de upload
export const uploadFileSchema = z.object({
  filename: z.string().min(1, 'Nome do arquivo é obrigatório'),
  mimetype: z.string().min(1, 'Tipo MIME é obrigatório'),
  encoding: z.string(),
})

export type PaginationQuery = z.infer<typeof paginationSchema>
export type SearchQuery = z.infer<typeof searchSchema>
export type DateRangeQuery = z.infer<typeof dateRangeSchema>
export type OrganizationParams = z.infer<typeof organizationParamsSchema>
export type UnitParams = z.infer<typeof unitParamsSchema>
export type UserParams = z.infer<typeof userParamsSchema>
export type ApplicantParams = z.infer<typeof applicantParamsSchema>
export type DemandParams = z.infer<typeof demandParamsSchema>
export type AttachmentParams = z.infer<typeof attachmentParamsSchema>
export type InviteParams = z.infer<typeof inviteParamsSchema>
