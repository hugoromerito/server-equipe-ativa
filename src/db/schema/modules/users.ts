import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text(),
  email: text().unique().notNull(),
  password_hash: text(),
  avatar_url: text(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
})
