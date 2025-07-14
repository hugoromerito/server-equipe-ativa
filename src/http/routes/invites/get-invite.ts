import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'
import { roleSchema } from '@/auth/src'

export async function getInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/invites/:inviteId',
    {
      schema: {
        tags: ['invites'],
        summary: 'Get an invite',
        params: z.object({
          inviteId: z.string().uuid(),
        }),
        response: {
          200: z
            .object({
              invite: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                role: roleSchema,
                createdAt: z.date(),
                author: z
                  .object({
                    id: z.string().uuid(),
                    name: z.string().nullable(),
                    avatarUrl: z.string().url().nullable(),
                  })
                  .nullable(),
                unit: z
                  .object({
                    name: z.string(),
                    location: z.string(),
                    organization: z.object({
                      name: z.string(),
                    }),
                  })
                  .nullable(),
              }),
            })
            .nullable(),
        },
      },
    },
    async (request) => {
      const { inviteId } = request.params

      const invite = await prisma.invite.findUnique({
        where: {
          id: inviteId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          unit: {
            select: {
              name: true,
              location: true,
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!invite) {
        throw new BadRequestError('Convite não encontrado.')
      }

      return { invite }
    },
  )
}
