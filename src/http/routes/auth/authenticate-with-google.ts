import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { google } from 'googleapis'
import { z } from 'zod/v4'

import { AUTH_TOKEN_EXPIRES_IN } from '../../../config/constants.ts'
import { env } from '../../../config/env.ts'
import { db } from '../../../db/connection.ts'
import { accounts, users } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'

// Schema para validação de entrada
const authenticateWithGoogleBodySchema = z.object({
  code: z.string().min(1, 'Código de autorização é obrigatório.'),
})

// Schema para resposta de sucesso
const authenticateWithGoogleResponseSchema = z.object({
  token: z.string().describe('Token JWT para autenticação.'),
  user: z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    email: z.email(),
    avatarUrl: z.url().nullable(),
  }),
})

// Schema para validação do payload do Google
const googlePayloadSchema = z.object({
  sub: z.string().describe('ID único do usuário no Google'),
  email: z.email().describe('E-mail do usuário'),
  name: z.string().nullable().optional().describe('Nome do usuário'),
  picture: z.url().nullable().optional().describe('URL da foto do usuário'),
})

export const authenticateWithGoogleRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/sessions/google',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Autenticar com Google OAuth',
        description:
          'Realiza autenticação do usuário com Google OAuth usando o código de autorização, retornando um token JWT e informações do usuário',
        body: authenticateWithGoogleBodySchema,
        response: {
          201: authenticateWithGoogleResponseSchema,
          400: z.object({
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
      const { code } = request.body

      try {
        logger.info('Iniciando autenticação com Google OAuth')

        // Configura o cliente OAuth2 com as credenciais do Google
        const oauth2Client = new google.auth.OAuth2(
          env.GOOGLE_OAUTH_CLIENT_ID,
          env.GOOGLE_OAUTH_CLIENT_SECRET,
          env.GOOGLE_OAUTH_CLIENT_REDIRECT_URI
        )

        // Troca o código pelo token de acesso e o id_token
        let tokens
        try {
          const response = await oauth2Client.getToken(code)
          tokens = response.tokens
        } catch (error) {
          logger.warn('Falha ao trocar código por tokens do Google:', {
            error: error instanceof Error ? error.message : String(error),
          })
          throw new BadRequestError(
            'Falha na autenticação com o Google. Código inválido.'
          )
        }

        if (!tokens.id_token) {
          logger.warn('Token de ID ausente na resposta do Google')
          throw new BadRequestError(
            'Falha na autenticação com o Google. Token de ID ausente.'
          )
        }

        // Verifica o id_token e extrai as informações do usuário
        let ticket
        try {
          ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: env.GOOGLE_OAUTH_CLIENT_ID,
          })
        } catch (error) {
          logger.warn('Falha ao verificar token do Google:', {
            error: error instanceof Error ? error.message : String(error),
          })
          throw new BadRequestError(
            'Falha na autenticação com o Google. Não foi possível verificar o token.'
          )
        }

        const payload = ticket.getPayload()
        const googlePayload = googlePayloadSchema.parse(payload)

        logger.info(`Autenticação Google para e-mail: ${googlePayload.email}`)

        // Procura o usuário no banco de dados pelo email fornecido pelo Google
        let user = await db.query.users.findFirst({
          where: eq(users.email, googlePayload.email),
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
          },
        })

        // Caso o usuário não exista, cria um novo registro
        if (!user) {
          logger.info(`Criando novo usuário para e-mail: ${googlePayload.email}`)
          
          const [newUser] = await db
            .insert(users)
            .values({
              email: googlePayload.email,
              name: googlePayload.name || googlePayload.email,
              avatar_url: googlePayload.picture,
              password_hash: null, // Usuário sem senha, pois utiliza autenticação social
            })
            .returning({
              id: users.id,
              name: users.name,
              email: users.email,
              avatar_url: users.avatar_url,
            })

          user = newUser
        }

        // Verifica se já existe um registro de conta para o Google
        let account = await db.query.accounts.findFirst({
          where: eq(accounts.user_id, user.id),
        })

        // Caso não exista, cria o registro da conta
        if (!account) {
          logger.info(`Criando conta Google para usuário: ${user.id}`)
          
          await db.insert(accounts).values({
            provider: 'GOOGLE',
            provider_account_id: googlePayload.sub,
            user_id: user.id,
          })
        }

        // Gera o token JWT para o usuário autenticado
        const token = await reply.jwtSign(
          {
            sub: user.id,
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
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatar_url,
          },
        }

        const duration = Date.now() - startTime
        logger.info(`Autenticação Google bem-sucedida para ${googlePayload.email} em ${duration}ms`)

        return reply.status(201).send(responseData)
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (error instanceof BadRequestError) {
          logger.warn(`Erro de autenticação Google em ${duration}ms: ${error.message}`)
          throw error
        }
        
        logger.error(`Erro interno de autenticação Google em ${duration}ms:`, { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw new InternalServerError('Erro interno durante a autenticação com Google.')
      }
    }
  )
}
