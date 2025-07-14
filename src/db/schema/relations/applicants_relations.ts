import { relations } from 'drizzle-orm'
import { applicants } from '../modules/applicants.ts'
import { demands } from '../modules/demands.ts'
import { organizations } from '../modules/organizations.ts'

export const applicantsRelations = relations(applicants, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [applicants.organization_id],
    references: [organizations.id],
  }),
  demands: many(demands),
}))
