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
  createDemandRoute,
  getDemandRoute,
  getDemandsRoute,
  updateDemandRoute,
} from '../../src/http/routes/demands/index.ts'
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

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(createDemandRoute)
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

      // Cria membership para o usuário - MANAGER pode criar, role organization ADMIN pode tudo
      await testDb.db.insert(members).values({
        user_id: userId,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'ADMIN', // ADMIN pode tudo
        unit_role: 'MANAGER', // MANAGER pode criar demandas
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

  // describe('GET /organizations/:organizationSlug/units/:unitSlug/demands/:demandId', () => {
  //   it('deve retornar uma demanda específica', async () => {
  //     // Arrange - Cria uma demanda primeiro
  //     let demandId: string | undefined
  //     if (testDb.db) {
  //       const [demand] = await testDb.db
  //         .insert(demands)
  //         .values({
  //           title: 'Demanda de Teste',
  //           description: 'Descrição da demanda',
  //           category: 'SOCIAL_ASSISTANCE',
  //           priority: 'HIGH',
  //           status: 'PENDING',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by_member_name: 'Test User',
  //           created_at: new Date(),
  //         })
  //         .returning()

  //       demandId = demand.id
  //     }

  //     if (!demandId) {
  //       throw new Error('Failed to create demand for test')
  //     }

  //     // Act
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId}`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(200)
  //     const body = JSON.parse(response.body)
  //     expect(body).toHaveProperty('demand')
  //     expect(body.demand.title).toBe('Demanda de Teste')
  //     expect(body.demand.category).toBe('SOCIAL_ASSISTANCE')
  //   })

  //   it('deve retornar erro para demanda inexistente', async () => {
  //     // Act
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${randomUUID()}`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(404)
  //   })

  //   it('deve retornar erro para organização inexistente', async () => {
  //     // Act
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: `/organizations/non-existent/units/${unitSlug}/demands/${randomUUID()}`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(400)
  //   })
  // })

  // describe('GET /organizations/:organizationSlug/units/:unitSlug/demands', () => {
  //   it('deve retornar lista de demandas da unidade', async () => {
  //     // Arrange - Cria algumas demandas
  //     if (testDb.db) {
  //       await testDb.db.insert(demands).values([
  //         {
  //           title: 'Primeira Demanda',
  //           description: 'Primeira descrição',
  //           category: 'SOCIAL_ASSISTANCE',
  //           priority: 'HIGH',
  //           status: 'PENDING',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         },
  //         {
  //           title: 'Segunda Demanda',
  //           description: 'Segunda descrição',
  //           category: 'HEALTH',
  //           priority: 'MEDIUM',
  //           status: 'IN_PROGRESS',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         },
  //       ])
  //     }

  //     // Act
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(200)
  //     const body = JSON.parse(response.body)
  //     expect(body).toHaveProperty('demands')
  //     expect(body.demands).toHaveLength(2)
  //   })

  //   it('deve permitir filtrar demandas por status', async () => {
  //     // Arrange - Cria demandas com diferentes status
  //     if (testDb.db) {
  //       await testDb.db.insert(demands).values([
  //         {
  //           title: 'Demanda Aberta',
  //           description: 'Descrição',
  //           category: 'SOCIAL_ASSISTANCE',
  //           priority: 'HIGH',
  //           status: 'OPEN',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         },
  //         {
  //           title: 'Demanda Fechada',
  //           description: 'Descrição',
  //           category: 'HEALTH',
  //           priority: 'MEDIUM',
  //           status: 'CLOSED',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         },
  //       ])
  //     }

  //     // Act
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands?status=OPEN`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(200)
  //     const body = JSON.parse(response.body)
  //     expect(body).toHaveProperty('demands')
  //     expect(body.demands).toHaveLength(1)
  //     expect(body.demands[0].status).toBe('OPEN')
  //   })

  //   it('deve permitir paginação', async () => {
  //     // Arrange - Cria várias demandas
  //     if (testDb.db) {
  //       for (let i = 0; i < 10; i++) {
  //         await testDb.db.insert(demands).values({
  //           title: `Demanda ${i}`,
  //           description: `Descrição ${i}`,
  //           category: 'SOCIAL_ASSISTANCE',
  //           priority: 'MEDIUM',
  //           status: 'OPEN',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         })
  //       }
  //     }

  //     // Act
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands?page=1&limit=5`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(200)
  //     const body = JSON.parse(response.body)
  //     expect(body).toHaveProperty('demands')
  //     expect(body.demands.length).toBeLessThanOrEqual(5)
  //     expect(body).toHaveProperty('totalCount')
  //   })
  // })

  // describe('PUT /organizations/:organizationSlug/units/:unitSlug/demands/:demandId', () => {
  //   it('deve atualizar uma demanda com sucesso', async () => {
  //     // Arrange - Cria uma demanda primeiro
  //     let demandId: string
  //     if (testDb.db) {
  //       const [demand] = await testDb.db
  //         .insert(demands)
  //         .values({
  //           title: 'Título Original',
  //           description: 'Descrição original',
  //           category: 'SOCIAL_ASSISTANCE',
  //           priority: 'LOW',
  //           status: 'OPEN',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         })
  //         .returning()

  //       demandId = demand.id
  //     }

  //     // Act
  //     const response = await app.inject({
  //       method: 'PUT',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId}`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //       payload: {
  //         title: 'Título Atualizado',
  //         description: 'Descrição atualizada',
  //         priority: 'HIGH',
  //         status: 'IN_PROGRESS',
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(200)
  //     const body = JSON.parse(response.body)
  //     expect(body).toHaveProperty('demand')
  //     expect(body.demand.title).toBe('Título Atualizado')
  //     expect(body.demand.priority).toBe('HIGH')
  //     expect(body.demand.status).toBe('IN_PROGRESS')
  //   })

  //   it('deve retornar erro para demanda inexistente', async () => {
  //     // Act
  //     const response = await app.inject({
  //       method: 'PUT',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${randomUUID()}`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //       payload: {
  //         title: 'Título Atualizado',
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(404)
  //   })

  //   it('deve retornar erro para dados inválidos', async () => {
  //     // Arrange - Cria uma demanda primeiro
  //     let demandId: string
  //     if (testDb.db) {
  //       const [demand] = await testDb.db
  //         .insert(demands)
  //         .values({
  //           title: 'Título Original',
  //           description: 'Descrição original',
  //           category: 'SOCIAL_ASSISTANCE',
  //           priority: 'LOW',
  //           status: 'OPEN',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         })
  //         .returning()

  //       demandId = demand.id
  //     }

  //     // Act
  //     const response = await app.inject({
  //       method: 'PUT',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId}`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //       payload: {
  //         priority: 'INVALID_PRIORITY',
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(400)
  //   })

  //   it('deve permitir atualização parcial', async () => {
  //     // Arrange - Cria uma demanda primeiro
  //     let demandId: string
  //     if (testDb.db) {
  //       const [demand] = await testDb.db
  //         .insert(demands)
  //         .values({
  //           title: 'Título Original',
  //           description: 'Descrição original',
  //           category: 'SOCIAL_ASSISTANCE',
  //           priority: 'LOW',
  //           status: 'OPEN',
  //           applicant_id: applicantId,
  //           unit_id: unitId,
  //           created_by: userId,
  //           created_at: new Date(),
  //         })
  //         .returning()

  //       demandId = demand.id
  //     }

  //     // Act - Atualiza apenas o status
  //     const response = await app.inject({
  //       method: 'PUT',
  //       url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId}`,
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //       payload: {
  //         status: 'CLOSED',
  //       },
  //     })

  //     // Assert
  //     expect(response.statusCode).toBe(200)
  //     const body = JSON.parse(response.body)
  //     expect(body).toHaveProperty('demand')
  //     expect(body.demand.status).toBe('CLOSED')
  //     expect(body.demand.title).toBe('Título Original') // Mantém o título original
  //   })
  // })

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
            category: 'SOCIAL_ASSISTANCE',
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
      expect(body.demand.category).toBe('SOCIAL_ASSISTANCE')
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

  describe('GET /organizations/:organizationSlug/units/:unitSlug/demands com filtros', () => {
    it('deve retornar lista de demandas da unidade', async () => {
      // Arrange - Cria algumas demandas
      if (testDb.db) {
        await testDb.db.insert(demands).values([
          {
            title: 'Primeira Demanda',
            description: 'Primeira descrição',
            category: 'SOCIAL_ASSISTANCE',
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
            category: 'HEALTH',
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
            category: 'SOCIAL_ASSISTANCE',
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
            category: 'HEALTH',
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
    it('deve atualizar uma demanda com sucesso usando PATCH', async () => {
      // Arrange - Cria uma demanda primeiro
      let demandId: string
      if (testDb.db) {
        const [demand] = await testDb.db
          .insert(demands)
          .values({
            title: 'Título Original',
            description: 'Descrição original',
            category: 'SOCIAL_ASSISTANCE',
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

    it('deve retornar erro para demanda inexistente no PATCH', async () => {
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

    it('deve permitir atualização parcial com PATCH', async () => {
      // Arrange - Cria uma demanda primeiro
      let demandId: string
      if (testDb.db) {
        const [demand] = await testDb.db
          .insert(demands)
          .values({
            title: 'Título Original',
            description: 'Descrição original',
            category: 'SOCIAL_ASSISTANCE',
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

      // Act - Atualiza apenas o status
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandId!}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'RESOLVED',
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('demand')
      expect(body.demand.status).toBe('RESOLVED')
      expect(body.demand.title).toBe('Título Original') // Mantém o título original
    })
  })
})
