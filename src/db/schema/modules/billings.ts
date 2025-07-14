import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

export const billings = pgTable('billings', {
  id: uuid().primaryKey().defaultRandom(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
})
