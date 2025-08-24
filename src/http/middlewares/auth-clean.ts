import { and, eq, type InferSelectModel } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { fastifyPlugin } from 'fastify-plugin'
import { db } from '../../db/connection.ts'
import { members, organizations, units } from '../../db/schema/index.ts'
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.ts'
import { NotFoundError } from '../routes/_errors/not-found-error.ts'
import { UnauthorizedError } from '../routes/_errors/unauthorized-error.ts'

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

/**
 * Plugin de autenticação que adiciona métodos úteis à requisição
 * Implementado seguindo as melhores práticas de Clean Code
 */
export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  /**
   * Obtém o ID do usuário atual a partir do token JWT
   * @returns Promise<string> - ID do usuário
   * @throws UnauthorizedError quando token inválido
   */
  app.decorateRequest('getCurrentUserId', async function (this: FastifyRequest) {
    try {
      const { sub } = await this.jwtVerify<{ sub: string }>()
      
      if (!sub) {
        throw new UnauthorizedError('Token inválido: ID do usuário não encontrado')
      }
      
      return sub
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error
      }
      throw new UnauthorizedError('Token de autenticação inválido ou expirado')
    }
  })

  /**
   * Obtém informações de membership do usuário em uma organização/unidade
   * @param organizationSlug - Slug da organização
   * @param unitSlug - Slug da unidade (opcional)
   * @returns Promise com organização e membership
   * @throws NotFoundError quando organização/unidade não encontrada ou usuário sem acesso
   */
  app.decorateRequest('getUserMembership', async function (
    this: FastifyRequest,
    organizationSlug: string,
    unitSlug?: string
  ) {
    const userId = await this.getCurrentUserId()

    // Query base para buscar organização e membership
    const baseQuery = db
      .select({
        organization: organizations,
        member: members,
      })
      .from(organizations)
      .innerJoin(members, eq(members.organization_id, organizations.id))
      .where(
        and(
          eq(organizations.slug, organizationSlug),
          eq(members.user_id, userId),
          eq(organizations.should_attach_users_by_domain, false)
        )
      )

    // Se unitSlug for fornecida, cria nova query com join
    const finalQuery = unitSlug
      ? db
          .select({
            organization: organizations,
            member: members,
          })
          .from(organizations)
          .innerJoin(members, eq(members.organization_id, organizations.id))
          .innerJoin(units, eq(units.organization_id, organizations.id))
          .where(
            and(
              eq(organizations.slug, organizationSlug),
              eq(units.slug, unitSlug),
              eq(members.user_id, userId),
              eq(organizations.should_attach_users_by_domain, false)
            )
          )
      : baseQuery

    const result = await finalQuery.limit(1)
    const row = result[0]

    if (!row) {
      const errorMessage = unitSlug
        ? `Você não tem permissão para acessar a unidade '${unitSlug}' na organização '${organizationSlug}'`
        : `Você não tem permissão para acessar a organização '${organizationSlug}'`
      
      throw new NotFoundError(errorMessage)
    }

    const { organization, member } = row

    return {
      organization,
      membership: member,
    }
  })
})

/**
 * Pre-handler para validação de autenticação em rotas protegidas
 * Implementa tratamento de erro padronizado
 */
export const authPreHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    await request.jwtVerify()
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Token de autenticação inválido'
    
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      error: 'Unauthorized',
      code: ERROR_CODES.UNAUTHORIZED,
      message: errorMessage.includes('expired') 
        ? 'Token de autenticação expirado'
        : 'Token de autenticação obrigatório ou inválido'
    })
  }
}
