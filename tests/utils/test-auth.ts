import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { organizations, users } from '../../src/db/schema/index.ts'
import type { TestDatabase } from './test-database.ts'

export class TestAuth {
  private db: TestDatabase

  constructor(db: TestDatabase) {
    this.db = db
  }

  async createTestUser(data?: {
    email?: string
    name?: string
    password?: string
    organizationId?: string
  }) {
    if (!this.db.db) {
      throw new Error('Database not initialized')
    }

    const email = data?.email || `test-${randomUUID()}@example.com`
    const name = data?.name || 'Test User'
    const password = data?.password || 'password123'
    const passwordHash = await hash(password, 8)

    let organizationId = data?.organizationId

    if (!organizationId) {
      // Cria uma organização com um ID único
      const orgId = randomUUID()

      // Cria uma organização
      const [org] = await this.db.db
        .insert(organizations)
        .values({
          id: orgId,
          name: `Test Organization ${randomUUID().slice(0, 8)}`,
          slug: `test-org-${randomUUID()}`,
          domain: null,
          should_attach_users_by_domain: false,
          avatar_url: null,
          created_at: new Date(),
          updated_at: new Date(),
          owner_id: randomUUID(), // ID temporário que será substituído
        })
        .returning()

      organizationId = org.id
    }

    const [user] = await this.db.db
      .insert(users)
      .values({
        name,
        email,
        avatar_url: null,
        password_hash: passwordHash,
        created_at: new Date(),
        updated_at: new Date(),
        last_seen: new Date(),
      })
      .returning()

    return {
      user,
      password,
      organizationId,
    }
  }

  generateJwtToken(
    userId: string,
    app: {
      jwt: {
        sign: (
          payload: { sub: string },
          options: { expiresIn: string }
        ) => string
      }
    }
  ) {
    return app.jwt.sign({ sub: userId }, { expiresIn: '7d' })
  }
}
