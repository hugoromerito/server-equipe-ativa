import type { DemandStatusType, RoleType } from '../db/schema/enums.ts'
import { BadRequestError } from '../http/routes/_errors/bad-request-error.ts'

/**
 * Mapa de transições válidas de status
 * Define quais status podem mudar para quais outros status
 */
export const VALID_STATUS_TRANSITIONS: Record<
  DemandStatusType,
  DemandStatusType[]
> = {
  PENDING: ['CHECK_IN', 'IN_PROGRESS', 'RESOLVED'],
  CHECK_IN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['BILLED'],
  REJECTED: [], // REJECTED não pode mudar para nenhum outro status
  BILLED: [], // BILLED é status final
}

/**
 * Mapa de permissões por role para transições de status
 * Define quais roles podem fazer quais transições
 */
export const ROLE_STATUS_PERMISSIONS: Record<
  RoleType,
  { from: DemandStatusType[]; to: DemandStatusType[] }
> = {
  ADMIN: {
    from: ['PENDING', 'CHECK_IN', 'IN_PROGRESS', 'RESOLVED'],
    to: ['CHECK_IN', 'IN_PROGRESS', 'RESOLVED', 'BILLED'],
  },
  MANAGER: {
    from: [], // MANAGER não altera status diretamente
    to: [],
  },
  CLERK: {
    from: ['PENDING', 'CHECK_IN', 'IN_PROGRESS'],
    to: ['CHECK_IN', 'IN_PROGRESS', 'RESOLVED'],
  },
  ANALYST: {
    from: ['CHECK_IN', 'IN_PROGRESS'],
    to: ['IN_PROGRESS', 'RESOLVED'],
  },
  BILLING: {
    from: ['RESOLVED'],
    to: ['BILLED'],
  },
}

/**
 * Valida se uma transição de status é permitida
 *
 * @param fromStatus - Status atual da demand
 * @param toStatus - Status desejado
 * @throws {BadRequestError} Se a transição não for válida
 */
export function validateStatusTransition(
  fromStatus: DemandStatusType,
  toStatus: DemandStatusType
): void {
  // Se o status não mudou, não precisa validar
  if (fromStatus === toStatus) {
    return
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[fromStatus]

  if (!allowedTransitions.includes(toStatus)) {
    throw new BadRequestError(
      `Transição de status inválida: não é possível mudar de "${fromStatus}" para "${toStatus}".`
    )
  }
}

/**
 * Valida se uma role tem permissão para fazer uma transição de status
 *
 * @param role - Role do usuário
 * @param fromStatus - Status atual da demand
 * @param toStatus - Status desejado
 * @throws {BadRequestError} Se a role não tiver permissão
 */
export function validateRoleStatusPermission(
  role: RoleType,
  fromStatus: DemandStatusType,
  toStatus: DemandStatusType
): void {
  // Se o status não mudou, não precisa validar
  if (fromStatus === toStatus) {
    return
  }

  const permissions = ROLE_STATUS_PERMISSIONS[role]

  // Verifica se a role pode alterar DE um status específico
  if (!permissions.from.includes(fromStatus)) {
    throw new BadRequestError(
      `Você não tem permissão para alterar demands com status "${fromStatus}".`
    )
  }

  // Verifica se a role pode alterar PARA um status específico
  if (!permissions.to.includes(toStatus)) {
    throw new BadRequestError(
      `Você não tem permissão para alterar status para "${toStatus}".`
    )
  }
}

/**
 * Valida completamente uma transição de status
 * Verifica tanto se a transição é válida quanto se a role tem permissão
 *
 * @param role - Role do usuário
 * @param fromStatus - Status atual da demand
 * @param toStatus - Status desejado
 * @throws {BadRequestError} Se a transição não for válida ou a role não tiver permissão
 *
 * @example
 * ```typescript
 * // Válido: Médico pode mudar de CHECK_IN para IN_PROGRESS
 * validateCompleteStatusTransition('ANALYST', 'CHECK_IN', 'IN_PROGRESS')
 *
 * // Erro: Recepcionista não pode mudar para BILLED
 * validateCompleteStatusTransition('CLERK', 'RESOLVED', 'BILLED')
 * // Lança: "Você não tem permissão para alterar status para 'BILLED'."
 *
 * // Erro: Transição inválida
 * validateCompleteStatusTransition('ADMIN', 'BILLED', 'PENDING')
 * // Lança: "Transição de status inválida..."
 * ```
 */
export function validateCompleteStatusTransition(
  role: RoleType,
  fromStatus: DemandStatusType,
  toStatus: DemandStatusType
): void {
  // 1. Valida se a transição é permitida pelo fluxo
  validateStatusTransition(fromStatus, toStatus)

  // 2. Valida se a role tem permissão para esta transição
  validateRoleStatusPermission(role, fromStatus, toStatus)
}

/**
 * Obtém a lista de status possíveis a partir de um status atual para uma role específica
 *
 * @param role - Role do usuário
 * @param currentStatus - Status atual da demand
 * @returns Array com os status possíveis
 *
 * @example
 * ```typescript
 * getAvailableStatusTransitions('ANALYST', 'CHECK_IN')
 * // Retorna: ['IN_PROGRESS']
 *
 * getAvailableStatusTransitions('CLERK', 'PENDING')
 * // Retorna: ['CHECK_IN', 'IN_PROGRESS', 'RESOLVED']
 * ```
 */
export function getAvailableStatusTransitions(
  role: RoleType,
  currentStatus: DemandStatusType
): DemandStatusType[] {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus]
  const rolePermissions = ROLE_STATUS_PERMISSIONS[role]

  // Filtra apenas os status que a role tem permissão para alterar
  return validTransitions.filter(
    (status) =>
      rolePermissions.from.includes(currentStatus) &&
      rolePermissions.to.includes(status)
  )
}
