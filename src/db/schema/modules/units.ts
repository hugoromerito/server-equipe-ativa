import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { users } from './users.ts'

export const units = pgTable(
  'units',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
    domain: text().unique(),
    description: text(),
    location: text().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp(),
    owner_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
  },

  (table) => [
    uniqueIndex('unit_slug_org_id').on(table.slug, table.organization_id),
  ]
)
