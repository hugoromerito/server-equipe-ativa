import { pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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

export const members = pgTable(
  'members',
  {
    id: uuid().primaryKey().defaultRandom(),
    organization_role: roleEnum().default('CLERK').notNull(),
    unit_role: roleEnum(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    unit_id: uuid().references(() => units.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('user_id_organization_id_unit_id').on(
      table.user_id,
      table.organization_id,
      table.unit_id
    ),
  ]
)
