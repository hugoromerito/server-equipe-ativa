import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { tvAccessTokens, units, users } from '../../../db/schema/index.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { getOperationResponses } from '../_errors/response-schemas.ts'

const tvTokensListResponseSchema = z.object({
  tokens: z.array(
    z.object({
      id: z.uuid(),
      code: z.string().length(6),
      name: z.string(),
      description: z.string().nullable(),
      status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED']),
      expiresAt: z.date().nullable(),
      lastUsedAt: z.date().nullable(),
      lastIpAddress: z.string().nullable(),
      usageCount: z.number(),
      createdAt: z.date(),
      createdBy: z.string(),
    })
  ),
})

export const getTVTokensRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:slug/units/:unitSlug/tv-tokens',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['TV Tokens'],
        summary: 'Listar códigos de acesso da unidade',
        description: 'Retorna todos os códigos de acesso TV criados para a unidade',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          unitSlug: z.string(),
        }),
        response: getOperationResponses(tvTokensListResponseSchema),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { slug, unitSlug } = request.params

      // Verificar membership e permissões
      const { organization, membership } = await request.getUserMembership(slug, unitSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('get', 'Organization')) {
        throw new ForbiddenError(
          'Você não tem permissão para visualizar códigos de acesso.'
        )
      }

      // Buscar unidade
      const [unit] = await db
        .select({ id: units.id })
        .from(units)
        .where(
          and(
            eq(units.slug, unitSlug),
            eq(units.organization_id, organization.id)
          )
        )
        .limit(1)

      if (!unit) {
        throw new NotFoundError('Unidade não encontrada.')
      }

      // Buscar todos os tokens da unidade
      const tokens = await db
        .select({
          token: tvAccessTokens,
          creatorName: users.name,
        })
        .from(tvAccessTokens)
        .leftJoin(users, eq(tvAccessTokens.createdByUserId, users.id))
        .where(eq(tvAccessTokens.unitId, unit.id))
        .orderBy(tvAccessTokens.createdAt)

      return reply.send({
        tokens: tokens.map(({ token, creatorName }) => ({
          id: token.id,
          code: token.code,
          name: token.name,
          description: token.description,
          status: token.status,
          expiresAt: token.expiresAt,
          lastUsedAt: token.lastUsedAt,
          lastIpAddress: token.lastIpAddress,
          usageCount: token.usageCount,
          createdAt: token.createdAt,
          createdBy: creatorName || 'Usuário',
        })),
      })
    }
  )
}
