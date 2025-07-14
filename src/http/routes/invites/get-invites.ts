import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'
import { roleSchema } from '@/auth/src'

export async function getInvites(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/invites',
      {
        schema: {
          tags: ['invites'],
          summary: 'Get all organization invites',
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              invites: z.array(
                z.object({
                  id: z.string().uuid(),
                  email: z.string().email(),
                  role: roleSchema,
                  createdAt: z.date(),
                  author: z
                    .object({
                      id: z.string().uuid(),
                      name: z.string().nullable(),
                    })
                    .nullable(),
                  unit: z
                    .object({
                      name: z.string(),
                      organization: z.object({
                        name: z.string(),
                      }),
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

        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        })

        if (!currentUser) {
          throw new BadRequestError('Usuário não encontrado.')
        }

        const invites = await prisma.invite.findMany({
          where: {
            email: currentUser.email,
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
          orderBy: {
            createdAt: 'desc',
          },
        })

        return { invites }
      },
    )
}
