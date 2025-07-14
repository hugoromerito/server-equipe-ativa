import { z } from 'zod/v4'

/*
  Demandas registradas pela população
  id - Identificador único da demanda
  ownerId - Identificador único do solicitante da demanda
*/
export const demandSchema = z.object({
  __typename: z.literal('Demand').default('Demand'),
  id: z.string(),
  ownerId: z.string(),
})

export type Demand = z.infer<typeof demandSchema>
