import { z } from 'zod'

// Schemas para Plans
export const planIntervalSchema = z.enum([
  'monthly',
  'quarterly',
  'yearly',
])

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z
    .string()
    .min(1, 'Slug é obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido'),
  interval: planIntervalSchema.default('monthly'),
  trial_days: z.number().int().min(0).default(0),
  features: z.array(z.string()).default([]),
  max_members: z.number().int().positive().nullable().optional(),
  max_units: z.number().int().positive().nullable().optional(),
  max_demands: z.number().int().positive().nullable().optional(),
  max_storage_gb: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().default(true),
})

export const updatePlanSchema = createPlanSchema.partial()

export const getPlanSchema = z.object({
  planId: z.string().uuid(),
})

// Schemas para Subscriptions
export const subscriptionStatusSchema = z.enum([
  'active',
  'canceled',
  'past_due',
  'trialing',
  'unpaid',
])

export const createSubscriptionSchema = z.object({
  organization_id: z.string().uuid('ID de organização inválido'),
  plan_id: z.string().uuid('ID de plano inválido'),
  payment_method_id: z.string().uuid('ID de método de pagamento inválido').optional(),
  trial_days: z.number().int().min(0).optional(),
})

export const updateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  plan_id: z.string().uuid().optional(),
  status: subscriptionStatusSchema.optional(),
})

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  cancel_immediately: z.boolean().default(false), // Se true, cancela imediatamente, senão no fim do período
})

export const getSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
})

// Schemas para Payment Methods
export const paymentMethodTypeSchema = z.enum([
  'credit_card',
  'debit_card',
  'pix',
  'boleto',
])

export const createPaymentMethodSchema = z.object({
  organization_id: z.string().uuid('ID de organização inválido'),
  type: paymentMethodTypeSchema,
  stripe_payment_method_id: z.string().optional(),
  is_default: z.boolean().default(false),
  card_brand: z.string().optional(),
  card_last4: z.string().length(4).optional(),
  card_exp_month: z.number().int().min(1).max(12).optional(),
  card_exp_year: z.number().int().min(new Date().getFullYear()).optional(),
})

export const updatePaymentMethodSchema = z.object({
  paymentMethodId: z.string().uuid(),
  is_default: z.boolean().optional(),
})

export const deletePaymentMethodSchema = z.object({
  paymentMethodId: z.string().uuid(),
})

// Schemas para Payments
export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
])

export const getPaymentSchema = z.object({
  paymentId: z.string().uuid(),
})

export const listPaymentsSchema = z.object({
  subscription_id: z.string().uuid().optional(),
  status: paymentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
})

// Schema para Stripe Webhook
export const stripeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.record(z.unknown()),
  }),
})

// Schema para Usage Records
export const createUsageRecordSchema = z.object({
  subscription_id: z.string().uuid(),
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
  members_count: z.number().int().min(0).default(0),
  units_count: z.number().int().min(0).default(0),
  demands_count: z.number().int().min(0).default(0),
  storage_used_gb: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
})

export const getUsageRecordSchema = z.object({
  subscription_id: z.string().uuid(),
  period_start: z.coerce.date().optional(),
  period_end: z.coerce.date().optional(),
})

// Response schemas
export const planResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  price: z.string(),
  interval: planIntervalSchema,
  trial_days: z.number(),
  features: z.array(z.string()),
  max_members: z.number().nullable(),
  max_units: z.number().nullable(),
  max_demands: z.number().nullable(),
  max_storage_gb: z.number().nullable(),
  is_active: z.boolean(),
  stripe_product_id: z.string().nullable().optional(),
  stripe_price_id: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable(),
})

export const subscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: subscriptionStatusSchema,
  current_period_start: z.string().datetime(),
  current_period_end: z.string().datetime(),
  trial_end: z.string().datetime().nullable(),
  canceled_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
  stripe_subscription_id: z.string().nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable(),
})

export const paymentMethodResponseSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  type: paymentMethodTypeSchema,
  is_default: z.boolean(),
  card_brand: z.string().nullable(),
  card_last4: z.string().nullable(),
  card_exp_month: z.number().nullable(),
  card_exp_year: z.number().nullable(),
  stripe_payment_method_id: z.string().nullable().optional(),
  created_at: z.string().datetime(),
})

export const paymentResponseSchema = z.object({
  id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  amount: z.string(),
  currency: z.string(),
  status: paymentStatusSchema,
  payment_method_id: z.string().uuid().nullable(),
  failure_reason: z.string().nullable(),
  paid_at: z.string().datetime().nullable(),
  refunded_at: z.string().datetime().nullable(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  created_at: z.string().datetime(),
})

// Type exports
export type CreatePlan = z.infer<typeof createPlanSchema>
export type UpdatePlan = z.infer<typeof updatePlanSchema>
export type CreateSubscription = z.infer<typeof createSubscriptionSchema>
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>
export type CancelSubscription = z.infer<typeof cancelSubscriptionSchema>
export type CreatePaymentMethod = z.infer<typeof createPaymentMethodSchema>
export type UpdatePaymentMethod = z.infer<typeof updatePaymentMethodSchema>
export type ListPayments = z.infer<typeof listPaymentsSchema>
export type CreateUsageRecord = z.infer<typeof createUsageRecordSchema>
export type GetUsageRecord = z.infer<typeof getUsageRecordSchema>
export type PlanResponse = z.infer<typeof planResponseSchema>
export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>
export type PaymentMethodResponse = z.infer<typeof paymentMethodResponseSchema>
export type PaymentResponse = z.infer<typeof paymentResponseSchema>
