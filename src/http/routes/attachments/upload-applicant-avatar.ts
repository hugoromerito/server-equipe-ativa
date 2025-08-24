import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants, attachments } from '../../../db/schema/index.ts'
import { storageService } from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { processFileUpload } from '../../middlewares/upload.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'

export const uploadApplicantAvatarRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/applicants/:applicantId/avatar',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload de avatar do requerente',
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
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, applicantId } = request.params as {
        organizationSlug: string
        applicantId: string
      }
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
      const fileData = await processFileUpload(request, 'avatar')

      // Deletar avatar anterior se existir
      const existingAvatars = await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.applicant_id, applicantId),
            eq(attachments.type, 'AVATAR'),
            eq(attachments.organization_id, organization.id)
          )
        )

      if (existingAvatars.length > 0) {
        // Deletar todos os avatares existentes
        const deletePromises = existingAvatars.map(async (avatar) => {
          try {
            await storageService.deleteFile(avatar.key)
          } catch {
            // Continue even if S3 deletion fails
          }
        })

        await Promise.allSettled(deletePromises)

        await db
          .delete(attachments)
          .where(
            and(
              eq(attachments.applicant_id, applicantId),
              eq(attachments.type, 'AVATAR'),
              eq(attachments.organization_id, organization.id)
            )
          )
      }

      // Upload para S3
      const uploadResult = await storageService.uploadFile(
        fileData.buffer,
        fileData.filename,
        fileData.mimetype,
        organization.id,
        'avatar',
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
          type: 'AVATAR',
          encrypted: uploadResult.encrypted,
          organization_id: organization.id,
          applicant_id: applicantId,
          uploaded_by: currentUserId,
        })
        .returning()

      // Atualizar o campo avatar_url na tabela applicants
      await db
        .update(applicants)
        .set({
          avatar_url: attachment.url,
          updated_at: new Date(),
        })
        .where(eq(applicants.id, applicantId))

      return reply.status(201).send({
        attachmentId: attachment.id,
        url: attachment.url,
      })
    }
  )
}
