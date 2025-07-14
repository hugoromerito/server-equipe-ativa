import { z } from 'zod/v4'

export const billingSubject = z.tuple([
  z.union([z.literal('manage'), z.literal('get'), z.literal('export')]),
  z.literal('Billing'),
])

export type BillingSubject = z.infer<typeof billingSubject>
