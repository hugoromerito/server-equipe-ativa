// src/config/env.ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod/v4'

export const env = createEnv({
  server: {
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.url().startsWith('postgresql://'),
    JWT_SECRET: z.string().default('my-jwt-secret'),
  },
  shared: {},
  client: {},
  runtimeEnv: {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  },
  emptyStringAsUndefined: true,
})
