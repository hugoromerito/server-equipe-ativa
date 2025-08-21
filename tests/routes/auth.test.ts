import { beforeEach, describe, expect, it } from 'vitest'
import { authenticateWithPasswordRoute } from '../../src/http/routes/auth/authenticate-with-password.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Auth Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra a rota de autenticação
    await app.register(authenticateWithPasswordRoute)
    await app.ready()
  })

  describe('POST /sessions/password', () => {
    it('deve autenticar o usuário com credenciais válidas', async () => {
      // Arrange
      const password = 'password123'
      const { user } = await testAuth.createTestUser({
        email: 'user@example.com',
        password,
      })

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/password',
        payload: {
          email: user.email,
          password,
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('token')
      expect(typeof body.token).toBe('string')
    })

    it('deve retornar erro para e-mail não cadastrado', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/password',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400) // Erro por não encontrar usuário
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })

    it('deve retornar erro para senha inválida', async () => {
      // Arrange
      const { user } = await testAuth.createTestUser({
        email: 'user@example.com',
        password: 'correctpassword',
      })

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/password',
        payload: {
          email: user.email,
          password: 'wrongpassword',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400) // Erro por senha inválida
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })

    it('deve validar o formato de e-mail', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/password',
        payload: {
          email: 'invalid-email',
          password: 'password123',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400) // Erro de validação
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })

    it('deve validar o comprimento da senha', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/password',
        payload: {
          email: 'user@example.com',
          password: '123', // Muito curta
        },
      })

      // Assert
      expect(response.statusCode).toBe(400) // Erro de validação
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })
  })
})
