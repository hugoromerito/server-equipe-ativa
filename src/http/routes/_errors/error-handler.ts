import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod/v4'
import { HTTP_STATUS, ERROR_CODES } from '../../../config/constants.ts'
import { BadRequestError } from './bad-request-error.ts'
import { ConflictError } from './conflict-error.ts'
import { ForbiddenError } from './forbidden-error.ts'
import { InternalServerError } from './internal-server-error.ts'
import { NotFoundError } from './not-found-error.ts'
import { UnauthorizedError } from './unauthorized-error.ts'

interface ErrorResponse {
  error: string
  code: string
  message: string
  details?: unknown
  timestamp: string
  path?: string
}

/**
 * Manipulador de erros global seguindo as melhores práticas
 * Implementa logging e resposta padronizada
 */
type FastifyErrorHandler = FastifyInstance['errorHandler']

export const errorHandler: FastifyErrorHandler = (error, request, reply) => {
  const timestamp = new Date().toISOString()
  const path = request.url

  // Log do erro para debugging (em desenvolvimento)
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error occurred:', {
      error: error.message,
      stack: error.stack,
      path,
      timestamp,
      method: request.method,
    })
  }

  // Criar resposta base
  const createErrorResponse = (
    statusCode: number,
    errorType: string,
    code: string,
    message: string,
    details?: unknown
  ): ErrorResponse => {
    const response: ErrorResponse = {
      error: errorType,
      code,
      message,
      timestamp,
      path,
    }
    
    if (details) {
      response.details = details
    }
    
    return response
  }

  // Tratamento de erros de validação Zod
  if (error instanceof ZodError) {
    const formattedIssues = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }))

    return reply.status(HTTP_STATUS.BAD_REQUEST).send(
      createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Bad Request',
        ERROR_CODES.VALIDATION_ERROR,
        'Dados de entrada inválidos',
        formattedIssues
      )
    )
  }

  // Tratamento para erros de validação do fastify-type-provider-zod
  if (error.message && (
    error.message.includes('Invalid input:') || 
    error.message.includes('body/') ||
    error.message.includes('params/') ||
    error.message.includes('querystring/')
  )) {
    return reply.status(HTTP_STATUS.BAD_REQUEST).send(
      createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Bad Request',
        ERROR_CODES.VALIDATION_ERROR,
        'Dados de entrada inválidos'
      )
    )
  }

  // Tratamento de erros customizados
  if (error instanceof BadRequestError) {
    return reply.status(HTTP_STATUS.BAD_REQUEST).send(
      createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Bad Request',
        ERROR_CODES.BAD_REQUEST,
        error.message
      )
    )
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send(
      createErrorResponse(
        HTTP_STATUS.UNAUTHORIZED,
        'Unauthorized',
        ERROR_CODES.UNAUTHORIZED,
        error.message
      )
    )
  }

  if (error instanceof ForbiddenError) {
    return reply.status(HTTP_STATUS.FORBIDDEN).send(
      createErrorResponse(
        HTTP_STATUS.FORBIDDEN,
        'Forbidden',
        ERROR_CODES.FORBIDDEN,
        error.message
      )
    )
  }

  if (error instanceof NotFoundError) {
    return reply.status(HTTP_STATUS.NOT_FOUND).send(
      createErrorResponse(
        HTTP_STATUS.NOT_FOUND,
        'Not Found',
        ERROR_CODES.NOT_FOUND,
        error.message
      )
    )
  }

  if (error instanceof ConflictError) {
    return reply.status(HTTP_STATUS.CONFLICT).send(
      createErrorResponse(
        HTTP_STATUS.CONFLICT,
        'Conflict',
        ERROR_CODES.CONFLICT,
        error.message
      )
    )
  }

  if (error instanceof InternalServerError) {
    return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
      createErrorResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Internal Server Error',
        ERROR_CODES.INTERNAL_ERROR,
        error.message
      )
    )
  }

  // Tratamento de erros de JWT específicos
  if (error.code === 'FST_JWT_BAD_REQUEST' || error.message.includes('jwt')) {
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send(
      createErrorResponse(
        HTTP_STATUS.UNAUTHORIZED,
        'Unauthorized',
        ERROR_CODES.UNAUTHORIZED,
        'Token de autenticação inválido ou expirado'
      )
    )
  }

  // Tratamento de erros de banco de dados
  if (error.code === '23505') { // Unique constraint violation
    return reply.status(HTTP_STATUS.CONFLICT).send(
      createErrorResponse(
        HTTP_STATUS.CONFLICT,
        'Conflict',
        ERROR_CODES.CONFLICT,
        'Recurso já existe com esses dados'
      )
    )
  }

  if (error.code === '23503') { // Foreign key constraint violation
    return reply.status(HTTP_STATUS.BAD_REQUEST).send(
      createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Bad Request',
        ERROR_CODES.BAD_REQUEST,
        'Referência inválida para recurso relacionado'
      )
    )
  }

  if (error.code === '23502') { // Not null constraint violation
    return reply.status(HTTP_STATUS.BAD_REQUEST).send(
      createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Bad Request',
        ERROR_CODES.BAD_REQUEST,
        'Campo obrigatório não fornecido'
      )
    )
  }

  // Log de erro não tratado para análise
  console.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    code: error.code,
    path,
    timestamp,
    method: request.method,
  })

  // Erro interno genérico
  return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
    createErrorResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'Internal Server Error',
      ERROR_CODES.INTERNAL_ERROR,
      process.env.NODE_ENV === 'production' 
        ? 'Erro interno do servidor' 
        : error.message || 'Erro interno do servidor'
    )
  )
}
