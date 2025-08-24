import { afterAll, beforeAll } from 'vitest'
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
