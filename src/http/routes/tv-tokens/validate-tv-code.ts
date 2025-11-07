import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { tvAccessTokens, organizations, units } from '../../../db/schema/index.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { withPublicErrorResponses } from '../_errors/error-helpers.ts'
import { isTokenExpired } from '../../../utils/tv-token-generator.ts'
import { env } from '../../../config/env.ts'

const validateTVCodeBodySchema = z.object({
  code: z.string().length(6).describe('Código de 6 caracteres'),
})

const validateTVCodeResponseSchema = z.object({
  valid: z.boolean(),
  session: z
    .object({
      organizationSlug: z.string(),
      unitSlug: z.string(),
      sessionToken: z.string(),
      expiresIn: z.number(),
    })
    .optional(),
  message: z.string().optional(),
})

export const validateTVCodeRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/tv/validate',
    {
      schema: {
        tags: ['TV Tokens'],
        summary: 'Validar código de acesso (Pública)',
        description: 'Valida um código de 6 caracteres e retorna token de sessão para WebSocket. NÃO requer autenticação JWT.',
        body: validateTVCodeBodySchema,
        response: withPublicErrorResponses({
          200: validateTVCodeResponseSchema,
        }),
      },
    },
    async (request, reply) => {
      const { code } = request.body
      const ipAddress = request.ip

      // Normalizar código (uppercase)
      const normalizedCode = code.toUpperCase()

      // Buscar token com joins para obter slugs
      const [tokenData] = await db
        .select({
          token: tvAccessTokens,
          organizationSlug: organizations.slug,
          unitSlug: units.slug,
        })
        .from(tvAccessTokens)
        .innerJoin(organizations, eq(tvAccessTokens.organizationId, organizations.id))
        .innerJoin(units, eq(tvAccessTokens.unitId, units.id))
        .where(eq(tvAccessTokens.code, normalizedCode))
        .limit(1)

      if (!tokenData) {
        return reply.send({
          valid: false,
          message: 'Código inválido.',
        })
      }

      const { token, organizationSlug, unitSlug } = tokenData

      // Verificar se token está revogado
      if (token.status === 'REVOKED') {
        return reply.send({
          valid: false,
          message: 'Este código foi revogado.',
        })
      }

      // Verificar expiração
      if (isTokenExpired(token.expiresAt)) {
        // Atualizar status para EXPIRED
        await db
          .update(tvAccessTokens)
          .set({ status: 'EXPIRED', updatedAt: new Date() })
          .where(eq(tvAccessTokens.id, token.id))

        return reply.send({
          valid: false,
          message: 'Este código expirou.',
        })
      }

      // Atualizar último uso
      await db
        .update(tvAccessTokens)
        .set({
          lastUsedAt: new Date(),
          lastIpAddress: ipAddress,
          usageCount: token.usageCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(tvAccessTokens.id, token.id))

      // Gerar token JWT temporário para sessão
      const sessionToken = await reply.jwtSign(
        {
          tokenId: token.id,
          organizationSlug,
          unitSlug,
          type: 'tv-session',
        },
        {
          issuer: 'tv-session',
          expiresIn: '24h', // Sessão válida por 24 horas
        }
      )

      return reply.send({
        valid: true,
        session: {
          organizationSlug,
          unitSlug,
          sessionToken,
          expiresIn: 86400, // 24 horas em segundos
        },
      })
    }
  )
}
