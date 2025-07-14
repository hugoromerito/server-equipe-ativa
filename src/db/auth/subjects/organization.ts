import { z } from 'zod/v4'
import { organizationSchema } from '../models/organization.ts'

export const organizationSubject = z.tuple([
  z.union([
    z.literal('create'), // Cria uma nova unidade
    z.literal('get'), // Visualiza uma unidade
    z.literal('update'), // Atualiza uma unidade
    z.literal('delete'), // Deleta uma unidade
    z.literal('transfer_ownership'), // Transfere a propriedade de uma unidade
    z.literal('manage'), // Gerencia uma unidade (geralmente é usado para permissões de administrador)
  ]),
  z.union([z.literal('Organization'), organizationSchema]),
])

export type OrganizationSubject = z.infer<typeof organizationSubject>
