import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env.ts'
import { schema } from './schema/schema.ts'

export const sql = postgres(env.DATABASE_URL)
export const db = drizzle(sql, {
  schema,
})
