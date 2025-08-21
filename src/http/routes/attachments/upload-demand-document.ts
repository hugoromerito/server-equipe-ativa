import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { attachments, demands } from '../../../db/schema/index.ts'
import { units } from '../../../db/schema/organization.ts'
import {
  type AttachmentType,
  storageService,
} from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { processFileUpload } from '../../middlewares/upload.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const uploadDemandDocumentRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/demands/:demandId/documents',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload de documento para demanda',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: z.object({
          organizationSlug: z.string(),
          demandId: z.uuid(),
        }),
        body: z.object({
          type: z
            .enum([
              'DOCUMENT',
              'IDENTITY',
              'ADDRESS',
              'INCOME',
              'MEDICAL',
              'LEGAL',
              'OTHER',
            ])
            .optional()
            .default('DOCUMENT'),
        }),
        response: {
          201: z.object({
            attachmentId: z.uuid(),
            url: z.string(),
            originalName: z.string(),
            type: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, demandId } = request.params as {
        organizationSlug: string
        demandId: string
      }
      const { type } = request.body as { type?: string }
      const currentUserId = await request.getCurrentUserId()

      const { organization } = await request.getUserMembership(organizationSlug)

      // Verificar se a demanda existe e pertence à organização
      const [demand] = await db
        .select()
        .from(demands)
        .innerJoin(units, eq(demands.unit_id, units.id))
        .where(
          and(
            eq(demands.id, demandId),
            eq(units.organization_id, organization.id)
          )
        )

      if (!demand) {
        throw new BadRequestError('Demanda não encontrada.')
      }

      // Processar upload do arquivo
      const attachmentType = type?.toLowerCase() as AttachmentType
      const fileData = await processFileUpload(
        request,
        attachmentType || 'document'
      )

      // Upload para S3
      const uploadResult = await storageService.uploadFile(
        fileData.buffer,
        fileData.filename,
        fileData.mimetype,
        organization.id,
        attachmentType || 'document',
        demandId
      )

      // Salvar no banco de dados
      const [attachment] = await db
        .insert(attachments)
        .values({
          key: uploadResult.key,
          url: uploadResult.url,
          original_name: uploadResult.originalName,
          size: uploadResult.size,
          mime_type: uploadResult.mimeType,
          type: (type?.toUpperCase() || 'DOCUMENT') as
            | 'DOCUMENT'
            | 'IDENTITY'
            | 'ADDRESS'
            | 'INCOME'
            | 'MEDICAL'
            | 'LEGAL'
            | 'OTHER',
          encrypted: uploadResult.encrypted,
          organization_id: organization.id,
          demand_id: demandId,
          uploaded_by: currentUserId,
        })
        .returning()

      // Atualizar o campo attachment na tabela demands se for o primeiro documento
      const existingAttachments = await db
        .select()
        .from(attachments)
        .where(eq(attachments.demand_id, demandId))

      if (existingAttachments.length === 1) {
        await db
          .update(demands)
          .set({
            attachment: attachment.url,
            updated_at: new Date(),
          })
          .where(eq(demands.id, demandId))
      }

      return reply.status(201).send({
        attachmentId: attachment.id,
        url: attachment.url,
        originalName: attachment.original_name,
        type: attachment.type,
      })
    }
  )
}
