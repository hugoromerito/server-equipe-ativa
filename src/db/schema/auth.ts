import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { accountProviderEnum, tokenTypeEnum } from './enums.ts'

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text(),
  email: text().unique().notNull(),
  password_hash: text(),
  avatar_url: text(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
  last_seen: timestamp('last_seen', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: accountProviderEnum().notNull(),
    provider_account_id: text().unique().notNull(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('provider_user_id').on(table.provider, table.user_id)]
)

export const tokens = pgTable('tokens', {
  id: uuid().primaryKey().defaultRandom(),
  type: tokenTypeEnum().notNull(),
  created_at: timestamp().defaultNow(),
  user_id: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})
