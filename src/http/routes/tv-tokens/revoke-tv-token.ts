import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { tvAccessTokens, units } from '../../../db/schema/index.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { getOperationResponses } from '../_errors/response-schemas.ts'

export const revokeTVTokenRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).delete(
    '/organizations/:slug/units/:unitSlug/tv-tokens/:tokenId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['TV Tokens'],
        summary: 'Revogar código de acesso',
        description: 'Revoga (desativa) um código de acesso para TV',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          unitSlug: z.string(),
          tokenId: z.uuid(),
        }),
        response: getOperationResponses(z.object({ message: z.string() })),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { slug, unitSlug, tokenId } = request.params

      // Verificar membership e permissões
      const { organization, membership } = await request.getUserMembership(slug, unitSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('manage', 'Organization')) {
        throw new ForbiddenError(
          'Apenas administradores e gerentes podem revogar códigos de acesso.'
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

      // Buscar token
      const [token] = await db
        .select()
        .from(tvAccessTokens)
        .where(
          and(
            eq(tvAccessTokens.id, tokenId),
            eq(tvAccessTokens.unitId, unit.id)
          )
        )
        .limit(1)

      if (!token) {
        throw new NotFoundError('Código de acesso não encontrado.')
      }

      // Revogar token
      await db
        .update(tvAccessTokens)
        .set({
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(tvAccessTokens.id, tokenId))

      return reply.send({
        message: 'Código de acesso revogado com sucesso.',
      })
    }
  )
}
