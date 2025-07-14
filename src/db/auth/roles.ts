import { z } from 'zod/v4'

export const roleSchema = z.union([
  z.literal('ADMIN'),
  z.literal('MANAGER'),
  z.literal('CLERK'),
  z.literal('ANALYST'),
  // z.literal('APPLICANT'),
  z.literal('BILLING'),
])

export type Role = z.infer<typeof roleSchema>
