// Em um arquivo como `fastify.d.ts`
import 'fastify'
import type { members } from '../db/schema/modules/members.ts'
import type { organizations } from '../db/schema/modules/organizations.ts'

declare module 'fastify' {
  export interface FastifyRequest {
    // Retorna o ID do usuário
    getCurrentUserId(): Promise<string>
    // Verifica se o member pertence a organization
    getUserMembership(slug: string): Promise<{
      organization: typeof organizations.$inferSelect
      membership: typeof members.$inferSelect
    }>
  }
}
