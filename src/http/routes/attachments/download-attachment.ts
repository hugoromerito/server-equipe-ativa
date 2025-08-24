import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { attachments, organizations } from '../../../db/schema/index.ts'
import { storageService } from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'

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
        throw new NotFoundError('Anexo não encontrado.')
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

  // Rota mais simples para download direto
  app.get(
    '/attachments/:attachmentId/download',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Baixar anexo direto',
        security: [{ bearerAuth: [] }],
        params: z.object({
          attachmentId: z.uuid(),
        }),
        querystring: z.object({
          expiresIn: z.coerce.number().min(60).max(86_400).default(3600),
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
      const { attachmentId } = request.params as {
        attachmentId: string
      }
      const { expiresIn } = request.query as { expiresIn: number }
      const currentUserId = await request.getCurrentUserId()

      // Verificar se o anexo existe
      const [attachment] = await db
        .select()
        .from(attachments)
        .where(eq(attachments.id, attachmentId))

      if (!attachment) {
        throw new NotFoundError('Anexo não encontrado.')
      }

      // Buscar a organização para obter o slug
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, attachment.organization_id))

      if (!organization) {
        throw new NotFoundError('Organização não encontrada.')
      }

      // Verificar permissão - usuário deve ter acesso à organização
      try {
        await request.getUserMembership(organization.slug)
      } catch {
        throw new ForbiddenError('Você não tem permissão para acessar este anexo.')
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
