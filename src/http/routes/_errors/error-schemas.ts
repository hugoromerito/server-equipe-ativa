import { z } from 'zod/v4'

// Schema comum para respostas de erro
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  message: z.string(),
})

// Schemas de resposta de erro para códigos específicos
export const errorSchemas = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
}

// Schema completo com todos os possíveis erros
export const commonErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
}

// Schemas específicos por tipo de erro
export const validationErrorSchema = z.object({
  error: z.literal('Bad Request'),
  code: z.literal('VALIDATION_ERROR'),
  message: z.string(),
})

export const badRequestSchema = z.object({
  error: z.literal('Bad Request'),
  code: z.literal('BAD_REQUEST'),
  message: z.string(),
})

export const unauthorizedSchema = z.object({
  error: z.literal('Unauthorized'),
  code: z.literal('UNAUTHORIZED'),
  message: z.string(),
})

export const forbiddenSchema = z.object({
  error: z.literal('Forbidden'),
  code: z.literal('FORBIDDEN'),
  message: z.string(),
})

export const notFoundSchema = z.object({
  error: z.literal('Not Found'),
  code: z.literal('NOT_FOUND'),
  message: z.string(),
})

export const conflictSchema = z.object({
  error: z.literal('Conflict'),
  code: z.literal('CONFLICT'),
  message: z.string(),
})

export const internalErrorSchema = z.object({
  error: z.literal('Internal Server Error'),
  code: z.literal('INTERNAL_ERROR'),
  message: z.string(),
})
