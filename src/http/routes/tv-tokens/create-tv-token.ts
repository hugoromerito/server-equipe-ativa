import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { tvAccessTokens, organizations, units, users } from '../../../db/schema/index.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { createOperationResponses } from '../_errors/response-schemas.ts'
import { 
  generateTVAccessCode, 
  calculateExpirationDate 
} from '../../../utils/tv-token-generator.ts'

const createTVTokenBodySchema = z.object({
  name: z.string().min(3).max(100).describe('Nome descritivo do token (ex: "TV Recepção Centro")'),
  description: z.string().optional().describe('Descrição opcional'),
  expiresInDays: z.number().int().min(1).max(365).optional().default(90).describe('Dias até expiração (padrão: 90)'),
})

const tvTokenResponseSchema = z.object({
  token: z.object({
    id: z.uuid(),
    code: z.string().length(6),
    name: z.string(),
    description: z.string().nullable(),
    organizationSlug: z.string(),
    unitSlug: z.string(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED']),
    expiresAt: z.date().nullable(),
    createdAt: z.date(),
    createdBy: z.string(),
  }),
})

export const createTVTokenRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:slug/units/:unitSlug/tv-tokens',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['TV Tokens'],
        summary: 'Criar código de acesso para TV',
        description: 'Gera um código de 6 caracteres para acesso sem login à rota de TV (Admin/Manager apenas)',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          unitSlug: z.string(),
        }),
        body: createTVTokenBodySchema,
        response: createOperationResponses(tvTokenResponseSchema),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { slug, unitSlug } = request.params
      const { name, description, expiresInDays } = request.body

      // Verificar membership e permissões
      const { organization, membership } = await request.getUserMembership(slug, unitSlug)

      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      if (cannot('manage', 'Organization')) {
        throw new ForbiddenError(
          'Apenas administradores e gerentes podem criar códigos de acesso para TV.'
        )
      }

      // Buscar unidade
      const [unit] = await db
        .select({ id: units.id, slug: units.slug })
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

      // Verificar se já existe um token com o mesmo nome na unidade
      const [existingToken] = await db
        .select({ id: tvAccessTokens.id })
        .from(tvAccessTokens)
        .where(
          and(
            eq(tvAccessTokens.unitId, unit.id),
            eq(tvAccessTokens.name, name),
            eq(tvAccessTokens.status, 'ACTIVE')
          )
        )
        .limit(1)

      if (existingToken) {
        throw new BadRequestError(
          `Já existe um token ativo com o nome "${name}" nesta unidade.`
        )
      }

      // Gerar código único (tentar até 10 vezes)
      let code: string
      let attempts = 0
      const maxAttempts = 10

      while (attempts < maxAttempts) {
        code = generateTVAccessCode()

        // Verificar se código já existe
        const [existing] = await db
          .select({ id: tvAccessTokens.id })
          .from(tvAccessTokens)
          .where(eq(tvAccessTokens.code, code))
          .limit(1)

        if (!existing) break

        attempts++
      }

      if (attempts === maxAttempts) {
        throw new BadRequestError(
          'Não foi possível gerar um código único. Tente novamente.'
        )
      }

      // Calcular data de expiração
      const expiresAt = calculateExpirationDate(expiresInDays)

      // Criar token
      const [newToken] = await db
        .insert(tvAccessTokens)
        .values({
          code: code!,
          name,
          description: description || null,
          organizationId: organization.id,
          unitId: unit.id,
          createdByUserId: userId,
          status: 'ACTIVE',
          expiresAt,
        })
        .returning()

      // Buscar informações do criador
      const [creator] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      return reply.status(201).send({
        token: {
          id: newToken.id,
          code: newToken.code,
          name: newToken.name,
          description: newToken.description,
          organizationSlug: slug,
          unitSlug: unitSlug,
          status: newToken.status,
          expiresAt: newToken.expiresAt,
          createdAt: newToken.createdAt,
          createdBy: creator?.name || 'Usuário',
        },
      })
    }
  )
}
