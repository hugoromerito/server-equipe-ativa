import { relations } from 'drizzle-orm'
import { accounts } from '../modules/accounts.ts'
import { users } from '../modules/users.ts'

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.user_id],
    references: [users.id],
  }),
}))
