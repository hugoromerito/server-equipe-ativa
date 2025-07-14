import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { BadRequestError } from '@/http/routes/_errors/bad-request-error'
import { prisma } from '@/lib/prisma'
import { roleSchema } from '@/auth/src'

export async function getPendingInvites(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/pending-invites',
      {
        schema: {
          tags: ['Invites'],
          summary: 'Get all user pending invites',
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              invites: z.array(
                z.object({
                  id: z.string().uuid(),
                  role: roleSchema,
                  email: z.string().email(),
                  createdAt: z.date(),
                  unit: z
                    .object({
                      name: z.string(),
                      organization: z.object({
                        name: z.string(),
                      }),
                    })
                    .nullable(),
                  author: z
                    .object({
                      id: z.string().uuid(),
                      name: z.string().nullable(),
                      avatarUrl: z.string().url().nullable(),
                    })
                    .nullable(),
                }),
              ),
            }),
          },
        },
      },
      async (request) => {
        const userId = await request.getCurrentUserId()
        console.log('User ID:', userId)

        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
        })

        if (!currentUser) {
          throw new BadRequestError('Usuário não encontrado.')
        }

        const invites = await prisma.invite.findMany({
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
                organization: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          where: {
            email: currentUser.email,
          },
        })

        return { invites }
      },
    )
}
