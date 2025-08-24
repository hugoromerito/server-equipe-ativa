import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { AUTH_TOKEN_EXPIRES_IN } from '../../../config/constants.ts'
import { db } from '../../../db/connection.ts'
import { users } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// Schema para validação de entrada
const authenticateBodySchema = z.object({
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
const authenticateResponseSchema = z.object({
  token: z.string().describe('Token JWT para autenticação.'),
  user: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string().email(),
    avatarUrl: z.string().url().nullable(),
  }),
})

export const authenticateWithPasswordRoute: FastifyPluginCallbackZod = (
  app
) => {
  app.post(
    '/sessions/password',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Autenticar com e-mail e senha',
        description:
          'Realiza autenticação do usuário com e-mail e senha, retornando um token JWT e informações do usuário',
        body: authenticateBodySchema,
        response: {
          201: authenticateResponseSchema,
          400: z.object({
            error: z.string(),
            code: z.string(),
            message: z.string(),
          }),
          401: z.object({
            error: z.string(),
            code: z.string(),
            message: z.string(),
          }),
          500: z.object({
            error: z.string(),
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const startTime = Date.now()
      const { email, password } = request.body

      try {
        logger.info(`Tentativa de autenticação para e-mail: ${email}`)

        // Buscar usuário por e-mail
        const userFromEmail = await db.query.users.findFirst({
          where: eq(users.email, email),
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            password_hash: true,
          },
        })

        if (!userFromEmail) {
          logger.warn(`Tentativa de login com e-mail inexistente: ${email}`)
          throw new UnauthorizedError('E-mail ou senha inválidos.')
        }

        if (userFromEmail.password_hash === null) {
          logger.warn(`Tentativa de login com senha para usuário sem senha: ${email}`)
          throw new BadRequestError('O usuário não possui uma senha, use o login social.')
        }

        // Verificar senha
        const isPasswordValid = await compare(
          password,
          userFromEmail.password_hash
        )

        if (!isPasswordValid) {
          logger.warn(`Tentativa de login com senha incorreta: ${email}`)
          throw new UnauthorizedError('E-mail ou senha inválidos.')
        }

        // Gerar token JWT
        const token = await reply.jwtSign(
          {
            sub: userFromEmail.id,
          },
          {
            sign: {
              expiresIn: AUTH_TOKEN_EXPIRES_IN,
            },
          }
        )

        const responseData = {
          token,
          user: {
            id: userFromEmail.id,
            name: userFromEmail.name,
            email: userFromEmail.email,
            avatarUrl: userFromEmail.avatar_url,
          },
        }

        const duration = Date.now() - startTime
        logger.info(`Autenticação bem-sucedida para ${email} em ${duration}ms`)

        return reply.status(201).send(responseData)
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
          logger.warn(`Erro de autenticação em ${duration}ms: ${error.message}`)
          throw error
        }
        
        logger.error(`Erro interno de autenticação em ${duration}ms:`, { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw new InternalServerError('Erro interno durante a autenticação.')
      }
    }
  )
}
