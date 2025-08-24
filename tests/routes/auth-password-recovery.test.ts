import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  members,
  organizations,
  tokens,
  users,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  requestPasswordRecoverRoute,
  resetPasswordRoute,
} from '../../src/http/routes/auth/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Auth Password Recovery Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let userId: string
  let userEmail: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra as rotas de recuperação de senha
    await app.register(requestPasswordRecoverRoute)
    await app.register(resetPasswordRoute)
    await app.ready()

    // Cria usuário de teste
    const { user } = await testAuth.createTestUser({
      email: 'user@example.com',
      password: 'password123',
    })

    userId = user.id
    userEmail = user.email
  })

  describe('POST /password/recover', () => {
    it('deve solicitar recuperação de senha com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/recover',
        payload: {
          email: userEmail,
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
    })

    it('deve retornar sucesso mesmo para email inexistente (segurança)', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/recover',
        payload: {
          email: 'nonexistent@example.com',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
    })

    it('deve retornar erro para email inválido', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/recover',
        payload: {
          email: 'invalid-email',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para payload vazio', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/recover',
        payload: {},
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para email em branco', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/recover',
        payload: {
          email: '',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /password/reset', () => {
    it('deve resetar senha com token válido', async () => {
      // Arrange - Primeiro solicita recuperação para gerar token
      const recoverResponse = await app.inject({
        method: 'POST',
        url: '/password/recover',
        payload: {
          email: userEmail,
        },
      })

      // Simula que temos o token (em uma implementação real, seria enviado por email)
      // Para este teste, vamos criar o token diretamente no banco
      let resetToken: string
      if (testDb.db) {
        const [token] = await testDb.db
          .insert(tokens)
          .values({
            type: 'PASSWORD_RECOVER',
            user_id: userId,
          })
          .returning()
        resetToken = token.id
      } else {
        resetToken = 'valid-reset-token-123'
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: resetToken,
          password: 'newpassword123',
        },
      })

      // Assert
      expect(response.statusCode).toBe(204)
    })

    it('deve retornar erro para token inválido', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: 'invalid-token',
          password: 'newpassword123',
        },
      })

      // Assert
      console.log('Status Code:', response.statusCode)
      console.log('Response Body:', response.body)
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })

    it('deve retornar erro para token expirado', async () => {
      // Arrange - Cria um token expirado (simulando com token inexistente)
      const expiredToken = 'expired-token-that-does-not-exist-123'

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: expiredToken,
          password: 'newpassword123',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para senha muito curta', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: 'valid-token',
          password: '123', // senha muito curta
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para payload incompleto', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: 'valid-token',
          // password omitido
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para token em branco', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: '',
          password: 'newpassword123',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve invalidar o token após uso bem-sucedido', async () => {
      // Arrange
      let resetToken: string
      if (testDb.db) {
        const [token] = await testDb.db
          .insert(tokens)
          .values({
            type: 'PASSWORD_RECOVER',
            user_id: userId,
          })
          .returning()
        resetToken = token.id
      } else {
        resetToken = 'valid-reset-token-456'
      }

      // Act - Primeiro reset
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: resetToken,
          password: 'newpassword123',
        },
      })

      // Assert primeiro reset funcionou
      expect(firstResponse.statusCode).toBe(204)

      // Act - Tenta usar o mesmo token novamente
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          code: resetToken,
          password: 'anotherpassword123',
        },
      })

      // Assert segundo reset falhou
      expect(secondResponse.statusCode).toBe(400)
    })
  })
})
