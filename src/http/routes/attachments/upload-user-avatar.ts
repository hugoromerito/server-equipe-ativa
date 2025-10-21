import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { attachments, users } from '../../../db/schema/index.ts'
import { storageService } from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { processFileUpload } from '../../middlewares/upload.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const uploadUserAvatarRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/users/:userId/avatar',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload de avatar do usuário',
        description: 'Faz upload do avatar do usuário autenticado',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: z.object({
          userId: z.string().uuid(),
        }),
        response: {
          201: z.object({
            attachmentId: z.string().uuid(),
            url: z.string().url(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params
      const currentUserId = await request.getCurrentUserId()

      // Verificar se o usuário pode alterar o avatar (apenas o próprio usuário)
      if (currentUserId !== userId) {
        throw new BadRequestError('Você só pode alterar seu próprio avatar.')
      }

      // Processar upload do arquivo
      const fileData = await processFileUpload(request, 'avatar')

      // Deletar avatar anterior se existir
      const existingAvatars = await db
        .select()
        .from(attachments)
        .where(
          and(eq(attachments.user_id, userId), eq(attachments.type, 'AVATAR'))
        )

      if (existingAvatars.length > 0) {
        // Deletar todos os avatares existentes
        const deletePromises = existingAvatars.map(async (avatar) => {
          try {
            await storageService.deleteFile(avatar.key)
          } catch (error) {
            // Log error for debugging purposes
            throw new Error(
              `Erro ao deletar arquivo do storage (key: ${avatar.key}): ${error}`
            )
          }
        })

        try {
          await Promise.allSettled(deletePromises)
        } catch {
          // Continue with database deletion even if some file deletions fail
        }

        try {
          await db
            .delete(attachments)
            .where(
              and(
                eq(attachments.user_id, userId),
                eq(attachments.type, 'AVATAR')
              )
            )
        } catch (error) {
          throw new Error(
            `Erro ao deletar registros de avatar do banco: ${error}`
          )
        }
      }

      // Upload para S3
      const uploadResult = await storageService.uploadFile(
        fileData.buffer,
        fileData.filename,
        fileData.mimetype,
        'avatar'
      )

      // Salvar no banco de dados (sem organization_id para avatar de usuário)
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
          user_id: userId,
          uploaded_by: currentUserId,
        })
        .returning()

      // Atualizar o campo avatar_url na tabela users
      await db
        .update(users)
        .set({
          avatar_url: attachment.url,
          updated_at: new Date(),
        })
        .where(eq(users.id, userId))

      return reply.status(201).send({
        attachmentId: attachment.id,
        url: attachment.url,
      })
    }
  )
}
