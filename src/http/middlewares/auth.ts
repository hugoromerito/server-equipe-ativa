// Primeiro, registre o plugin @fastify/sensible no seu app principal
// app.register(require('@fastify/sensible'))

import { and, eq, type InferSelectModel } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { fastifyPlugin } from 'fastify-plugin'
import { db } from '../../db/connection.ts'
import { members, organizations, units } from '../../db/schema/index.ts'

declare module 'fastify' {
  interface FastifyRequest {
    getCurrentUserId(): Promise<string>
    getUserMembership(
      organizationSlug: string,
      unitSlug?: string
    ): Promise<{
      organization: InferSelectModel<typeof organizations>
      membership: InferSelectModel<typeof members>
    }>
  }
}

// Assumindo que @fastify/sensible está registrado
export const auth = fastifyPlugin((app: FastifyInstance) => {
  app.decorateRequest('getCurrentUserId', async function () {
    try {
      const { sub } = await this.jwtVerify<{ sub: string }>()
      return sub
    } catch {
      throw new Error('Token de autenticação inválido')
    }
  })

  app.decorateRequest(
    'getUserMembership',
    async function (organizationSlug: string, unitSlug?: string) {
      const userId = await this.getCurrentUserId()

      let query = db
        .select({
          member: members,
          organization: organizations,
        })
        .from(members)
        .innerJoin(organizations, eq(members.organization_id, organizations.id))
        .where(
          and(
            eq(members.user_id, userId),
            eq(organizations.slug, organizationSlug)
          )
        )

      if (unitSlug) {
        query = db
          .select({
            member: members,
            organization: organizations,
          })
          .from(members)
          .innerJoin(
            organizations,
            eq(members.organization_id, organizations.id)
          )
          .innerJoin(
            units,
            and(
              eq(units.organization_id, organizations.id),
              eq(units.slug, unitSlug)
            )
          )
          .where(
            and(
              eq(members.user_id, userId),
              eq(organizations.slug, organizationSlug)
            )
          )
      }

      const result = await query.limit(1)
      const row = result[0]

      if (!row) {
        const errorMessage = unitSlug
          ? 'Você não tem permissão para acessar esta unidade.'
          : 'Você não tem permissão para acessar esta organização.'
        throw new Error(errorMessage)
      }

      const { organization, member } = row

      return {
        organization,
        membership: member,
      }
    }
  )
})
