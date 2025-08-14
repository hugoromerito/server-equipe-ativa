import { relations } from 'drizzle-orm'
import { accounts, tokens, users } from './auth.ts'
import { applicants, demands } from './demands.ts'
import { invites, members, organizations, units } from './organization.ts'

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.user_id],
    references: [users.id],
  }),
}))

export const applicantsRelations = relations(applicants, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [applicants.organization_id],
    references: [organizations.id],
  }),
  demands: many(demands),
}))

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

export const tokensRelations = relations(tokens, ({ one }) => ({
  user: one(users, {
    fields: [tokens.user_id],
    references: [users.id],
  }),
}))

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

export const usersRelations = relations(users, ({ many }) => ({
  tokens: many(tokens),
  accounts: many(accounts),
  invites: many(invites),
  member_on: many(members),
  owns_organizations: many(organizations),
  owns_units: many(units),
  owns_demands: many(demands),
}))
