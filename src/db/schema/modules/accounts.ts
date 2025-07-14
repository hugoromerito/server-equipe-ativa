import { pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.ts'

export const accountProviderEnum = pgEnum('account_provider', [
  'FACEBOOK',
  'GITHUB',
  'GOOGLE',
])

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: accountProviderEnum().notNull(),
    provider_account_id: uuid().unique().notNull(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('provider_user_id').on(table.provider, table.user_id)]
)
