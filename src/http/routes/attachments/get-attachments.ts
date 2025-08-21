import { and, count, desc, eq, ne } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { attachments, users } from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'

export const getAttachmentsRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/attachments',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Listar anexos da organização',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
        }),
        querystring: z.object({
          demandId: z.uuid().optional(),
          applicantId: z.uuid().optional(),
          userId: z.uuid().optional(),
          type: z
            .enum([
              'AVATAR',
              'DOCUMENT',
              'IDENTITY',
              'ADDRESS',
              'INCOME',
              'MEDICAL',
              'LEGAL',
              'OTHER',
            ])
            .optional(),
          page: z.coerce.number().min(1).default(1),
          limit: z.coerce.number().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({
            attachments: z.array(
              z.object({
                id: z.uuid(),
                key: z.string(),
                url: z.string(),
                originalName: z.string(),
                size: z.number(),
                mimeType: z.string(),
                type: z.string(),
                encrypted: z.boolean(),
                createdAt: z.date(),
                demandId: z.uuid().nullable(),
                applicantId: z.uuid().nullable(),
                userId: z.uuid().nullable(),
                uploadedBy: z.object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                  email: z.string(),
                }),
              })
            ),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug } = request.params as {
        organizationSlug: string
      }
      const { demandId, applicantId, userId, type, page, limit } =
        request.query as {
          demandId?: string
          applicantId?: string
          userId?: string
          type?: string
          page: number
          limit: number
        }

      const { organization } = await request.getUserMembership(organizationSlug)

      // Construir condições de filtro
      const whereConditions = [eq(attachments.organization_id, organization.id)]

      if (demandId) {
        whereConditions.push(eq(attachments.demand_id, demandId))
      }

      if (applicantId) {
        whereConditions.push(eq(attachments.applicant_id, applicantId))
      }

      if (userId) {
        whereConditions.push(eq(attachments.user_id, userId))
      }

      if (type) {
        whereConditions.push(
          eq(
            attachments.type,
            type as
              | 'AVATAR'
              | 'DOCUMENT'
              | 'IDENTITY'
              | 'ADDRESS'
              | 'INCOME'
              | 'MEDICAL'
              | 'LEGAL'
              | 'OTHER'
          )
        )
      }

      // Se nenhum filtro específico foi aplicado, não mostrar avatares por padrão
      const hasSpecificFilter = demandId || applicantId || userId || type
      if (!hasSpecificFilter) {
        whereConditions.push(ne(attachments.type, 'AVATAR'))
      }

      const offset = (page - 1) * limit

      // Buscar anexos
      const attachmentsList = await db
        .select({
          id: attachments.id,
          key: attachments.key,
          url: attachments.url,
          original_name: attachments.original_name,
          size: attachments.size,
          mime_type: attachments.mime_type,
          type: attachments.type,
          encrypted: attachments.encrypted,
          created_at: attachments.created_at,
          demand_id: attachments.demand_id,
          applicant_id: attachments.applicant_id,
          user_id: attachments.user_id,
          uploaded_by: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(attachments)
        .innerJoin(users, eq(attachments.uploaded_by, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(attachments.created_at))
        .limit(limit)
        .offset(offset)

      // Contar total de anexos
      const [{ total }] = await db
        .select({ total: count() })
        .from(attachments)
        .where(and(...whereConditions))

      const totalPages = Math.ceil(total / limit)

      return reply.send({
        attachments: attachmentsList.map((attachment) => ({
          id: attachment.id,
          key: attachment.key,
          url: attachment.url,
          originalName: attachment.original_name,
          size: attachment.size,
          mimeType: attachment.mime_type,
          type: attachment.type,
          encrypted: attachment.encrypted,
          createdAt: attachment.created_at,
          demandId: attachment.demand_id,
          applicantId: attachment.applicant_id,
          userId: attachment.user_id,
          uploadedBy: attachment.uploaded_by,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      })
    }
  )
}
