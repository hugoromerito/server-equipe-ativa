import { relations } from 'drizzle-orm'
import { applicants } from '../modules/applicants.ts'
import { invites } from '../modules/invites.ts'
import { members } from '../modules/members.ts'
import { organizations } from '../modules/organizations.ts'
import { units } from '../modules/units.ts'
import { users } from '../modules/users.ts'

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [organizations.owner_id],
      references: [users.id],
    }),
    invites: many(invites),
    members: many(members),
    units: many(units),
    applicants: many(applicants),
  })
)
