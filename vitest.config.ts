import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
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
