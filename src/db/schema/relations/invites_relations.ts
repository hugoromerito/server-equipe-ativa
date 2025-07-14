import { relations } from 'drizzle-orm'
import { invites } from '../modules/invites.ts'
import { organizations } from '../modules/organizations.ts'
import { units } from '../modules/units.ts'
import { users } from '../modules/users.ts'

export const inviteRelations = relations(invites, ({ one }) => ({
  author: one(users, {
    fields: [invites.author_id],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [invites.organization_id],
    references: [organizations.id],
  }),
  unit: one(units, {
    fields: [invites.unit_id],
    references: [units.id],
  }),
}))
