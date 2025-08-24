import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applicants,
  attachments,
  demands,
  members,
  organizations,
  units,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  deleteAttachmentRoute,
  downloadAttachmentRoute,
  uploadApplicantAvatarRoute,
  uploadApplicantDocumentRoute,
  uploadDemandDocumentRoute,
  uploadOrganizationAvatarRoute,
  uploadOrganizationDocumentRoute,
} from '../../src/http/routes/attachments/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

// Mock do serviço de storage
vi.mock('../../src/services/storage.ts', () => ({
  storageService: {
    uploadFile: vi.fn().mockResolvedValue({
      key: 'uploads/test-file.jpg',
      url: 'https://test-bucket.s3.amazonaws.com/uploads/test-file.jpg',
      originalName: 'test-file.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      encrypted: false,
    }),
    deleteFile: vi.fn().mockResolvedValue(true),
    getSignedUrl: vi.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/uploads/test-file.jpg?signed=true'),
    getSignedDownloadUrl: vi.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/uploads/test-file.jpg?signed=true'),
  },
}))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Additional Attachments Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let authToken: string
  let organizationId: string
  let organizationSlug: string
  let unitId: string
  let applicantId: string
  let demandId: string
  let userId: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(uploadApplicantAvatarRoute)
    await app.register(uploadApplicantDocumentRoute)
    await app.register(uploadOrganizationAvatarRoute)
    await app.register(uploadOrganizationDocumentRoute)
    await app.register(uploadDemandDocumentRoute)
    await app.register(downloadAttachmentRoute)
    await app.register(deleteAttachmentRoute)
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
    }

    // Cria unidade
    if (testDb.db) {
      const [unit] = await testDb.db
        .insert(units)
        .values({
          name: 'Test Unit',
          slug: `test-unit-${randomUUID()}`,
          location: 'Test Location',
          organization_id: organizationId,
          owner_id: userId,
          created_at: new Date(),
        })
        .returning()

      unitId = unit.id

      // Cria membership para o usuário
      await testDb.db.insert(members).values({
        user_id: userId,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'ADMIN',
        unit_role: 'MANAGER',
      })
    }

    // Cria solicitante
    if (testDb.db) {
      const [applicant] = await testDb.db
        .insert(applicants)
        .values({
          name: 'John Doe',
          birthdate: '1990-01-01',
          cpf: '12345678901',
          phone: '+5511999999999',
          mother: 'Maria Doe',
          father: 'José Doe',
          organization_id: organizationId,
          created_at: new Date(),
        })
        .returning()

      applicantId = applicant.id
    }

    // Cria demanda
    if (testDb.db) {
      const [demand] = await testDb.db
        .insert(demands)
        .values({
          title: 'Test Demand',
          description: 'Test demand description',
          category: 'SOCIAL_ASSISTANCE',
          priority: 'MEDIUM',
          status: 'PENDING',
          applicant_id: applicantId,
          unit_id: unitId,
          created_by_member_name: 'Test User',
          created_at: new Date(),
        })
        .returning()

      demandId = demand.id
    }

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('POST /organizations/:organizationSlug/applicants/:applicantSlug/avatar', () => {
    it('deve carregar avatar do solicitante com sucesso', async () => {
      // Arrange
      const testFilePath = path.join(__dirname, '..', 'fixtures', 'test-document.txt')
      const fileBuffer = readFileSync(testFilePath)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/applicants/${applicantId}/avatar`,
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
    })

    it('deve retornar erro para solicitante inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/applicants/${randomUUID()}/avatar`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="avatar.jpg"',
          'Content-Type: image/jpeg',
          '',
          'fake-content',
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /organizations/:organizationSlug/applicants/:applicantSlug/documents', () => {
    it('deve carregar documento do solicitante com sucesso', async () => {
      // Arrange
      const testFilePath = path.join(__dirname, '..', 'fixtures', 'test-document.txt')
      const fileBuffer = readFileSync(testFilePath)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/applicants/${applicantId}/documents`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="document.pdf"',
          'Content-Type: application/pdf',
          '',
          fileBuffer.toString(),
          '------formdata-test',
          'Content-Disposition: form-data; name="type"',
          '',
          'DOCUMENT',
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('attachmentId')
    })
  })

  describe('POST /organizations/:organizationSlug/avatar', () => {
    it('deve carregar avatar da organização com sucesso', async () => {
      // Arrange
      const testFilePath = path.join(__dirname, '..', 'fixtures', 'test-document.txt')
      const fileBuffer = readFileSync(testFilePath)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/avatar`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="org-avatar.jpg"',
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
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Arrange - Cria usuário sem permissão de admin
      const { user: memberUser } = await testAuth.createTestUser({
        email: 'member@example.com',
        password: 'password123',
      })

      if (testDb.db) {
        await testDb.db.insert(members).values({
          user_id: memberUser.id,
          organization_id: organizationId,
          organization_role: 'CLERK', // Não é admin
        })
      }

      const memberToken = testAuth.generateJwtToken(memberUser.id, app)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/avatar`,
        headers: {
          authorization: `Bearer ${memberToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="org-avatar.jpg"',
          'Content-Type: image/jpeg',
          '',
          'fake-content',
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })
  })

  describe('POST /organizations/:organizationSlug/documents', () => {
    it('deve carregar documento da organização com sucesso', async () => {
      // Arrange
      const testFilePath = path.join(__dirname, '..', 'fixtures', 'test-document.txt')
      const fileBuffer = readFileSync(testFilePath)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/documents`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="org-document.pdf"',
          'Content-Type: application/pdf',
          '',
          fileBuffer.toString(),
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('attachmentId')
    })
  })

  describe('POST /organizations/:organizationSlug/demands/:demandId/documents', () => {
    it('deve carregar documento da demanda com sucesso', async () => {
      // Arrange
      const testFilePath = path.join(__dirname, '..', 'fixtures', 'test-document.txt')
      const fileBuffer = readFileSync(testFilePath)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/demands/${demandId}/documents`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="demand-document.pdf"',
          'Content-Type: application/pdf',
          '',
          fileBuffer.toString(),
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('attachmentId')
    })

    it('deve retornar erro para demanda inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/demands/${randomUUID()}/documents`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test',
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="document.pdf"',
          'Content-Type: application/pdf',
          '',
          'fake-content',
          '------formdata-test--',
        ].join('\r\n'),
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /attachments/:attachmentId/download', () => {
    it('deve fazer download de anexo com sucesso', async () => {
      // Arrange - Cria um anexo
      let attachmentId: string
      if (testDb.db) {
        const [attachment] = await testDb.db
          .insert(attachments)
          .values({
            type: 'DOCUMENT',
            original_name: 'test-document.pdf',
            size: 1024,
            mime_type: 'application/pdf',
            key: 'uploads/test-document.pdf',
            url: 'https://test-bucket.s3.amazonaws.com/uploads/test-document.pdf',
            organization_id: organizationId,
            uploaded_by: userId,
            created_at: new Date(),
          })
          .returning()

        attachmentId = attachment.id
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/attachments/${attachmentId!}/download`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('downloadUrl')
      expect(body.downloadUrl).toContain('signed=true')
    })

    it('deve retornar erro para anexo inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/attachments/${randomUUID()}/download`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Arrange - Cria anexo de outra organização
      const { user: otherUser, organizationId: otherOrgId } = await testAuth.createTestUser({
        email: 'other@example.com',
        password: 'password123',
      })

      let attachmentId: string
      if (testDb.db) {
        const [attachment] = await testDb.db
          .insert(attachments)
          .values({
            type: 'DOCUMENT',
            original_name: 'test-document.pdf',
            size: 1024,
            mime_type: 'application/pdf',
            key: 'uploads/test-document.pdf',
            url: 'https://test-bucket.s3.amazonaws.com/uploads/test-document.pdf',
            organization_id: otherOrgId,
            uploaded_by: otherUser.id,
            created_at: new Date(),
          })
          .returning()

        attachmentId = attachment.id
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/attachments/${attachmentId!}/download`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })
  })

  describe('DELETE /attachments/:attachmentId', () => {
    it('deve deletar anexo com sucesso', async () => {
      // Arrange - Cria um anexo
      let attachmentId: string
      if (testDb.db) {
        const [attachment] = await testDb.db
          .insert(attachments)
          .values({
            type: 'DOCUMENT',
            original_name: 'test-document.pdf',
            size: 1024,
            mime_type: 'application/pdf',
            key: 'uploads/test-document.pdf',
            url: 'https://test-bucket.s3.amazonaws.com/uploads/test-document.pdf',
            organization_id: organizationId,
            uploaded_by: userId,
            created_at: new Date(),
          })
          .returning()

        attachmentId = attachment.id
      }

      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/attachments/${attachmentId!}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
    })

    it('deve retornar erro para anexo inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/attachments/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Arrange - Cria anexo de outro usuário
      const { user: otherUser, organizationId: otherOrgId } = await testAuth.createTestUser({
        email: 'other@example.com',
        password: 'password123',
      })

      let attachmentId: string
      if (testDb.db) {
        const [attachment] = await testDb.db
          .insert(attachments)
          .values({
            type: 'DOCUMENT',
            original_name: 'test-document.pdf',
            size: 1024,
            mime_type: 'application/pdf',
            key: 'uploads/test-document.pdf',
            url: 'https://test-bucket.s3.amazonaws.com/uploads/test-document.pdf',
            organization_id: otherOrgId,
            uploaded_by: otherUser.id,
            created_at: new Date(),
          })
          .returning()

        attachmentId = attachment.id
      }

      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/attachments/${attachmentId!}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })
  })
})
