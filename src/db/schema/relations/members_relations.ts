import { relations } from 'drizzle-orm'
import { demands } from '../modules/demands.ts'
import { members } from '../modules/members.ts'
import { organizations } from '../modules/organizations.ts'
import { units } from '../modules/units.ts'
import { users } from '../modules/users.ts'

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, {
    fields: [members.user_id],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [members.organization_id],
    references: [organizations.id],
  }),
  unit: one(units, {
    fields: [members.unit_id],
    references: [units.id],
  }),
  demands: many(demands),
}))
