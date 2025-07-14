import { relations } from 'drizzle-orm'
import { accounts } from '../modules/accounts.ts'
import { demands } from '../modules/demands.ts'
import { invites } from '../modules/invites.ts'
import { members } from '../modules/members.ts'
import { organizations } from '../modules/organizations.ts'
import { tokens } from '../modules/tokens.ts'
import { units } from '../modules/units.ts'
import { users } from '../modules/users.ts'

export const usersRelations = relations(users, ({ many }) => ({
  tokens: many(tokens),
  accounts: many(accounts),
  invites: many(invites),
  member_on: many(members),
  owns_organizations: many(organizations),
  owns_units: many(units),
  owns_demands: many(demands),
}))
