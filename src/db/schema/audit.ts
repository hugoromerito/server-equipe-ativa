import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth.ts'
import { demands } from './demands.ts'
import { demandStatusEnum } from './enums.ts'
import { members } from './organization.ts'

/**
 * Tabela de auditoria para mudanças de status em demands
 * Registra todas as alterações de status para rastreabilidade e compliance
 */
export const demandStatusAuditLog = pgTable('demand_status_audit_log', {
  id: uuid().primaryKey().defaultRandom(),
  
  // Referência à demand que teve o status alterado
  demand_id: uuid()
    .notNull()
    .references(() => demands.id, { onDelete: 'cascade' }),
  
  // Status anterior e novo status
  previous_status: demandStatusEnum().notNull(),
  new_status: demandStatusEnum().notNull(),
  
  // Quem fez a alteração
  changed_by_user_id: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'set null' }),
  changed_by_member_id: uuid().references(() => members.id, {
    onDelete: 'set null',
  }),
  changed_by_user_name: text().notNull(),
  changed_by_role: text().notNull(), // Role do usuário no momento da mudança
  
  // Motivo da mudança (opcional)
  reason: text(),
  
  // Metadados adicionais (JSON opcional)
  metadata: text(), // Armazena JSON string com informações extras se necessário
  
  // Timestamp da mudança
  changed_at: timestamp().defaultNow().notNull(),
})
