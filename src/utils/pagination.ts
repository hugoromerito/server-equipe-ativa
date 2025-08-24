/**
 * Utilitários para paginação seguindo as melhores práticas
 */

import type { PaginationQuery } from '../http/schemas/common.ts'
import { PAGINATION } from '../config/constants.ts'

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface PaginationOptions {
  page?: number
  limit?: number
}

/**
 * Calcula offset para queries de banco de dados
 */
export function calculateOffset(page: number, limit: number): number {
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, limit))
  
  return (safePage - 1) * safeLimit
}

/**
 * Normaliza parâmetros de paginação
 */
export function normalizePagination(options: PaginationOptions): Required<PaginationOptions> {
  return {
    page: Math.max(1, options.page || PAGINATION.DEFAULT_PAGE),
    limit: Math.min(
      PAGINATION.MAX_LIMIT, 
      Math.max(1, options.limit || PAGINATION.DEFAULT_LIMIT)
    ),
  }
}

/**
 * Cria objeto de resposta paginada
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit)
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  }
}

/**
 * Extrai parâmetros de paginação da query string
 */
export function extractPaginationFromQuery(query: PaginationQuery): Required<PaginationOptions> {
  return {
    page: Math.max(1, query.page || PAGINATION.DEFAULT_PAGE),
    limit: Math.min(
      PAGINATION.MAX_LIMIT,
      Math.max(1, query.limit || PAGINATION.DEFAULT_LIMIT)
    ),
  }
}

/**
 * Valida parâmetros de paginação
 */
export function validatePagination(page: number, limit: number): void {
  if (page < 1) {
    throw new Error('Página deve ser maior que 0')
  }
  
  if (limit < 1) {
    throw new Error('Limit deve ser maior que 0')
  }
  
  if (limit > PAGINATION.MAX_LIMIT) {
    throw new Error(`Limit não pode ser maior que ${PAGINATION.MAX_LIMIT}`)
  }
}
