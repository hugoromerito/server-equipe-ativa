import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { members, organizations } from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import { getAttachmentsRoute } from '../../src/http/routes/attachments/get-attachments.ts'
import { uploadUserAvatarRoute } from '../../src/http/routes/attachments/upload-user-avatar.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

// Mock do serviço de storage
vi.mock('../../src/services/storage.ts', () => ({
  storageService: {
    uploadFile: vi.fn().mockResolvedValue({
      key: 'uploads/avatar.jpg',
      url: 'https://test-bucket.s3.amazonaws.com/uploads/avatar.jpg',
      originalName: 'avatar.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      encrypted: false,
    }),
  },
}))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Attachments Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let authToken: string
  let organizationId: string
  let organizationSlug: string
  let userId: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(uploadUserAvatarRoute)
    await app.register(getAttachmentsRoute)
    await app.ready()

    // Cria usuário de teste
    const { user, organizationId: orgId } = await testAuth.createTestUser({
      password: 'password123',
    })

    userId = user.id
    organizationId = orgId
    organizationSlug = `test-org-${randomUUID()}`

    // Atualiza o slug da organização
    if (testDb.db) {
      await testDb.db
        .update(organizations)
        .set({ slug: organizationSlug })
        .where(eq(organizations.id, organizationId))

      // Cria membership para o usuário
      await testDb.db.insert(members).values({
        user_id: userId,
        organization_id: organizationId,
        organization_role: 'ADMIN',
      })
    }

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('POST /organizations/:organizationSlug/users/:userId/avatar', () => {
    it('should upload user avatar successfully', async () => {
      // Arrange
      const testFilePath = path.join(
        __dirname,
        '..',
        'fixtures',
        'test-document.txt'
      )
      const fileBuffer = readFileSync(testFilePath)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/users/${userId}/avatar`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="avatar.jpg"',
          'Content-Type: image/jpeg',
          '',
          fileBuffer.toString(),
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('attachmentId')
      expect(body).toHaveProperty('url')
      expect(body.url).toContain('test-bucket.s3.amazonaws.com')
    })

    it('should require authentication', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/users/${userId}/avatar`,
        headers: {
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="avatar.jpg"',
          'Content-Type: image/jpeg',
          '',
          'fake image content',
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('should return error for non-existent organization', async () => {
      // Arrange
      const fileBuffer = Buffer.from('fake image content')

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/non-existent-org/users/${userId}/avatar`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="avatar.jpg"',
          'Content-Type: image/jpeg',
          '',
          fileBuffer.toString(),
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /organizations/:organizationSlug/attachments', () => {
    it('should list organization attachments', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/attachments`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('attachments')
      expect(body).toHaveProperty('pagination')
      expect(Array.isArray(body.attachments)).toBe(true)
    })

    it('should require authentication for listing attachments', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/attachments`,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('should support pagination parameters', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/attachments?page=1&limit=10`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(10)
    })
  })
})
