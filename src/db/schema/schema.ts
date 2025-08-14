import { accounts, tokens, users } from './auth.ts'
import { billings } from './billings.ts'
import { applicants, demands } from './demands.ts'
import {
  accountProviderEnum,
  accountProviderZodEnum,
  demandCategoryEnum,
  demandCategoryZodEnum,
  demandPriorityEnum,
  demandPriorityZodEnum,
  demandStatusEnum,
  demandStatusZodEnum,
  roleEnum,
  roleZodEnum,
  tokenTypeEnum,
  tokenTypeZodEnum,
} from './enums.ts'
import { invites, members, organizations, units } from './organization.ts'

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
  roleZodEnum,
  tokenTypeZodEnum,
  accountProviderZodEnum,
  demandPriorityZodEnum,
  demandCategoryZodEnum,
  demandStatusZodEnum,
}
export type Schema = typeof schema
