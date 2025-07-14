// Primeiro, registre o plugin @fastify/sensible no seu app principal
// app.register(require('@fastify/sensible'))

import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { fastifyPlugin } from 'fastify-plugin'
import { db } from '../../db/connection.ts'
import { members } from '../../db/schema/modules/members.ts'
import { organizations } from '../../db/schema/modules/organizations.ts'

// Assumindo que @fastify/sensible está registrado
export const auth = fastifyPlugin((app: FastifyInstance) => {
  // biome-ignore lint/suspicious/useAwait: <necessary to function>
  app.addHook('preHandler', async (request) => {
    request.getCurrentUserId = async () => {
      try {
        const { sub } = await request.jwtVerify<{ sub: string }>()
        return sub
      } catch (_err) {
        // Lança um erro 401 Unauthorized
        throw new Error('Token de autenticação inválido')
      }
    }

    request.getUserMembership = async (slug: string) => {
      const userId = await request.getCurrentUserId()

      const result = await db
        .select({
          member: members,
          organization: organizations,
        })
        .from(members)
        .innerJoin(organizations, eq(members.organization_id, organizations.id))
        .where(and(eq(members.user_id, userId), eq(organizations.slug, slug)))
        .limit(1)

      const row = result[0]

      if (!row) {
        // Lança um erro 403 Forbidden
        throw new Error('Você não tem permissão para acessar esta organização.')
      }

      const { organization, member } = row

      return {
        organization,
        membership: member,
      }
    }
  })
})
