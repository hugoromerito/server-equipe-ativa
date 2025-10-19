// role.ts
import { pgEnum } from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'

// Definir os valores uma vez
export const ROLE_VALUES = ['ADMIN', 'MANAGER', 'CLERK', 'ANALYST', 'BILLING'] as const

export const ACCOUNT_PROVIDER_VALUES = ['FACEBOOK', 'GITHUB', 'GOOGLE'] as const

export const TOKEN_TYPE_VALUES = ['PASSWORD_RECOVER', 'EMAIL_VERIFICATION'] as const

export const DEMAND_STATUS_VALUES = [
  'PENDING',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
  'BILLED',
] as const

export const DEMAND_CATEGORY_VALUES = [
  'SOCIAL_WORKER',
  'PSYCHOMOTOR_PHYSIOTHERAPIST',
  'SPEECH_THERAPIST',
  'MUSIC_THERAPIST',
  'NEUROPSYCHOPEDAGOGUE',
  'NEUROPSYCHOLOGIST',
  'NUTRITIONIST',
  'PSYCHOLOGIST',
  'PSYCHOMOTRICIAN',
  'PSYCHOPEDAGOGUE',
  'THERAPIST',
  'OCCUPATIONAL_THERAPIST',
] as const

export const DEMAND_PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

export const ATTACHMENT_TYPE_VALUES = [
  'AVATAR',
  'DOCUMENT',
  'IDENTITY',
  'ADDRESS',
  'INCOME',
  'MEDICAL',
  'LEGAL',
  'OTHER',
] as const

export const WEEKDAY_VALUES = [
  'DOMINGO',
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
] as const

// Enums para Drizzle (Database)
export const roleEnum = pgEnum('role', ROLE_VALUES)
export const accountProviderEnum = pgEnum(
  'account_provider',
  ACCOUNT_PROVIDER_VALUES
)
export const tokenTypeEnum = pgEnum('token_type', TOKEN_TYPE_VALUES)
export const demandStatusEnum = pgEnum('demand_status', DEMAND_STATUS_VALUES)
export const demandCategoryEnum = pgEnum(
  'demand_category',
  DEMAND_CATEGORY_VALUES
)
export const demandPriorityEnum = pgEnum(
  'demand_priority',
  DEMAND_PRIORITY_VALUES
)

export const attachmentTypeEnum = pgEnum(
  'attachment_type',
  ATTACHMENT_TYPE_VALUES
)

export const weekdayEnum = pgEnum('weekday', WEEKDAY_VALUES)

// Enums para Zod (Validation)
export const roleZodEnum = z.enum(ROLE_VALUES)
export const accountProviderZodEnum = z.enum(ACCOUNT_PROVIDER_VALUES)
export const tokenTypeZodEnum = z.enum(TOKEN_TYPE_VALUES)
export const demandStatusZodEnum = z.enum(DEMAND_STATUS_VALUES)
export const demandCategoryZodEnum = z.enum(DEMAND_CATEGORY_VALUES)
export const demandPriorityZodEnum = z.enum(DEMAND_PRIORITY_VALUES)
export const weekdayZodEnum = z.enum(WEEKDAY_VALUES)

// Types
export type RoleType = z.infer<typeof roleZodEnum>
export type AccountProviderType = z.infer<typeof accountProviderZodEnum>
export type TokenTypeType = z.infer<typeof tokenTypeZodEnum>
export type DemandStatusType = z.infer<typeof demandStatusZodEnum>
export type DemandCategoryType = z.infer<typeof demandCategoryZodEnum>
export type DemandPriorityType = z.infer<typeof demandPriorityZodEnum>
export type WeekdayType = z.infer<typeof weekdayZodEnum>
