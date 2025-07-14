import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.ts'

export const tokenTypeEnum = pgEnum('token_type', [
  'PASSWORD_RECOVER',
  'EMAIL_VERIFICATION',
])

export const tokens = pgTable('tokens', {
  id: uuid().primaryKey().defaultRandom(),
  type: tokenTypeEnum().notNull(),
  created_at: timestamp().defaultNow(),
  user_id: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})
