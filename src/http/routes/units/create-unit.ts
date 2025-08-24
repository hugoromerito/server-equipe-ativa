import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { members, units } from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { createSlug } from '../../utils/create-slug.ts'
import { ConflictError } from '../_errors/conflict-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { createOperationResponses } from '../_errors/response-schemas.ts'

// Schema para validação do corpo da requisição
const createUnitBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório.')
    .max(100, 'Nome deve ter no máximo 100 caracteres.')
    .trim(),
  description: z
    .string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres.')
    .nullable()
    .optional(),
  location: z
    .string()
    .min(1, 'Localização é obrigatória.')
    .max(200, 'Localização deve ter no máximo 200 caracteres.')
    .trim(),
})

// Schema para parâmetros da URL
const createUnitParamsSchema = z.object({
  organizationSlug: z.string().min(1, 'Slug da organização é obrigatório.'),
})

// Schema para resposta de sucesso
const createUnitResponseSchema = z.object({
  unit: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    location: z.string(),
    description: z.string().nullable(),
  }),
})

export const createUnitRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/units',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Units'],
        summary: 'Criar nova unidade',
        description: 'Cria uma nova unidade dentro de uma organização. Apenas administradores podem criar unidades.',
        security: [{ bearerAuth: [] }],
        body: createUnitBodySchema,
        params: createUnitParamsSchema,
        response: createOperationResponses(createUnitResponseSchema),
      },
    },
    async (request, reply) => {
      const startTime = Date.now()
      const userId = await request.getCurrentUserId()
      const { organizationSlug } = request.params
      const { name, description, location } = request.body

      try {
        logger.info(`Criando unidade "${name}" na organização ${organizationSlug}`)

        // Verificar membership do usuário na organização
        const { organization, membership } = await request.getUserMembership(organizationSlug)

        if (!organization) {
          logger.warn(`Organização não encontrada: ${organizationSlug}`)
          throw new NotFoundError('Organização não encontrada.')
        }

        // Verificar se o usuário tem permissão de administrador
        if (membership.organization_role !== 'ADMIN') {
          logger.warn(`Usuário ${userId} sem permissão de admin para criar unidade na organização ${organizationSlug}`)
          throw new ForbiddenError('Apenas administradores podem criar unidades.')
        }

        // Gerar slug da unidade
        const unitSlug = createSlug(name)

        // Verificar se já existe unidade com o mesmo nome na organização
        const existing = await db.query.units.findFirst({
          where: and(
            eq(units.slug, unitSlug),
            eq(units.organization_id, organization.id)
          ),
        })

        if (existing) {
          logger.warn(`Tentativa de criar unidade com nome duplicado: ${name} na organização ${organizationSlug}`)
          throw new ConflictError('Já existe uma unidade com o mesmo nome na organização.')
        }

        // Criar nova unidade
        const [newUnit] = await db
          .insert(units)
          .values({
            name,
            slug: unitSlug,
            description,
            location,
            organization_id: organization.id,
            owner_id: userId,
          })
          .returning()

        if (!newUnit) {
          logger.error('Falha ao inserir unidade no banco de dados')
          throw new InternalServerError('Erro interno ao criar unidade.')
        }

        // Adicionar usuário como administrador da unidade
        await db.insert(members).values({
          unit_id: newUnit.id,
          organization_id: organization.id,
          user_id: userId,
          organization_role: membership.organization_role,
          unit_role: 'ADMIN',
        })

        const duration = Date.now() - startTime
        logger.info(`Unidade criada com sucesso: ${newUnit.id} em ${duration}ms`)

        return reply.status(201).send({
          unit: {
            id: newUnit.id,
            name: newUnit.name,
            slug: newUnit.slug,
            location: newUnit.location,
            description: newUnit.description,
          },
        })
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (
          error instanceof NotFoundError ||
          error instanceof ForbiddenError ||
          error instanceof ConflictError ||
          error instanceof InternalServerError
        ) {
          logger.warn(`Erro ao criar unidade em ${duration}ms: ${error.message}`)
          throw error
        }
        
        logger.error(`Erro interno ao criar unidade em ${duration}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          organizationSlug,
          unitName: name,
          userId,
        })
        throw new InternalServerError('Erro interno ao criar unidade.')
      }
    }
  )
}
