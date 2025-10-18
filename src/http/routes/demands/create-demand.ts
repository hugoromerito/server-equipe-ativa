import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import type {
  DemandCategoryType,
  DemandPriorityType,
} from '../../../db/schema/enums.ts'
import {
  applicants,
  demands,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { logger } from '../../../utils/logger.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { classifyDemandAi } from '../../utils/classify-demand-ai.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { InternalServerError } from '../_errors/internal-server-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// Schema para validação do corpo da requisição
const createDemandBodySchema = z.object({
  title: z
    .string()
    .min(3, 'Título deve ter pelo menos 3 caracteres.')
    .max(200, 'Título deve ter no máximo 200 caracteres.')
    .trim(),
  description: z
    .string()
    .min(10, 'Descrição deve ter pelo menos 10 caracteres.')
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres.')
    .trim(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .nullable()
    .optional(),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Hora deve estar no formato HH:MM')
    .nullable()
    .optional(),
  responsibleId: z
    .string()
    .uuid('ID do responsável deve ser um UUID válido')
    .nullable()
    .optional(),
})

// Schema para parâmetros da URL
const createDemandParamsSchema = z.object({
  organizationSlug: z.string().min(1, 'Slug da organização é obrigatório.'),
  unitSlug: z.string().min(1, 'Slug da unidade é obrigatório.'),
  applicantSlug: z.string().uuid('ID do solicitante deve ser um UUID válido.'),
})

// Schema para resposta de sucesso
const createDemandResponseSchema = z.object({
  demandId: z.string().uuid(),
  category: z.string(),
  priority: z.string(),
})

export const createDemandRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/units/:unitSlug/applicants/:applicantSlug/demands',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Demands'],
        summary: 'Criar nova demanda',
        description: 'Cria uma nova demanda para um solicitante em uma unidade específica',
        security: [{ bearerAuth: [] }],
        body: createDemandBodySchema,
        params: createDemandParamsSchema,
        response: {
          201: createDemandResponseSchema,
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
      const { organizationSlug, unitSlug, applicantSlug } = request.params
      const userId = await request.getCurrentUserId()

      try {
        logger.info(`Criando demanda para solicitante ${applicantSlug} na unidade ${unitSlug}`)

        // Buscar organização
        const [org] = await db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(eq(organizations.slug, organizationSlug))
          .limit(1)

        if (!org) {
          logger.warn(`Organização não encontrada: ${organizationSlug}`)
          throw new BadRequestError('Organização não encontrada.')
        }

        // Buscar unidade
        const [unit] = await db
          .select({
            id: units.id,
            name: units.name,
            organizationId: units.organization_id,
          })
          .from(units)
          .innerJoin(organizations, eq(units.organization_id, organizations.id))
          .where(
            and(
              eq(units.slug, unitSlug),
              eq(organizations.slug, organizationSlug)
            )
          )
          .limit(1)

        if (!unit) {
          logger.warn(`Unidade não encontrada: ${unitSlug} na organização ${organizationSlug}`)
          throw new BadRequestError('Unidade não encontrada.')
        }

        // Verificar permissões
        const { membership } = await request.getUserMembership(
          organizationSlug,
          unitSlug
        )

        const { cannot } = getUserPermissions(
          userId,
          membership.unit_role || membership.organization_role
        )

        if (cannot('create', 'Demand')) {
          logger.warn(`Usuário ${userId} sem permissão para criar demanda`)
          throw new UnauthorizedError(
            'Você não possui permissão para registrar demandas.'
          )
        }

        // Buscar solicitante
        const [applicant] = await db
          .select({
            id: applicants.id,
            name: applicants.name,
            organizationId: applicants.organization_id,
          })
          .from(applicants)
          .where(eq(applicants.id, applicantSlug))
          .limit(1)

        if (!applicant) {
          logger.warn(`Solicitante não encontrado: ${applicantSlug}`)
          throw new BadRequestError('Solicitante não encontrado.')
        }

        // Verificar se o solicitante pertence à organização
        if (applicant.organizationId !== org.id) {
          logger.warn(`Solicitante ${applicantSlug} não pertence à organização ${organizationSlug}`)
          throw new BadRequestError('Solicitante não pertence a esta organização.')
        }

        // Buscar usuário
        const [user] = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        if (!user?.name) {
          logger.warn(`Usuário não encontrado: ${userId}`)
          throw new BadRequestError('Usuário não encontrado.')
        }

        const {
          title,
          description,
          scheduledDate,
          scheduledTime,
          responsibleId,
        } = request.body

        // Validar que se scheduledDate for fornecido, scheduledTime também deve ser
        if (scheduledDate && !scheduledTime) {
          throw new BadRequestError('Hora de agendamento é obrigatória quando data é fornecida.')
        }
        if (scheduledTime && !scheduledDate) {
          throw new BadRequestError('Data de agendamento é obrigatória quando hora é fornecida.')
        }

        // Se responsibleId for fornecido, verificar se o membro existe na unidade
        if (responsibleId) {
          const [responsibleMember] = await db
            .select()
            .from(members)
            .where(
              and(
                eq(members.id, responsibleId),
                eq(members.unit_id, unit.id)
              )
            )
            .limit(1)

          if (!responsibleMember) {
            throw new BadRequestError('Profissional responsável não encontrado nesta unidade.')
          }
        }

        // Classificar demanda com IA
        logger.info(`Classificando demanda com IA: "${title}"`)
        const classificationResult = await classifyDemandAi({ description })
        const finalPriority = classificationResult.priority as DemandPriorityType
        const finalCategory = classificationResult.category as DemandCategoryType

        // Criar demanda
        const [demand] = await db
          .insert(demands)
          .values({
            title,
            description,
            priority: finalPriority,
            category: finalCategory,
            scheduled_date: scheduledDate || null,
            scheduled_time: scheduledTime || null,
            responsible_id: responsibleId || null,
            unit_id: unit.id,
            applicant_id: applicant.id,
            owner_id: userId,
            created_by_member_name: user.name,
          })
          .returning({ 
            id: demands.id,
            category: demands.category,
            priority: demands.priority,
          })

        const duration = Date.now() - startTime
        logger.info(`Demanda criada com sucesso: ${demand.id} em ${duration}ms`)

        return reply.status(201).send({
          demandId: demand.id,
          category: demand.category,
          priority: demand.priority,
        })
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (
          error instanceof BadRequestError || 
          error instanceof UnauthorizedError
        ) {
          logger.warn(`Erro ao criar demanda em ${duration}ms: ${error.message}`)
          throw error
        }
        
        logger.error(`Erro interno ao criar demanda em ${duration}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          organizationSlug,
          unitSlug,
          applicantSlug,
          userId,
        })
        throw new InternalServerError('Erro interno ao criar demanda.')
      }
    }
  )
}
