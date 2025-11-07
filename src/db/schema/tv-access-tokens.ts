import { pgTable, text, timestamp, uuid, varchar, integer, index } from 'drizzle-orm/pg-core'
import { organizations } from './organization.ts'
import { units } from './organization.ts'
import { users } from './auth.ts'
import { tvTokenStatusEnum } from './enums.ts'

/**
 * Tabela de tokens de acesso para TVs
 * Permite acesso sem login para exibir chamadas de pacientes em tempo real
 */
export const tvAccessTokens = pgTable(
  'tv_access_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    
    // Código de 6 caracteres (alfanumérico, único)
    code: varchar({ length: 6 }).unique().notNull(),
    
    // Relacionamentos
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    
    // Metadados
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    
    // Status e validade
    status: tvTokenStatusEnum().notNull().default('ACTIVE'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    
    // Auditoria
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id, { 
      onDelete: 'set null' 
    }),
    
    // Controle de uso
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastIpAddress: varchar('last_ip_address', { length: 45 }), // Suporta IPv6
    usageCount: integer('usage_count').notNull().default(0),
  },
  (table) => [
    index('idx_tv_access_tokens_code').on(table.code),
    index('idx_tv_access_tokens_status').on(table.status),
    index('idx_tv_access_tokens_organization').on(table.organizationId),
    index('idx_tv_access_tokens_unit').on(table.unitId),
    index('idx_tv_access_tokens_expires_at').on(table.expiresAt),
  ]
)
