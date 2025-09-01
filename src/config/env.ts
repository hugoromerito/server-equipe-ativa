// src/config/env.ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod/v4'

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().positive().max(65535).default(3333),
    DATABASE_URL: z.url().startsWith('postgresql://'),
    REDIS_URL: z.string().url().optional(),
    JWT_SECRET: z.string().min(32, 'JWT Secret deve ter pelo menos 32 caracteres'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    OPENAI_API_KEY: z.string().min(1, 'OpenAI API Key é obrigatória'),
    AWS_BUCKET_NAME: z.string().min(1, 'AWS Bucket Name é obrigatório'),
    AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS Access Key ID é obrigatório'),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS Secret Access Key é obrigatório'),
    AWS_REGION: z.string().default('us-east-1'),
    MAX_FILE_SIZE: z.coerce.number().positive().default(10 * 1024 * 1024), // 10MB
    MAX_FILES_PER_UPLOAD: z.coerce.number().positive().max(10).default(5),
    GOOGLE_OAUTH_CLIENT_ID: z.string().min(1, 'Google OAuth Client ID é obrigatório'),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1, 'Google OAuth Client Secret é obrigatório'),
    GOOGLE_OAUTH_CLIENT_REDIRECT_URI: z.string().url('Google OAuth Redirect URI deve ser uma URL válida'),
  },
  shared: {},
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
    MAX_FILES_PER_UPLOAD: process.env.MAX_FILES_PER_UPLOAD,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_CLIENT_REDIRECT_URI: process.env.GOOGLE_OAUTH_CLIENT_REDIRECT_URI,
  },
  emptyStringAsUndefined: true,
})
