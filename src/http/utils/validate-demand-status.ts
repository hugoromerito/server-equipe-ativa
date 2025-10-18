/**
 * Utilitário para validação de transições de status de demandas
 */

import type { DemandStatusType } from '../../db/schema/enums.ts'

/**
 * Define as transições válidas de status de demandas
 * Cada chave representa o status atual, e o array de valores representa
 * os status que podem ser aplicados a partir do status atual
 */
const VALID_STATUS_TRANSITIONS: Record<DemandStatusType, DemandStatusType[]> = {
  PENDING: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED', 'PENDING'],
  RESOLVED: ['BILLED', 'IN_PROGRESS'],
  REJECTED: ['PENDING', 'IN_PROGRESS'],
  BILLED: [], // Status final, não pode ser alterado
}

/**
 * Valida se uma transição de status é permitida
 * @param currentStatus - Status atual da demanda
 * @param newStatus - Novo status que se deseja aplicar
 * @returns true se a transição é válida, false caso contrário
 */
export function isValidStatusTransition(
  currentStatus: DemandStatusType,
  newStatus: DemandStatusType
): boolean {
  // Se o status não mudou, sempre é válido
  if (currentStatus === newStatus) {
    return true
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus]
  return allowedTransitions.includes(newStatus)
}

/**
 * Obtém a mensagem de erro apropriada para uma transição inválida
 * @param currentStatus - Status atual da demanda
 * @param newStatus - Novo status que se deseja aplicar
 * @returns Mensagem de erro descritiva
 */
export function getStatusTransitionErrorMessage(
  currentStatus: DemandStatusType,
  newStatus: DemandStatusType
): string {
  if (currentStatus === 'BILLED') {
    return 'Uma demanda faturada não pode ter seu status alterado.'
  }

  if (newStatus === 'BILLED' && currentStatus !== 'RESOLVED') {
    return 'Uma demanda só pode ser faturada quando estiver com status RESOLVED (Resolvida).'
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus]
  if (allowedTransitions.length === 0) {
    return `O status ${currentStatus} não pode ser alterado.`
  }

  return `Não é possível alterar o status de ${currentStatus} para ${newStatus}.`
}

/**
 * Valida a transição de status e lança um erro se for inválida
 * @param currentStatus - Status atual da demanda
 * @param newStatus - Novo status que se deseja aplicar
 * @throws {Error} Se a transição não for válida
 */
export function validateStatusTransition(
  currentStatus: DemandStatusType,
  newStatus: DemandStatusType
): void {
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    throw new Error(getStatusTransitionErrorMessage(currentStatus, newStatus))
  }
}
