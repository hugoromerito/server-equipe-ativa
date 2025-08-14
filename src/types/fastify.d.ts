// Em um arquivo como `fastify.d.ts`
import 'fastify'
import type { members, organizations } from '../db/schema/index.ts'

declare module 'fastify' {
  export interface FastifyRequest {
    // Retorna o ID do usuário
    getCurrentUserId(): Promise<string>
    // Verifica se o member pertence a organization (com unitSlug opcional)
    getUserMembership(
      organizationSlug: string,
      unitSlug?: string
    ): Promise<{
      organization: typeof organizations.$inferSelect
      membership: typeof members.$inferSelect
    }>
  }
}
