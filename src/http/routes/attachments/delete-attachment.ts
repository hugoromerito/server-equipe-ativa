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
import { NotFoundError } from '../_errors/not-found-error.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'

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
        throw new NotFoundError('Anexo não encontrado.')
      }

      // Verificar se o usuário pode deletar o anexo
      const { membership } = await request.getUserMembership(organizationSlug)

      const canDelete =
        attachment.uploaded_by === currentUserId ||
        membership.organization_role === 'ADMIN' ||
        membership.organization_role === 'MANAGER'

      if (!canDelete) {
        throw new ForbiddenError(
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

  // Rota mais simples para delete direto
  app.delete(
    '/attachments/:attachmentId',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Attachments'],
        summary: 'Deletar anexo direto',
        security: [{ bearerAuth: [] }],
        params: z.object({
          attachmentId: z.uuid(),
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { attachmentId } = request.params as {
        attachmentId: string
      }
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
        throw new ForbiddenError('Você não tem permissão para deletar este anexo.')
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

      return reply.send({ message: 'Anexo deletado com sucesso.' })
    }
  )
}
