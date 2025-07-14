import { z } from 'zod/v4'

export const userSubject = z.tuple([
  z.union([
    z.literal('create'), // Cria um novo usuário
    z.literal('delete'), // Deleta um usuário
    z.literal('update'), // Atualiza um usuário
    z.literal('get'), // Visualiza um usuário
    z.literal('invite'), // Convida um usuário
    z.literal('assign'), // Atribui um usuário
    z.literal('manage'), // Gerencia um usuário (geralmente é usado para permissões de administrador)
  ]),
  z.literal('User'),
])

export type UserSubject = z.infer<typeof userSubject>
