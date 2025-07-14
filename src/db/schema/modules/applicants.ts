import {
  date,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'

export const applicants = pgTable(
  'applicants',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    phone: text().notNull(),
    birthdate: date().notNull(),
    cpf: text().notNull(),
    mother: text(),
    father: text(),
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
