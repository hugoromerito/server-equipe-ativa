import { hash } from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { members, organizations, users } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { ConflictError } from '../_errors/conflict-error.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'
import { createOperationResponses } from '../_errors/response-schemas.ts'

// Schema para validação do corpo da requisição
const createUserBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório.')
    .max(100, 'Nome deve ter no máximo 100 caracteres.')
    .trim(),
  email: z
    .string()
    .email('E-mail deve ter um formato válido.')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres.')
    .max(100, 'Senha deve ter no máximo 100 caracteres.'),
})

// Schema para resposta de sucesso
const createUserResponseSchema = z.object({
  message: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
})

export const createUserRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/users',
    {
      schema: {
        tags: ['Users'],
        summary: 'Criar novo usuário',
        description: 'Cria um novo usuário no sistema e o adiciona automaticamente a organizações configuradas por domínio',
        body: createUserBodySchema,
        response: createOperationResponses(createUserResponseSchema),
      },
    },
    async (request, reply) => {
      const startTime = Date.now()
      const { name, email, password } = request.body

      try {
        logger.info(`Criando usuário com e-mail: ${email}`)

        // Verificar se já existe usuário com o mesmo e-mail
        const userWithSameEmail = await db.query.users.findFirst({
          where: eq(users.email, email),
        })

        if (userWithSameEmail) {
          logger.warn(`Tentativa de criar usuário com e-mail já existente: ${email}`)
          throw new ConflictError('Já existe um usuário com o mesmo e-mail.')
        }

        // Verificar se há organização para auto-vinculação baseada no domínio
        const [, domain] = email.split('@')
        const autoJoinOrganization = await db.query.organizations.findFirst({
          where: and(
            eq(organizations.domain, domain),
            eq(organizations.should_attach_users_by_domain, true)
          ),
        })

        // Gerar hash da senha
        let password_hash: string
        try {
          password_hash = await hash(password, 12)
        } catch (error) {
          logger.error('Erro ao gerar hash da senha:', {
            error: error instanceof Error ? error.message : String(error),
          })
          throw new InternalServerError('Erro ao processar senha.')
        }

        // Criar usuário
        const [newUser] = await db
          .insert(users)
          .values({
            name,
            email,
            password_hash,
          })
          .returning()

        if (!newUser) {
          logger.error('Falha ao inserir usuário no banco de dados')
          throw new InternalServerError('Falha ao criar usuário.')
        }

        // Se há organização para auto-vinculação, adicionar o usuário
        if (autoJoinOrganization) {
          try {
            await db.insert(members).values({
              user_id: newUser.id,
              organization_id: autoJoinOrganization.id,
            })
            logger.info(`Usuário ${newUser.id} adicionado automaticamente à organização ${autoJoinOrganization.id}`)
          } catch (error) {
            // Log do erro mas não falha a criação do usuário
            logger.error(`Falha ao adicionar usuário ${newUser.id} à organização ${autoJoinOrganization.id}:`, {
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        const duration = Date.now() - startTime
        logger.info(`Usuário criado com sucesso: ${newUser.id} em ${duration}ms`)

        return reply.status(201).send({ 
          message: 'Usuário criado com sucesso.',
          user: {
            id: newUser.id,
            name: newUser.name || '',
            email: newUser.email,
          },
        })
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (error instanceof ConflictError || error instanceof InternalServerError) {
          logger.warn(`Erro ao criar usuário em ${duration}ms: ${error.message}`)
          throw error
        }

        // Erro não tratado
        logger.error(`Erro interno ao criar usuário em ${duration}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          email,
        })
        throw new InternalServerError('Erro interno do servidor.')
      }
    }
  )
}
