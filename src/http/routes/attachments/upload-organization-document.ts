import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { attachments, organizations } from '../../../db/schema/index.ts'
import {
  type AttachmentType,
  storageService,
} from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { processFileUpload } from '../../middlewares/upload.ts'

export const uploadOrganizationDocumentRoute: FastifyPluginCallbackZod = (
  app
) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/documents',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload de documento para organização',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: z.object({
          organizationSlug: z.string(),
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
      const { organizationSlug } = request.params as {
        organizationSlug: string
      }
      const { type } = request.body as { type?: string }
      const currentUserId = await request.getCurrentUserId()

      const { organization } = await request.getUserMembership(organizationSlug)

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
        attachmentType || 'document'
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
          uploaded_by: currentUserId,
        })
        .returning()

      // Se for um avatar da organização, atualizar o campo avatar_url
      if (type?.toUpperCase() === 'AVATAR') {
        await db
          .update(organizations)
          .set({
            avatar_url: attachment.url,
            updated_at: new Date(),
          })
          .where(eq(organizations.id, organization.id))
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
