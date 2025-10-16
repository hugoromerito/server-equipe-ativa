import { z } from 'zod/v4'
import type { ZodObject, ZodRawShape, ZodSchema } from 'zod/v4'

// Schema de resposta base para operações que criam recursos
export const createdResponseSchema = <T extends ZodObject<ZodRawShape>>(data: T) => ({
  201: data,
})

// Schema de resposta base para operações que retornam dados
export const successResponseSchema = <T extends ZodObject<ZodRawShape>>(data: T) => ({
  200: data,
})

// Schema de resposta para operações que não retornam dados
export const noContentResponseSchema = () => ({
  204: z.null(),
})

// Schema de resposta para operações que atualizam recursos
export const updatedResponseSchema = <T extends ZodObject<ZodRawShape>>(data: T) => ({
  200: data,
})

// Schemas de erro específicos por operação
export const createOperationResponses = <T extends ZodSchema>(
  successSchema: T,
  excludeErrors: number[] = []
) => {
  const errorResponses: Record<number, ZodSchema> = {
    400: z.object({
      error: z.string(),
      code: z.string(), 
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    401: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    403: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    409: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    500: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
  }

  // Remove códigos de erro excluídos
  excludeErrors.forEach(code => {
    delete errorResponses[code]
  })

  return {
    201: successSchema,
    ...errorResponses,
  }
}

export const getOperationResponses = <T extends ZodSchema>(
  successSchema: T,
  excludeErrors: number[] = []
) => {
  const errorResponses: Record<number, ZodSchema> = {
    400: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    401: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    403: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    404: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    500: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
  }

  // Remove códigos de erro excluídos
  excludeErrors.forEach(code => {
    delete errorResponses[code]
  })

  return {
    200: successSchema,
    ...errorResponses,
  }
}

export const updateOperationResponses = <T extends ZodSchema>(
  successSchema: T,
  excludeErrors: number[] = []
) => {
  const errorResponses: Record<number, ZodSchema> = {
    400: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    401: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    403: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    404: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    409: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    500: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
  }

  // Remove códigos de erro excluídos
  excludeErrors.forEach(code => {
    delete errorResponses[code]
  })

  return {
    200: successSchema,
    ...errorResponses,
  }
}

export const deleteOperationResponses = (excludeErrors: number[] = []) => {
  const errorResponses: Record<number, ZodSchema> = {
    400: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    401: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    403: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    404: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
    500: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
      timestamp: z.string().optional(),
      path: z.string().optional(),
      details: z.unknown().optional(),
    }),
  }

  // Remove códigos de erro excluídos
  excludeErrors.forEach(code => {
    delete errorResponses[code]
  })

  return {
    204: z.null(),
    ...errorResponses,
  }
}

// Para rotas públicas (sem autenticação)
export const publicGetOperationResponses = <T extends ZodSchema>(
  successSchema: T,
  excludeErrors: number[] = []
) => {
  const errorResponses: Record<number, ZodSchema> = {
    400: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
    }),
    404: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
    }),
    500: z.object({
      error: z.string(),
      code: z.string(),
      message: z.string(),
    }),
  }

  // Remove códigos de erro excluídos
  excludeErrors.forEach(code => {
    delete errorResponses[code]
  })

  return {
    200: successSchema,
    ...errorResponses,
  }
}
