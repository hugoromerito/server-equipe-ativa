// import { defineAbilityFor, userSchema, type Role } from '@/auth/src'

import { defineAbilityFor } from '../../db/auth/index.ts'
import { userSchema } from '../../db/auth/models/user.ts'
import type { Role } from '../../db/schema/enums/role.ts'

export function getUserPermissions(userId: string, role: Role) {
  const authUser = userSchema.parse({
    id: userId,
    role,
  })

  const ability = defineAbilityFor(authUser)

  return ability
}
