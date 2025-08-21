import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import type { Attachment } from '../../../db/schema/attachments.ts'
import {
  applicants,
  attachments,
  demands,
  organizations,
  users,
} from '../../../db/schema/index.ts'
import { storageService } from '../../../services/storage.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'

async function updateAvatarFields(attachment: Attachment) {
  if (attachment.type !== 'AVATAR') {
    return
  }

  if (attachment.user_id) {
    await db
      .update(users)
      .set({ avatar_url: null, updated_at: new Date() })
      .where(eq(users.id, attachment.user_id))
  }

  if (attachment.applicant_id) {
    await db
      .update(applicants)
      .set({ avatar_url: null, updated_at: new Date() })
      .where(eq(applicants.id, attachment.applicant_id))
  }

  if (attachment.organization_id) {
    await db
      .update(organizations)
      .set({ avatar_url: null, updated_at: new Date() })
      .where(eq(organizations.id, attachment.organization_id))
  }
}

async function updateMainAttachmentFields(
  attachment: Attachment,
  attachmentId: string
) {
  if (attachment.demand_id) {
    const demand = await db
      .select()
      .from(demands)
      .where(eq(demands.id, attachment.demand_id))
      .then((rows) => rows[0])

    if (demand?.attachment === attachment.url) {
      const remainingAttachments = await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.demand_id, attachment.demand_id),
            eq(attachments.id, attachmentId)
          )
        )

      const newMainAttachment = remainingAttachments.find(
        (att) => att.id !== attachmentId
      )
      await db
        .update(demands)
        .set({
          attachment: newMainAttachment?.url || null,
          updated_at: new Date(),
        })
        .where(eq(demands.id, attachment.demand_id))
    }
  }

  if (attachment.applicant_id) {
    const applicant = await db
      .select()
      .from(applicants)
      .where(eq(applicants.id, attachment.applicant_id))
      .then((rows) => rows[0])

    if (applicant?.attachment === attachment.url) {
      const remainingAttachments = await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.applicant_id, attachment.applicant_id),
            eq(attachments.id, attachmentId)
          )
        )

      const newMainAttachment = remainingAttachments.find(
        (att) => att.id !== attachmentId
      )
      await db
        .update(applicants)
        .set({
          attachment: newMainAttachment?.url || null,
          updated_at: new Date(),
        })
        .where(eq(applicants.id, attachment.applicant_id))
    }
  }
}

export const deleteAttachmentRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).delete(
    '/organizations/:organizationSlug/attachments/:attachmentId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Deletar anexo',
        security: [{ bearerAuth: [] }],
        params: z.object({
          organizationSlug: z.string(),
          attachmentId: z.uuid(),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { organizationSlug, attachmentId } = request.params as {
        organizationSlug: string
        attachmentId: string
      }
      const currentUserId = await request.getCurrentUserId()

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

      // Verificar se o usuário pode deletar o anexo
      const { membership } = await request.getUserMembership(organizationSlug)

      const canDelete =
        attachment.uploaded_by === currentUserId ||
        membership.organization_role === 'ADMIN' ||
        membership.organization_role === 'MANAGER'

      if (!canDelete) {
        throw new BadRequestError(
          'Você não tem permissão para deletar este anexo.'
        )
      }

      try {
        // Deletar do S3
        await storageService.deleteFile(attachment.key)
      } catch {
        // Continue with database deletion even if S3 deletion fails
      }

      // Atualizar campos relacionados
      await updateAvatarFields(attachment)
      await updateMainAttachmentFields(attachment, attachmentId)

      // Deletar do banco de dados
      await db.delete(attachments).where(eq(attachments.id, attachmentId))

      return reply.status(204).send()
    }
  )
}
