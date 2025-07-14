import { z } from 'zod/v4'

/*
  Unidades de Atendimento
  ownerId - Identificador único do dono da unidade
*/
export const organizationSchema = z.object({
  __typename: z.literal('Organization').default('Organization'),
  id: z.string(),
  owner_id: z.string(),
})

export type Organization = z.infer<typeof organizationSchema>
