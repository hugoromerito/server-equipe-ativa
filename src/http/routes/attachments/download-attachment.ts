import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { attachments } from '../../../db/schema/index.ts'
import { storageService } from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

export const downloadAttachmentRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).get(
    '/organizations/:organizationSlug/attachments/:attachmentId/download',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Baixar anexo',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          attachmentId: z.uuid(),
        }),
        querystring: z.object({
          expiresIn: z.coerce.number().min(60).max(86_400).default(3600), // 1 minuto até 24 horas
        }),
        response: {
          200: z.object({
            downloadUrl: z.string(),
            originalName: z.string(),
            size: z.number(),
            mimeType: z.string(),
            expiresIn: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, attachmentId } = request.params as {
        organizationSlug: string
        attachmentId: string
      }
      const { expiresIn } = request.query as { expiresIn: number }

      const { organization } = await request.getUserMembership(organizationSlug)

      // Verificar se o anexo existe e pertence à organização
      const [attachment] = await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.id, attachmentId),
            eq(attachments.organization_id, organization.id)
          )
        )

      if (!attachment) {
        throw new BadRequestError('Anexo não encontrado.')
      }

      // Gerar URL de download temporária
      const downloadUrl = await storageService.getSignedDownloadUrl(
        attachment.key,
        expiresIn as 3600
      )

      return reply.send({
        downloadUrl,
        originalName: attachment.original_name,
        size: attachment.size,
        mimeType: attachment.mime_type,
        expiresIn,
      })
    }
  )
}
