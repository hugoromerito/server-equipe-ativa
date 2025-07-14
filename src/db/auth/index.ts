import {
  AbilityBuilder,
  type CreateAbility,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'
import { z } from 'zod/v4'
import type { User } from './models/user.ts'
import { permissions } from './permissions.ts'
import { applicantSubject } from './subjects/applicant.ts'
import { billingSubject } from './subjects/billing.ts'
import { demandSubject } from './subjects/demand.ts'
import { inviteSubject } from './subjects/invite.ts'
import { organizationSubject } from './subjects/organization.ts'
import { unitSubject } from './subjects/unit.ts'
import { userSubject } from './subjects/user.ts'

export * from './demand-category.ts'
export * from './demand-priority.ts'
export * from './demand-status.ts'
export * from './models/demand.ts'
export * from './models/organization.ts'
export * from './models/unit.ts'
export * from './models/user.ts'
export * from './roles.ts'

const appAbilities = z.union([
  userSubject,
  unitSubject,
  applicantSubject,
  demandSubject,
  inviteSubject,
  billingSubject,
  organizationSubject,
  z.tuple([z.literal('manage'), z.literal('all')]),
])

type AppAbilities = z.infer<typeof appAbilities>

export type AppAbility = MongoAbility<AppAbilities>
export const createAppAbility = createMongoAbility as CreateAbility<AppAbility>

export function defineAbilityFor(user: User) {
  const builder = new AbilityBuilder(createAppAbility)

  if (typeof permissions[user.role] !== 'function') {
    throw new Error(`Permissions for role ${user.role} not found.`)
  }

  permissions[user.role](user, builder)

  const ability = builder.build({
    detectSubjectType(subject) {
      return subject.__typename
    },
  })

  ability.can = ability.can.bind(ability)
  ability.cannot = ability.cannot.bind(ability)

  return ability
}
