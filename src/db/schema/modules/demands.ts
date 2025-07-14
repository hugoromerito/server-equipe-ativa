import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { applicants } from './applicants.ts'
import { members } from './members.ts'
import { units } from './units.ts'
import { users } from './users.ts'

// AGUARDANDO - EM ANDAMENTO - RESOLVIDO - REJEITADO
export const demandStatusEnum = pgEnum('demand_status', [
  'PENDING',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
])

export const demandCategoryEnum = pgEnum('demand_category', [
  'INFRASTRUCTURE',
  'HEALTH',
  'EDUCATION',
  'SOCIAL_ASSISTANCE',
  'PUBLICA_SAFETY',
  'TRANSPORTATION',
  'EMPLOYMENT',
  'CULTURE',
  'ENVIRONMENT',
  'HUMAN_HIGHTS',
  'TECHNOLOGY',
])

export const demandPriorityEnum = pgEnum('demand_priority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
])

export const demands = pgTable('demands', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text().notNull(),
  status: demandStatusEnum().default('PENDING').notNull(),
  priority: demandPriorityEnum().notNull(),
  category: demandCategoryEnum().notNull(),
  zip_code: text(),
  state: text(),
  city: text(),
  street: text(),
  neighborhood: text(),
  complement: text(),
  number: text(),
  attachment: text(),
  created_by_member_name: text().notNull(),
  updated_by_member_name: text(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
  applicant_id: uuid()
    .notNull()
    .references(() => applicants.id, { onDelete: 'restrict' }),
  unit_id: uuid()
    .notNull()
    .references(() => units.id, { onDelete: 'restrict' }),
  owner_id: uuid().references(() => users.id, { onDelete: 'set null' }),
  member_id: uuid().references(() => members.id, { onDelete: 'set null' }),
})
