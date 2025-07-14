import { relations } from 'drizzle-orm'
import { applicants } from '../modules/applicants.ts'
import { demands } from '../modules/demands.ts'
import { members } from '../modules/members.ts'
import { units } from '../modules/units.ts'
import { users } from '../modules/users.ts'

export const demandsRelations = relations(demands, ({ one }) => ({
  unit: one(units, {
    fields: [demands.unit_id],
    references: [units.id],
  }),
  applicant: one(applicants, {
    fields: [demands.applicant_id],
    references: [applicants.id],
  }),
  owner: one(users, {
    fields: [demands.owner_id],
    references: [users.id],
  }),
  member: one(members, {
    fields: [demands.member_id],
    references: [members.id],
  }),
}))
