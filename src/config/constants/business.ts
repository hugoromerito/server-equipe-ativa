/**
 * Business Constants
 * 
 * Constants related to business logic and rules
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  ANALYST: 'ANALYST',
  BILLING: 'BILLING',
} as const

export const DEMAND_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  WAITING_APPROVAL: 'waiting_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const

export const DEMAND_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const

export const DEMAND_CATEGORY = {
  MAINTENANCE: 'maintenance',
  INSTALLATION: 'installation',
  INSPECTION: 'inspection',
  REPAIR: 'repair',
  OTHER: 'other',
} as const

export const WEEK_DAYS = {
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday',
} as const

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing',
  UNPAID: 'unpaid',
} as const

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
} as const

export const TV_TOKEN_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
} as const

export const TV_TOKEN_CONFIG = {
  CODE_LENGTH: 6,
  CODE_EXPIRY_MINUTES: 10,
  TOKEN_EXPIRY_DAYS: 365,
} as const

export const JWT_CONFIG = {
  DEFAULT_EXPIRES_IN: '7d',
  ALGORITHM: 'HS256',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]
export type DemandStatus = typeof DEMAND_STATUS[keyof typeof DEMAND_STATUS]
export type DemandPriority = typeof DEMAND_PRIORITY[keyof typeof DEMAND_PRIORITY]
export type DemandCategory = typeof DEMAND_CATEGORY[keyof typeof DEMAND_CATEGORY]
export type WeekDay = typeof WEEK_DAYS[keyof typeof WEEK_DAYS]
