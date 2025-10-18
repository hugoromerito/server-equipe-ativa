import {
  date,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth.ts'
import {
  demandCategoryEnum,
  demandPriorityEnum,
  demandStatusEnum,
} from './enums.ts'
import { members, organizations, units } from './organization.ts'

export const demands = pgTable('demands', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text().notNull(),
  status: demandStatusEnum().default('PENDING').notNull(),
  priority: demandPriorityEnum().notNull(),
  category: demandCategoryEnum().notNull(),
  
  // Campos de agendamento
  scheduled_date: date(), // Data agendada para atendimento
  scheduled_time: time(), // Hora agendada para atendimento
  responsible_id: uuid().references(() => members.id, { onDelete: 'set null' }), // Profissional responsável pelo atendimento
  
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

export const applicants = pgTable(
  'applicants',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    phone: text().notNull(),
    birthdate: date().notNull(),
    cpf: text().notNull(),
    ticket: text(),
    sus_card: text(),
    mother: text(),
    father: text(),
    zip_code: text(),
    state: text(),
    city: text(),
    street: text(),
    neighborhood: text(),
    complement: text(),
    number: text(),
    attachment: text(),
    observation: text(),
    avatar_url: text(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp(),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
  },
  (table) => [
    uniqueIndex('cpf_organization_id').on(table.cpf, table.organization_id),
  ]
)
