import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

// Carrega as variáveis de ambiente do .env.test antes de tudo
config({ path: '.env.test' })

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://test:test@localhost:5433/test_db",
      JWT_SECRET: process.env.JWT_SECRET || "your-super-secret-jwt-key-here-minimum-32-characters-long-for-security",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || "sk-test-key",
      AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME || "test-bucket",
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "test-access-key",
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "test-secret-key",
      AWS_REGION: process.env.AWS_REGION || "sa-east-1",
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || "test-google-client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "test-google-client-secret",
      GOOGLE_OAUTH_CLIENT_REDIRECT_URI: process.env.GOOGLE_OAUTH_CLIENT_REDIRECT_URI || "http://localhost:3000/auth/callback",
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'src/db/migrations/**',
        '**/*.d.ts',
      ],
    },
    // Executa testes sequencialmente para evitar conflitos no banco de dados
    fileParallelism: false,
    sequence: {
      hooks: 'list'
    }
  },
})
