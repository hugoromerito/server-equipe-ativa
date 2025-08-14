// import { defineAbilityFor, userSchema, type Role } from '@/auth/src'

import { defineAbilityFor } from '../../db/auth/index.ts'
import { userSchema } from '../../db/auth/models/user.ts'
import type { RoleType } from '../../db/schema/enums.ts'

export function getUserPermissions(userId: string, role: RoleType) {
  const authUser = userSchema.parse({
    id: userId,
    role,
  })

  const ability = defineAbilityFor(authUser)

  return ability
}
