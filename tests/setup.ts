import { config } from 'dotenv'
import { afterAll, beforeAll } from 'vitest'

// Carrega variáveis de ambiente para teste ANTES de qualquer importação
config({ path: '.env.test' })

// Garante que as variáveis de ambiente estão definidas
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://test:test@localhost:5433/test_db"
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "my-jwt-secret"
if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = "sk-test-key"
if (!process.env.AWS_BUCKET_NAME) process.env.AWS_BUCKET_NAME = "test-bucket"
if (!process.env.AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = "test-access-key"
if (!process.env.AWS_SECRET_ACCESS_KEY) process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key"
if (!process.env.AWS_REGION) process.env.AWS_REGION = "sa-east-1"

import { TestDatabase } from './utils/test-database.ts'

let testDb: TestDatabase

beforeAll(async () => {
  testDb = new TestDatabase()
  await testDb.setup()
}, 30000) // Timeout de 30s para setup

afterAll(async () => {
  if (testDb) {
    await testDb.teardown()
  }
}, 30000) // Timeout de 30s para teardown

export { testDb }
