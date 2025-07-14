import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().unique().notNull(),
  domain: text().unique(),
  should_attach_users_by_domain: boolean().default(false),
  avatar_url: text(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
  owner_id: uuid().notNull(),
})
