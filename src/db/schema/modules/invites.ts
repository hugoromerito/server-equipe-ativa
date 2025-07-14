import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { units } from './units.ts'
import { users } from './users.ts'

export const roleEnum = pgEnum('role', [
  'ADMIN',
  'MANAGER',
  'CLERK',
  'ANALYST',
  'BILLING',
])

export const invites = pgTable(
  'invites',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    role: roleEnum().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    author_id: uuid().references(() => users.id, { onDelete: 'cascade' }),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    unit_id: uuid().references(() => units.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('email_organization_id_unit_id').on(
      table.email,
      table.organization_id,
      table.unit_id
    ),
    index('email').on(table.email),
  ]
)
