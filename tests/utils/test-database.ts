import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import {
  applicants,
  attachments,
  demands,
  invites,
  members,
  organizations,
  units,
  users,
} from '../../src/db/schema/index.ts'

export class TestDatabase {
  private client: postgres.Sql | null = null
  db: ReturnType<typeof drizzle> | null = null

  async setup() {
    // Usa DATABASE_URL do .env.test (PostgreSQL local para testes)
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://test:test@localhost:5433/test_db'

    // Conecta ao banco
    this.client = postgres(connectionString, { max: 1 })
    this.db = drizzle(this.client)

    // Executa migrations
    await migrate(this.db, { migrationsFolder: './src/db/migrations' })
  }

  async teardown() {
    if (this.client) {
      await this.client.end()
    }
  }

  async clearDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Limpa todas as tabelas na ordem correta (respeita foreign keys)
    // Primeiro limpa tabelas filhas (que referenciam outras)
    await this.db.delete(attachments)
    await this.db.delete(demands)
    await this.db.delete(members)
    await this.db.delete(invites)
    await this.db.delete(applicants)
    await this.db.delete(units)
    await this.db.delete(users)
    await this.db.delete(organizations)
  }

  getConnectionString() {
    return (
      process.env.DATABASE_URL ||
      'postgresql://test:test@localhost:5433/test_db'
    )
  }
}
