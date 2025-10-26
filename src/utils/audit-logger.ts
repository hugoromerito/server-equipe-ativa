// Imports necessários
import { desc, eq } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import { demandStatusAuditLog } from '../db/schema/audit.ts'
import type { DemandStatusType, RoleType } from '../db/schema/enums.ts'

export interface AuditLogInput {
  demandId: string
  previousStatus: DemandStatusType
  newStatus: DemandStatusType
  changedByUserId: string
  changedByMemberId?: string | null
  changedByUserName: string | null
  changedByRole: RoleType
  reason?: string
  metadata?: Record<string, unknown>
}

/**
 * Registra uma mudança de status de demand no log de auditoria
 *
 * @param input - Dados da mudança de status
 * @returns O registro de auditoria criado
 *
 * @example
 * ```typescript
 * await logDemandStatusChange({
 *   demandId: 'demand-123',
 *   previousStatus: 'CHECK_IN',
 *   newStatus: 'IN_PROGRESS',
 *   changedByUserId: 'user-456',
 *   changedByMemberId: 'member-789',
 *   changedByUserName: 'Dr. João Silva',
 *   changedByRole: 'ANALYST',
 *   reason: 'Iniciando consulta com paciente',
 *   metadata: {
 *     ip: '192.168.1.1',
 *     userAgent: 'Mozilla/5.0...'
 *   }
 * })
 * ```
 */
export async function logDemandStatusChange(input: AuditLogInput) {
  const {
    demandId,
    previousStatus,
    newStatus,
    changedByUserId,
    changedByMemberId,
    changedByUserName,
    changedByRole,
    reason,
    metadata,
  } = input

  // Não registra se o status não mudou
  if (previousStatus === newStatus) {
    return null
  }

  const [auditLog] = await db
    .insert(demandStatusAuditLog)
    .values({
      demand_id: demandId,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by_user_id: changedByUserId,
      changed_by_member_id: changedByMemberId || null,
      changed_by_user_name: changedByUserName || 'Sistema',
      changed_by_role: changedByRole,
      reason: reason || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .returning()

  return auditLog
}

/**
 * Busca o histórico de mudanças de status de uma demand
 *
 * @param demandId - ID da demand
 * @returns Array com todos os logs de auditoria da demand, ordenados do mais recente ao mais antigo
 *
 * @example
 * ```typescript
 * const history = await getDemandStatusHistory('demand-123')
 * // Retorna:
 * // [
 * //   { previous_status: 'IN_PROGRESS', new_status: 'RESOLVED', changed_by_user_name: 'Dr. João', ... },
 * //   { previous_status: 'CHECK_IN', new_status: 'IN_PROGRESS', changed_by_user_name: 'Dr. João', ... },
 * //   { previous_status: 'PENDING', new_status: 'CHECK_IN', changed_by_user_name: 'Maria', ... }
 * // ]
 * ```
 */
export async function getDemandStatusHistory(demandId: string) {
  const history = await db
    .select()
    .from(demandStatusAuditLog)
    .where(eq(demandStatusAuditLog.demand_id, demandId))
    .orderBy(desc(demandStatusAuditLog.changed_at))

  return history.map((log) => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }))
}

/**
 * Busca todas as mudanças de status feitas por um usuário específico
 *
 * @param userId - ID do usuário
 * @param limit - Número máximo de registros a retornar (padrão: 50)
 * @returns Array com os logs de auditoria do usuário
 */
export async function getUserAuditHistory(userId: string, limit = 50) {
  const history = await db
    .select()
    .from(demandStatusAuditLog)
    .where(eq(demandStatusAuditLog.changed_by_user_id, userId))
    .orderBy(desc(demandStatusAuditLog.changed_at))
    .limit(limit)

  return history.map((log) => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }))
}
