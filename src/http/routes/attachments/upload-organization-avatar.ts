import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { attachments, organizations } from '../../../db/schema/index.ts'
import { storageService } from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { processFileUpload } from '../../middlewares/upload.ts'

export const uploadOrganizationAvatarRoute: FastifyPluginCallbackZod = (
  app
) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/avatar',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload de avatar da organização',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: z.object({
          organizationSlug: z.string(),
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
      const { organizationSlug } = request.params as {
        organizationSlug: string
      }
      const currentUserId = await request.getCurrentUserId()

      const { organization, membership } =
        await request.getUserMembership(organizationSlug)

      // Verificar se o usuário pode alterar o avatar da organização
      const canUpload =
        membership.organization_role === 'ADMIN' ||
        membership.organization_role === 'MANAGER'

      if (!canUpload) {
        throw new Error(
          'Você não tem permissão para alterar o avatar da organização.'
        )
      }

      // Processar upload do arquivo
      const fileData = await processFileUpload(request, 'avatar')

      // Deletar avatar anterior se existir
      const existingAvatars = await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.organization_id, organization.id),
            eq(attachments.type, 'AVATAR')
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
              eq(attachments.organization_id, organization.id),
              eq(attachments.type, 'AVATAR')
            )
          )
      }

      // Upload para S3
      const uploadResult = await storageService.uploadFile(
        fileData.buffer,
        fileData.filename,
        fileData.mimetype,
        organization.id,
        'avatar'
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
          uploaded_by: currentUserId,
        })
        .returning()

      // Atualizar o campo avatar_url na tabela organizations
      await db
        .update(organizations)
        .set({
          avatar_url: attachment.url,
          updated_at: new Date(),
        })
        .where(eq(organizations.id, organization.id))

      return reply.status(201).send({
        attachmentId: attachment.id,
        url: attachment.url,
      })
    }
  )
}
