import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, attachments } from '../../../db/schema/index.ts'
import {
  type AttachmentType,
  storageService,
} from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { processFileUpload } from '../../middlewares/upload.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'

export const uploadApplicantDocumentRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/applicants/:applicantId/documents',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload de documento para requerente',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: z.object({
          organizationSlug: z.string(),
          applicantId: z.uuid(),
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
      const { organizationSlug, applicantId } = request.params as {
        organizationSlug: string
        applicantId: string
      }
      
      const body = request.body as any
      const type = body?.type?.value || body?.type || 'DOCUMENT'
      
      const currentUserId = await request.getCurrentUserId()

      const { organization } = await request.getUserMembership(organizationSlug)

      // Verificar se o requerente existe e pertence à organização
      const [applicant] = await db
        .select()
        .from(applicants)
        .where(
          and(
            eq(applicants.id, applicantId),
            eq(applicants.organization_id, organization.id)
          )
        )

      if (!applicant) {
        throw new NotFoundError('Requerente não encontrado.')
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
        applicantId
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
          applicant_id: applicantId,
          uploaded_by: currentUserId,
        })
        .returning()

      // Atualizar o campo attachment na tabela applicants se for o primeiro documento
      const existingAttachments = await db
        .select()
        .from(attachments)
        .where(eq(attachments.applicant_id, applicantId))

      if (existingAttachments.length === 1) {
        await db
          .update(applicants)
          .set({
            attachment: attachment.url,
            updated_at: new Date(),
          })
          .where(eq(applicants.id, applicantId))
      }

      // Se for um avatar, atualizar o campo avatar_url
      if (type?.toUpperCase() === 'AVATAR') {
        await db
          .update(applicants)
          .set({
            avatar_url: attachment.url,
            updated_at: new Date(),
          })
          .where(eq(applicants.id, applicantId))
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
