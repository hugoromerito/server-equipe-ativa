import { accountProviderEnum, accounts } from './modules/accounts.ts'
import { applicants } from './modules/applicants.ts'
import { billings } from './modules/billings.ts'
import {
  demandCategoryEnum,
  demandPriorityEnum,
  demandStatusEnum,
  demands,
} from './modules/demands.ts'
import { invites, roleEnum } from './modules/invites.ts'
import { members } from './modules/members.ts'
import { organizations } from './modules/organizations.ts'
import { tokens, tokenTypeEnum } from './modules/tokens.ts'
import { units } from './modules/units.ts'
import { users } from './modules/users.ts'

export const schema = {
  accounts,
  applicants,
  billings,
  demands,
  invites,
  members,
  organizations,
  tokens,
  units,
  users,
  accountProviderEnum,
  demandPriorityEnum,
  demandCategoryEnum,
  demandStatusEnum,
  tokenTypeEnum,
  roleEnum,
}
