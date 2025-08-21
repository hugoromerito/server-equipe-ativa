import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applicants,
  members,
  organizations,
  units,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import { createDemandRoute } from '../../src/http/routes/demands/create-demand.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

// Mock do serviço de classificação de IA
vi.mock('../../src/http/utils/classify-demand-ai.ts', () => ({
  classifyDemandAi: vi.fn().mockResolvedValue({
    priority: 'HIGH',
    category: 'SOCIAL_ASSISTANCE'
  })
}))

describe('Demands Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let authToken: string
  let organizationId: string
  let organizationSlug: string
  let unitId: string
  let unitSlug: string
  let applicantId: string
  let userId: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e a rota
    await app.register(auth)
    await app.register(createDemandRoute)
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
    unitSlug = `test-unit-${randomUUID()}`
    if (testDb.db) {
      const [unit] = await testDb.db
        .insert(units)
        .values({
          name: 'Test Unit',
          slug: unitSlug,
          location: 'Test Location',
          description: 'Test unit description',
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
          birthdate: new Date('1990-01-01').toISOString(), // Convertendo para string
          cpf: '12345678901',
          phone: '+5511999999999',
          mother: 'john@example.com',
          father: 'john@example.com',
          ticket: 'john@example.com',
          observation: 'john@example.com',
          organization_id: organizationId,
          created_at: new Date(),
        })
        .returning()

      applicantId = applicant.id
    }

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('POST /organizations/:organizationSlug/units/:unitSlug/applicants/:applicantSlug/demands', () => {
    it('should create demand successfully', async () => {
      // Arrange
      const demandData = {
        title: 'Solicitar auxílio moradia',
        description:
          'Preciso de ajuda para pagar o aluguel este mês devido a dificuldades financeiras',
        zip_code: '01234-567',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua das Flores',
        neighborhood: 'Centro',
        complement: 'Apt 123',
        number: '456',
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/applicants/${applicantId}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: demandData,
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demandId')
      expect(typeof body.demandId).toBe('string')
    })

    it('should require authentication', async () => {
      // Arrange
      const demandData = {
        title: 'Test demand',
        description: 'Test description',
        zip_code: null,
        state: null,
        city: null,
        street: null,
        neighborhood: null,
        complement: null,
        number: null,
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/applicants/${applicantId}/demands`,
        payload: demandData,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('should validate required fields', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/applicants/${applicantId}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          // Missing required fields
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('should return error for non-existent organization', async () => {
      // Arrange
      const demandData = {
        title: 'Test demand',
        description: 'Test description',
        zip_code: null,
        state: null,
        city: null,
        street: null,
        neighborhood: null,
        complement: null,
        number: null,
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/non-existent/units/${unitSlug}/applicants/${applicantId}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: demandData,
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Organização não encontrada')
    })

    it('should return error for non-existent unit', async () => {
      // Arrange
      const demandData = {
        title: 'Test demand',
        description: 'Test description',
        zip_code: null,
        state: null,
        city: null,
        street: null,
        neighborhood: null,
        complement: null,
        number: null,
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units/non-existent/applicants/${applicantId}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: demandData,
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Unidade não encontrada')
    })

    it('should return error for non-existent applicant', async () => {
      // Arrange
      const demandData = {
        title: 'Test demand',
        description: 'Test description',
        zip_code: null,
        state: null,
        city: null,
        street: null,
        neighborhood: null,
        complement: null,
        number: null,
      }

      const nonExistentApplicantId = randomUUID()

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/applicants/${nonExistentApplicantId}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: demandData,
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Solicitante não encontrado')
    })
  })
})
