import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { users } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { ConflictError } from '../_errors/conflict-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { createOperationResponses } from '../_errors/response-schemas.ts'

// Schema para validação do corpo da requisição
const updateProfileBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório.')
    .max(100, 'Nome deve ter no máximo 100 caracteres.')
    .trim()
    .optional(),
  email: z
    .string()
    .email('E-mail deve ter um formato válido.')
    .toLowerCase()
    .trim()
    .optional(),
  // cpf: z
  //   .string()
  //   .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos')
  //   .optional()
  //   .nullable(),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres.')
    .max(100, 'Senha deve ter no máximo 100 caracteres.')
    .optional(),
  currentPassword: z
    .string()
    .optional(),
})

// Schema para resposta de sucesso
const updateProfileResponseSchema = z.object({
  message: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string().email(),
    // cpf: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
    updatedAt: z.date(),
  }),
})

export const updateProfileRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).patch(
    '/profile',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Auth'],
        summary: 'Atualizar perfil do usuário',
        description: 'Permite ao usuário atualizar suas informações pessoais (nome, email, CPF, senha)',
        security: [{ bearerAuth: [] }],
        body: updateProfileBodySchema,
        response: createOperationResponses(updateProfileResponseSchema),
      },
    },
    async (request, reply) => {
      const startTime = Date.now()
      const userId = await request.getCurrentUserId()
      const { name, email, password, currentPassword } = request.body

      try {
        logger.info(`Atualizando perfil do usuário: ${userId}`)

        // Buscar usuário atual
        const currentUser = await db.query.users.findFirst({
          where: eq(users.id, userId),
        })

        if (!currentUser) {
          throw new NotFoundError('Usuário não encontrado.')
        }

        // Se está alterando email, verificar se já existe outro usuário com o mesmo email
        if (email && email !== currentUser.email) {
          const userWithSameEmail = await db.query.users.findFirst({
            where: eq(users.email, email),
          })

          if (userWithSameEmail) {
            logger.warn(`Tentativa de alterar email para um já existente: ${email}`)
            throw new ConflictError('Já existe outro usuário com este e-mail.')
          }
        }

        // // Se está alterando CPF, verificar se já existe outro usuário com o mesmo CPF
        // if (cpf && cpf !== currentUser.cpf) {
        //   const userWithSameCpf = await db.query.users.findFirst({
        //     where: eq(users.cpf, cpf),
        //   })

        //   if (userWithSameCpf) {
        //     logger.warn(`Tentativa de alterar CPF para um já existente: ${cpf}`)
        //     throw new ConflictError('Já existe outro usuário com este CPF.')
        //   }
        // }

        // Preparar dados para atualização
        const updateData: {
          name?: string
          email?: string
          // cpf?: string | null
          password_hash?: string
          updated_at: Date
        } = {
          updated_at: new Date(),
        }

        if (name !== undefined) {
          updateData.name = name
        }

        if (email !== undefined) {
          updateData.email = email
        }

        // if (cpf !== undefined) {
        //   updateData.cpf = cpf
        // }

        // Se está alterando senha, validar senha atual e gerar novo hash
        if (password) {
          if (!currentUser.password_hash) {
            throw new ConflictError(
              'Usuário não possui senha definida. Use autenticação social ou defina uma senha primeiro.'
            )
          }

          if (!currentPassword) {
            throw new ConflictError(
              'Para alterar a senha, você deve fornecer a senha atual.'
            )
          }

          // Verificar senha atual (implementar verificação aqui se necessário)
          const bcrypt = await import('bcryptjs')
          const isPasswordValid = await bcrypt.compare(
            currentPassword,
            currentUser.password_hash
          )

          if (!isPasswordValid) {
            throw new ConflictError('Senha atual incorreta.')
          }

          // Gerar hash da nova senha
          updateData.password_hash = await hash(password, 12)
        }

        // Atualizar usuário
        const [updatedUser] = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userId))
          .returning({
            id: users.id,
            name: users.name,
            email: users.email,
            // cpf: users.cpf,
            avatar_url: users.avatar_url,
            updated_at: users.updated_at,
          })

        if (!updatedUser) {
          throw new NotFoundError('Erro ao atualizar usuário.')
        }

        const duration = Date.now() - startTime
        logger.info(`Perfil atualizado com sucesso para ${userId} em ${duration}ms`)

        return reply.status(201).send({
          message: 'Perfil atualizado com sucesso.',
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            // cpf: updatedUser.cpf,
            avatarUrl: updatedUser.avatar_url,
            updatedAt: updatedUser.updated_at!,
          },
        })
      } catch (error) {
        const duration = Date.now() - startTime

        if (error instanceof ConflictError || error instanceof NotFoundError) {
          logger.warn(`Erro ao atualizar perfil em ${duration}ms: ${error.message}`)
          throw error
        }

        logger.error(`Erro interno ao atualizar perfil em ${duration}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }
  )
}
