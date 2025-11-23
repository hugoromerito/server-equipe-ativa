/**
 * Domain Types - Billing & Payments
 * 
 * Types and interfaces for billing, subscriptions and payments
 */

export type PlanInterval = 'month' | 'year'

export type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'past_due' 
  | 'trialing' 
  | 'unpaid'

export type PaymentStatus = 
  | 'pending' 
  | 'succeeded' 
  | 'failed' 
  | 'canceled' 
  | 'refunded'

export type PaymentMethodType = 'card' | 'boleto' | 'pix'

export interface Plan {
  id: string
  name: string
  description: string | null
  amount: number
  interval: PlanInterval
  stripeProductId: string
  stripePriceId: string
  features: string[]
  maxMembers: number | null
  maxUnits: number | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Subscription {
  id: string
  organizationId: string
  planId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Payment {
  id: string
  subscriptionId: string
  stripePaymentIntentId: string
  amount: number
  status: PaymentStatus
  paidAt: Date | null
  createdAt: Date
}

export interface PaymentMethod {
  id: string
  organizationId: string
  stripePaymentMethodId: string
  type: PaymentMethodType
  last4: string | null
  brand: string | null
  expiryMonth: number | null
  expiryYear: number | null
  isDefault: boolean
  createdAt: Date
}
