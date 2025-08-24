import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applicants,
  members,
  organizations,
  units,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  createApplicantRoute,
  getApplicantDemandsRoute,
  getApplicantRoute,
  getApplicantsRoute,
  getCheckApplicantRoute,
} from '../../src/http/routes/applicants/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Applicants Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let authToken: string
  let organizationId: string
  let organizationSlug: string
  let unitId: string
  let unitSlug: string
  let userId: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(createApplicantRoute)
    await app.register(getApplicantRoute)
    await app.register(getApplicantDemandsRoute)
    await app.register(getApplicantsRoute)
    await app.register(getCheckApplicantRoute)
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

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('POST /organizations/:organizationSlug/applicants', () => {
    it('deve criar um solicitante com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/applicants`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'João Silva',
          birthdate: '1990-01-01',
          cpf: '11144477735', // CPF válido
          phone: '11999999999',
          mother: 'Maria Silva',
          father: 'José Silva',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('applicantId')
    })

    it('deve retornar erro para dados inválidos', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/applicants`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: '', // Nome inválido
          cpf: 'invalid-cpf', // CPF inválido
          birthdate: '1990-01-01', // Incluindo data válida para focar no erro de nome e CPF
          phone: '11999999999', // Incluindo telefone válido
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/nonexistent-org/applicants`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'João Silva',
          birthdate: '1990-01-01',
          cpf: '11144477735',
          phone: '11999999999',
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /organizations/:organizationSlug/applicant/:applicantSlug', () => {
    it('deve retornar um solicitante específico', async () => {
      // Arrange
      let applicantId = ''
      if (testDb.db) {
        const [applicant] = await testDb.db
          .insert(applicants)
          .values({
            name: 'João Silva',
            phone: '11999999999',
            birthdate: '1990-01-01',
            cpf: '11144477735',
            mother: 'Maria Silva',
            father: 'José Silva',
            organization_id: organizationId,
            created_at: new Date(),
          })
          .returning()
        applicantId = applicant.id
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/applicant/${applicantId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('applicant')
      expect(body.applicant.name).toBe('João Silva')
    })

    it('deve retornar erro para solicitante inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/applicant/12345678-1234-1234-1234-123456789012`, // UUID válido mas inexistente
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /organizations/:organizationSlug/applicants', () => {
    it('deve retornar lista de solicitantes', async () => {
      // Arrange
      if (testDb.db) {
        await testDb.db.insert(applicants).values([
          {
            name: 'João Silva',
            phone: '11999999999',
            birthdate: '1990-01-01',
            cpf: '11144477735',
            mother: 'Maria Silva',
            father: 'José Silva',
            organization_id: organizationId,
            created_at: new Date(),
          },
          {
            name: 'Maria Santos',
            phone: '11888888888',
            birthdate: '1985-05-15',
            cpf: '85214796077',
            mother: 'Ana Santos',
            father: 'Carlos Santos',
            organization_id: organizationId,
            created_at: new Date(),
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/applicants`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('applicants')
      expect(Array.isArray(body.applicants)).toBe(true)
      expect(body.applicants).toHaveLength(2)
    })

    it('deve retornar lista vazia quando não há solicitantes', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/applicants`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('applicants')
      expect(Array.isArray(body.applicants)).toBe(true)
      expect(body.applicants).toHaveLength(0)
    })
  })

  describe('GET /organizations/:organizationSlug/applicant/:applicantSlug/demands', () => {
    it('deve retornar demandas do solicitante', async () => {
      // Arrange
      let applicantId = ''
      if (testDb.db) {
        const [applicant] = await testDb.db
          .insert(applicants)
          .values({
            name: 'João Silva',
            phone: '11999999999',
            birthdate: '1990-01-01',
            cpf: '11144477735',
            mother: 'Maria Silva',
            father: 'José Silva',
            organization_id: organizationId,
            created_at: new Date(),
          })
          .returning()
        applicantId = applicant.id
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/applicant/${applicantId}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demands')
      expect(Array.isArray(body.demands)).toBe(true)
    })
  })

  describe('GET /organizations/:organizationSlug/applicant', () => {
    it('deve verificar se solicitante existe por CPF', async () => {
      // Arrange
      if (testDb.db) {
        await testDb.db.insert(applicants).values({
          name: 'João Silva',
          phone: '11999999999',
          birthdate: '1990-01-01',
          cpf: '11144477735',
          mother: 'Maria Silva',
          father: 'José Silva',
          organization_id: organizationId,
          created_at: new Date(),
        })
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/applicant?cpf=11144477735`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('exists')
      expect(body.exists).toBe(true)
    })

    it('deve retornar false para CPF não cadastrado', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/applicant?cpf=98765432100`, // CPF válido mas não cadastrado
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('exists')
      expect(body.exists).toBe(false)
    })
  })
})
