import type { ZodSchema } from 'zod/v4'
import { commonErrorResponses } from './error-schemas.ts'

/**
 * Adiciona esquemas de resposta de erro padrão a uma rota
 * @param successResponses - Esquemas de resposta de sucesso específicos da rota
 * @param excludeErrors - Lista de códigos de erro para excluir (ex: ['401'] para rotas públicas)
 * @returns Objeto com todos os esquemas de resposta
 */
export function withErrorResponses(
  successResponses: Record<string | number, ZodSchema>,
  excludeErrors: string[] = []
) {
  const errorResponses = Object.fromEntries(
    Object.entries(commonErrorResponses).filter(
      ([code]) => !excludeErrors.includes(code)
    )
  )

  return {
    ...successResponses,
    ...errorResponses,
  }
}

/**
 * Esquemas de resposta para rotas autenticadas (inclui todos os erros)
 */
export function withAuthErrorResponses(
  successResponses: Record<string | number, ZodSchema>
) {
  return withErrorResponses(successResponses)
}

/**
 * Esquemas de resposta para rotas públicas (exclui 401)
 */
export function withPublicErrorResponses(
  successResponses: Record<string | number, ZodSchema>
) {
  return withErrorResponses(successResponses, ['401'])
}

/**
 * Esquemas de resposta mínimos para operações simples
 */
export function withBasicErrorResponses(
  successResponses: Record<string | number, ZodSchema>
) {
  return withErrorResponses(successResponses, ['403', '409'])
}
