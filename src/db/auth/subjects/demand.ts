import { z } from 'zod/v4'
import { demandSchema } from '../models/demand.ts'

export const demandSubject = z.tuple([
  z.union([
    z.literal('create'),
    z.literal('get'),
    z.literal('update'),
    z.literal('delete'),
    z.literal('manage'),
  ]),
  z.union([z.literal('Demand'), demandSchema]),
])

export type DemandSubject = z.infer<typeof demandSubject>
