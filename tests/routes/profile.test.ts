import { beforeEach, describe, expect, it } from 'vitest'
import { auth } from '../../src/http/middlewares/auth.ts'
import { getProfileRoute } from '../../src/http/routes/auth/get-profile.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Profile Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e a rota
    await app.register(auth)
    await app.register(getProfileRoute)
    await app.ready()
  })

  describe('GET /profile', () => {
    it('deve retornar o perfil do usuário com token válido', async () => {
      // Arrange
      const { user } = await testAuth.createTestUser({
        name: 'John Doe',
        password: 'password123',
      })

      const token = testAuth.generateJwtToken(user.id, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('user')
      expect(body.user.id).toBe(user.id)
      expect(body.user.email).toBe(user.email)
      expect(body.user.name).toBe(user.name)
    })

    it('deve retornar erro 401 sem token', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/profile',
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('deve retornar erro 401 com token inválido', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })
})
