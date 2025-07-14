// role.ts
import { z } from 'zod/v4'

export const roleEnum = z.enum([
  'ADMIN',
  'MANAGER',
  'CLERK',
  'ANALYST',
  'BILLING',
])
export type Role = z.infer<typeof roleEnum>
