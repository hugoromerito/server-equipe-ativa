import { relations } from 'drizzle-orm'
import { tokens } from '../modules/tokens.ts'
import { users } from '../modules/users.ts'

export const tokensRelations = relations(tokens, ({ one }) => ({
  user: one(users, {
    fields: [tokens.user_id],
    references: [users.id],
  }),
}))
