/**
 * Exemplo de uso da nova estrutura de código
 * 
 * Este arquivo demonstra as melhores práticas e padrões
 * a serem seguidos no projeto.
 */

// =============================================================================
// 1. IMPORTS ORGANIZADOS
// =============================================================================

// Bibliotecas externas primeiro
import { fastify } from 'fastify'
import { z } from 'zod'

// Imports da aplicação usando barrel exports
import { env, HTTP_STATUS, VALIDATION_RULES } from '@/config'
import { db } from '@/db/connection'
import { users } from '@/db/schema'
import { logger } from '@/utils'

// Types de domínio
import type { User, AuthPayload } from '@/types/domain'

// Imports relativos por último
import { validateEmail } from './validation'

// =============================================================================
// 2. TYPES E INTERFACES
// =============================================================================

// Use types de domínio sempre que possível
type CreateUserInput = Pick<User, 'name' | 'email'>

// Schemas de validação com Zod
const createUserSchema = z.object({
  name: z.string()
    .min(VALIDATION_RULES.NAME.MIN_LENGTH)
    .max(VALIDATION_RULES.NAME.MAX_LENGTH),
  email: z.string()
    .email()
    .max(VALIDATION_RULES.EMAIL.MAX_LENGTH),
  password: z.string()
    .min(VALIDATION_RULES.PASSWORD.MIN_LENGTH)
    .max(VALIDATION_RULES.PASSWORD.MAX_LENGTH),
})

// =============================================================================
// 3. SERVICES / BUSINESS LOGIC
// =============================================================================

/**
 * Cria um novo usuário no sistema
 * 
 * @param userData - Dados do usuário a ser criado
 * @returns O usuário criado
 * @throws {ValidationError} Se os dados forem inválidos
 * @throws {ConflictError} Se o email já existir
 */
async function createUser(userData: CreateUserInput): Promise<User> {
  // Validar dados de entrada
  const validatedData = createUserSchema.parse(userData)
  
  // Log estruturado
  logger.info('Creating new user', {
    email: validatedData.email,
    name: validatedData.name,
  })
  
  try {
    // Lógica de negócio
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, validatedData.email),
    })
    
    if (existingUser) {
      throw new ConflictError('Email already exists')
    }
    
    // Criar usuário
    const [newUser] = await db
      .insert(users)
      .values({
        name: validatedData.name,
        email: validatedData.email,
        passwordHash: await hashPassword(validatedData.password),
      })
      .returning()
    
    logger.info('User created successfully', {
      userId: newUser.id,
      email: newUser.email,
    })
    
    return newUser
  } catch (error) {
    logger.error('Failed to create user', {
      error: error instanceof Error ? error.message : String(error),
      email: validatedData.email,
    })
    throw error
  }
}

// =============================================================================
// 4. ROUTES / HTTP LAYER
// =============================================================================

import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'

export const createUserRoute: FastifyPluginCallbackZod = (app) => {
  app.post('/users', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user',
      description: 'Creates a new user in the system',
      body: createUserSchema,
      response: {
        [HTTP_STATUS.CREATED]: z.object({
          id: z.string().uuid(),
          name: z.string(),
          email: z.string().email(),
          createdAt: z.date(),
        }),
        [HTTP_STATUS.CONFLICT]: z.object({
          message: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const user = await createUser(request.body)
      
      return reply.status(HTTP_STATUS.CREATED).send({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      })
    } catch (error) {
      if (error instanceof ConflictError) {
        return reply.status(HTTP_STATUS.CONFLICT).send({
          message: error.message,
        })
      }
      throw error
    }
  })
}

// =============================================================================
// 5. ERROR HANDLING
// =============================================================================

class ConflictError extends Error {
  statusCode = HTTP_STATUS.CONFLICT
  
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

class ValidationError extends Error {
  statusCode = HTTP_STATUS.BAD_REQUEST
  
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// =============================================================================
// 6. UTILITIES
// =============================================================================

async function hashPassword(password: string): Promise<string> {
  // Implementação
  return password // placeholder
}

// =============================================================================
// 7. EXPORTS
// =============================================================================

// Export principal
export { createUser }

// Exports auxiliares
export { createUserSchema, type CreateUserInput }

// =============================================================================
// RESUMO DAS MELHORES PRÁTICAS APLICADAS:
// =============================================================================
// ✅ Imports organizados (externos → internos → relativos)
// ✅ Uso de barrel exports (@/config, @/utils, etc)
// ✅ Types de domínio reutilizáveis
// ✅ Validação com Zod e constantes
// ✅ Logging estruturado
// ✅ Error handling com custom errors
// ✅ JSDoc em funções públicas
// ✅ Separação clara de concerns (service, route, utils)
// ✅ Type safety em toda a aplicação
// ✅ Código limpo e bem documentado
