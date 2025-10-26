import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applicants,
  demands,
  members,
  organizations,
  units,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  getDemandRoute,
  getDemandsRoute,
  updateDemandRoute,
} from '../../src/http/routes/demands/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Additional Demands Routes', () => {
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

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(getDemandRoute)
    await app.register(getDemandsRoute)
    await app.register(updateDemandRoute)
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
        unit_role: 'ADMIN', // ADMIN tem permissão total
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

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('GET /organizations/:organizationSlug/units/:unitSlug/demands/:demandId', () => {
    it('deve retornar uma demanda específica', async () => {
      // Arrange - Cria uma demanda primeiro
      let demandId: string
      if (testDb.db) {
        const [demand] = await testDb.db
          .insert(demands)
          .values({
            title: 'Demanda de Teste',
            description: 'Descrição da demanda',
            category: 'SOCIAL_WORKER',
            priority: 'HIGH',
            status: 'PENDING',
            applicant_id: applicantId,
            unit_id: unitId,
            created_by_member_name: 'Test User',
            created_at: new Date(),
          })
          .returning()

        demandId = demand.id
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId!}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demand')
      expect(body.demand.title).toBe('Demanda de Teste')
      expect(body.demand.category).toBe('SOCIAL_WORKER')
    })

    it('deve retornar erro para demanda inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /organizations/:organizationSlug/units/:unitSlug/demands', () => {
    it('deve retornar lista de demandas da unidade', async () => {
      // Arrange - Cria algumas demandas
      if (testDb.db) {
        await testDb.db.insert(demands).values([
          {
            title: 'Primeira Demanda',
            description: 'Primeira descrição',
            category: 'SOCIAL_WORKER',
            priority: 'HIGH',
            status: 'PENDING',
            applicant_id: applicantId,
            unit_id: unitId,
            created_by_member_name: 'Test User',
            created_at: new Date(),
          },
          {
            title: 'Segunda Demanda',
            description: 'Segunda descrição',
            category: 'NUTRITIONIST',
            priority: 'MEDIUM',
            status: 'IN_PROGRESS',
            applicant_id: applicantId,
            unit_id: unitId,
            created_by_member_name: 'Test User',
            created_at: new Date(),
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demands')
      expect(body.demands).toHaveLength(2)
    })

    it('deve permitir filtrar demandas por status', async () => {
      // Arrange - Cria demandas com diferentes status
      if (testDb.db) {
        await testDb.db.insert(demands).values([
          {
            title: 'Demanda Pendente',
            description: 'Descrição',
            category: 'SOCIAL_WORKER',
            priority: 'HIGH',
            status: 'PENDING',
            applicant_id: applicantId,
            unit_id: unitId,
            created_by_member_name: 'Test User',
            created_at: new Date(),
          },
          {
            title: 'Demanda Resolvida',
            description: 'Descrição',
            category: 'NUTRITIONIST',
            priority: 'MEDIUM',
            status: 'RESOLVED',
            applicant_id: applicantId,
            unit_id: unitId,
            created_by_member_name: 'Test User',
            created_at: new Date(),
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands?status=PENDING`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demands')
      expect(body.demands).toHaveLength(1)
      expect(body.demands[0].status).toBe('PENDING')
    })
  })

  describe('PATCH /organizations/:organizationSlug/units/:unitSlug/demands/:demandId', () => {
    it('deve atualizar uma demanda com sucesso', async () => {
      // Arrange - Cria uma demanda primeiro
      let demandId: string
      if (testDb.db) {
        const [demand] = await testDb.db
          .insert(demands)
          .values({
            title: 'Título Original',
            description: 'Descrição original',
            category: 'SOCIAL_WORKER',
            priority: 'LOW',
            status: 'PENDING',
            applicant_id: applicantId,
            unit_id: unitId,
            created_by_member_name: 'Test User',
            created_at: new Date(),
          })
          .returning()

        demandId = demand.id
      }

      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId!}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Título Atualizado',
          description: 'Descrição atualizada',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demand')
      expect(body.demand.title).toBe('Título Atualizado')
      expect(body.demand.priority).toBe('HIGH')
      expect(body.demand.status).toBe('IN_PROGRESS')
    })

    it('deve retornar erro para demanda inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Título Atualizado',
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve permitir atualização parcial', async () => {
      // Arrange - Cria uma demanda primeiro
      let demandId: string
      if (testDb.db) {
        const [demand] = await testDb.db
          .insert(demands)
          .values({
            title: 'Título Original',
            description: 'Descrição original',
            category: 'SOCIAL_WORKER',
            priority: 'LOW',
            status: 'PENDING',
            applicant_id: applicantId,
            unit_id: unitId,
            created_by_member_name: 'Test User',
            created_at: new Date(),
          })
          .returning()

        demandId = demand.id
      }

      // Act - Atualiza apenas o status (PENDING -> IN_PROGRESS é uma transição válida)
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId!}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'IN_PROGRESS',
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demand')
      expect(body.demand.status).toBe('IN_PROGRESS')
      expect(body.demand.title).toBe('Título Original') // Mantém o título original
    })
  })
})
