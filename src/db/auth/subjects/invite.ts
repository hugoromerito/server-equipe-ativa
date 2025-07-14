import { z } from 'zod/v4'

export const inviteSubject = z.tuple([
  z.union([
    z.literal('create'), // Cria um convite
    z.literal('get'), // Visualiza um convite
    z.literal('delete'), // Deleta um convite
    z.literal('manage'), // Gerencia um convite (geralmente é usado para permissões de administrador)
  ]),
  z.literal('Invite'),
])

export type InviteSubject = z.infer<typeof inviteSubject>
