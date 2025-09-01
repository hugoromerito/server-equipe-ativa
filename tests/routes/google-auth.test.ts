import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest'
import { google } from 'googleapis'
import { authenticateWithGoogleRoute } from '../../src/http/routes/auth/authenticate-with-google.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

// Mock da biblioteca googleapis
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(),
    },
  },
}))

describe('Google Auth Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let mockOAuth2Client: any

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Mock do cliente OAuth2
    mockOAuth2Client = {
      getToken: vi.fn(),
      verifyIdToken: vi.fn(),
    }

    // Mock do construtor OAuth2
    ;(google.auth.OAuth2 as any).mockImplementation(() => mockOAuth2Client)

    // Registra a rota de autenticação com Google
    await app.register(authenticateWithGoogleRoute)
    await app.ready()
  })

  describe('POST /sessions/google', () => {
    it('deve autenticar um novo usuário com sucesso', async () => {
      // Arrange
      const mockTokens = {
        id_token: 'mock_id_token',
        access_token: 'mock_access_token',
      }

      const mockPayload = {
        sub: 'google_user_id_123',
        email: 'user@example.com',
        name: 'João Silva',
        picture: 'https://example.com/avatar.jpg',
      }

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue(mockPayload),
      }

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockOAuth2Client.verifyIdToken.mockResolvedValue(mockTicket)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          code: 'valid_google_code',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      
      expect(body).toHaveProperty('token')
      expect(body).toHaveProperty('user')
      expect(body.user).toMatchObject({
        email: mockPayload.email,
        name: mockPayload.name,
        avatarUrl: mockPayload.picture,
      })
      expect(typeof body.token).toBe('string')
      expect(typeof body.user.id).toBe('string')

      // Verifica se os mocks foram chamados corretamente
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('valid_google_code')
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken: mockTokens.id_token,
        audience: expect.any(String),
      })
    })

    it('deve autenticar um usuário existente com sucesso', async () => {
      // Arrange - criar usuário existente
      const existingUser = await testAuth.createTestUser({
        email: 'existing@example.com',
        name: 'Usuário Existente',
      })

      const mockTokens = {
        id_token: 'mock_id_token',
        access_token: 'mock_access_token',
      }

      const mockPayload = {
        sub: 'google_user_id_456',
        email: existingUser.user.email,
        name: 'Nome Atualizado',
        picture: 'https://example.com/new-avatar.jpg',
      }

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue(mockPayload),
      }

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockOAuth2Client.verifyIdToken.mockResolvedValue(mockTicket)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          code: 'valid_google_code',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      
      expect(body).toHaveProperty('token')
      expect(body).toHaveProperty('user')
      expect(body.user.email).toBe(existingUser.user.email)
      expect(body.user.id).toBe(existingUser.user.id)
    })

    it('deve retornar erro quando o código é inválido', async () => {
      // Arrange
      mockOAuth2Client.getToken.mockRejectedValue(new Error('Invalid code'))

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          code: 'invalid_code',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
      expect(body.message).toContain('Falha na autenticação com o Google')
    })

    it('deve retornar erro quando o id_token está ausente', async () => {
      // Arrange
      const mockTokens = {
        access_token: 'mock_access_token',
        // id_token ausente
      }

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          code: 'valid_code',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
      expect(body.message).toContain('Token de ID ausente')
    })

    it('deve retornar erro quando a verificação do token falha', async () => {
      // Arrange
      const mockTokens = {
        id_token: 'invalid_id_token',
        access_token: 'mock_access_token',
      }

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockOAuth2Client.verifyIdToken.mockRejectedValue(new Error('Invalid token'))

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          code: 'valid_code',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
      expect(body.message).toContain('Não foi possível verificar o token')
    })

    it('deve validar que o código é obrigatório', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          // code ausente
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })

    it('deve validar que o código não pode ser vazio', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          code: '',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })

    it('deve lidar com dados incompletos do Google', async () => {
      // Arrange
      const mockTokens = {
        id_token: 'mock_id_token',
        access_token: 'mock_access_token',
      }

      const mockPayload = {
        sub: 'google_user_id_789',
        email: 'minimal@example.com',
        // name e picture ausentes
      }

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue(mockPayload),
      }

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockOAuth2Client.verifyIdToken.mockResolvedValue(mockTicket)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/google',
        payload: {
          code: 'valid_google_code',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      
      expect(body).toHaveProperty('token')
      expect(body).toHaveProperty('user')
      expect(body.user.email).toBe(mockPayload.email)
      expect(body.user.name).toBe(mockPayload.email) // Deve usar email como fallback
      expect(body.user.avatarUrl).toBeNull()
    })
  })
})
