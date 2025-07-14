import { relations } from 'drizzle-orm'
import { demands } from '../modules/demands.ts'
import { invites } from '../modules/invites.ts'
import { members } from '../modules/members.ts'
import { organizations } from '../modules/organizations.ts'
import { units } from '../modules/units.ts'
import { users } from '../modules/users.ts'

export const unitRelations = relations(units, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [units.organization_id],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [units.owner_id],
    references: [users.id],
  }),
  invites: many(invites),
  members: many(members),
  demands: many(demands),
}))
