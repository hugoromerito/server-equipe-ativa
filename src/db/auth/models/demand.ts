import { z } from 'zod/v4'

/*
  Demandas registradas pela população
  id - Identificador único da demanda
  ownerId - Identificador único do solicitante da demanda (criador)
  memberId - Identificador do membro (médico/profissional) atribuído à demanda
  responsibleId - Identificador do profissional responsável pelo atendimento
*/
export const demandSchema = z.object({
  __typename: z.literal('Demand').default('Demand'),
  id: z.string(),
  ownerId: z.string(),
  memberId: z.string().optional(),
  responsibleId: z.string().optional(),
})

export type Demand = z.infer<typeof demandSchema>
