import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { organizations } from './organization.ts'

// Enums para billing
export const planIntervalEnum = pgEnum('plan_interval', [
  'monthly',
  'quarterly',
  'yearly',
])

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'canceled',
  'past_due',
  'trialing',
  'unpaid',
])

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
])

export const paymentMethodTypeEnum = pgEnum('payment_method_type', [
  'credit_card',
  'debit_card',
  'pix',
  'boleto',
])

// Tabela de planos disponíveis
export const plans = pgTable('plans', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(), // Ex: "Básico", "Profissional", "Empresarial"
  slug: text().unique().notNull(), // Ex: "basic", "professional", "enterprise"
  description: text(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(), // Preço em BRL
  interval: planIntervalEnum().notNull().default('monthly'), // Intervalo de cobrança
  trial_days: integer().default(0), // Dias de trial gratuito
  features: jsonb().$type<string[]>().notNull().default([]), // Lista de features do plano
  max_members: integer(), // Limite de membros (null = ilimitado)
  max_units: integer(), // Limite de unidades (null = ilimitado)
  max_demands: integer(), // Limite de demandas por mês (null = ilimitado)
  max_storage_gb: integer(), // Limite de armazenamento em GB (null = ilimitado)
  is_active: boolean().default(true).notNull(), // Se o plano está disponível para venda
  stripe_price_id: text(), // ID do preço no Stripe
  stripe_product_id: text(), // ID do produto no Stripe
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
})

// Tabela de assinaturas das organizações
export const subscriptions = pgTable('subscriptions', {
  id: uuid().primaryKey().defaultRandom(),
  organization_id: uuid()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  plan_id: uuid()
    .notNull()
    .references(() => plans.id, { onDelete: 'restrict' }),
  status: subscriptionStatusEnum().notNull().default('trialing'),
  current_period_start: timestamp().notNull(),
  current_period_end: timestamp().notNull(),
  trial_end: timestamp(), // Data de término do trial
  canceled_at: timestamp(), // Data de cancelamento (se cancelado)
  ended_at: timestamp(), // Data de término definitivo
  stripe_subscription_id: text(), // ID da assinatura no Stripe
  metadata: jsonb().$type<Record<string, unknown>>(), // Metadados adicionais
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
})

// Tabela de pagamentos
export const payments = pgTable('payments', {
  id: uuid().primaryKey().defaultRandom(),
  subscription_id: uuid()
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // Valor pago
  currency: text().notNull().default('BRL'), // Moeda
  status: paymentStatusEnum().notNull().default('pending'),
  payment_method_id: uuid().references(() => paymentMethods.id, {
    onDelete: 'set null',
  }),
  stripe_payment_intent_id: text(), // ID do PaymentIntent no Stripe
  stripe_charge_id: text(), // ID da cobrança no Stripe
  failure_reason: text(), // Motivo de falha (se houver)
  paid_at: timestamp(), // Data de pagamento bem-sucedido
  refunded_at: timestamp(), // Data de reembolso (se houver)
  metadata: jsonb().$type<Record<string, unknown>>(), // Metadados adicionais
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
})

// Tabela de métodos de pagamento
export const paymentMethods = pgTable('payment_methods', {
  id: uuid().primaryKey().defaultRandom(),
  organization_id: uuid()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  type: paymentMethodTypeEnum().notNull(),
  is_default: boolean().default(false).notNull(),
  stripe_payment_method_id: text(), // ID do PaymentMethod no Stripe
  card_brand: text(), // Ex: "visa", "mastercard"
  card_last4: text(), // Últimos 4 dígitos do cartão
  card_exp_month: integer(), // Mês de expiração
  card_exp_year: integer(), // Ano de expiração
  metadata: jsonb().$type<Record<string, unknown>>(), // Metadados adicionais
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
})

// Tabela de histórico de uso (para limites de plano)
export const usageRecords = pgTable('usage_records', {
  id: uuid().primaryKey().defaultRandom(),
  subscription_id: uuid()
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
  period_start: timestamp().notNull(),
  period_end: timestamp().notNull(),
  members_count: integer().notNull().default(0),
  units_count: integer().notNull().default(0),
  demands_count: integer().notNull().default(0),
  storage_used_gb: decimal('storage_used_gb', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  created_at: timestamp().defaultNow().notNull(),
})

export const billings = pgTable('billings', {
  id: uuid().primaryKey().defaultRandom(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
})

// =============== RELAÇÕES ===============

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organization_id],
    references: [organizations.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.plan_id],
    references: [plans.id],
  }),
  payments: many(payments),
  usageRecords: many(usageRecords),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [payments.subscription_id],
    references: [subscriptions.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [payments.payment_method_id],
    references: [paymentMethods.id],
  }),
}))

export const paymentMethodsRelations = relations(paymentMethods, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [paymentMethods.organization_id],
    references: [organizations.id],
  }),
  payments: many(payments),
}))

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [usageRecords.subscription_id],
    references: [subscriptions.id],
  }),
}))
