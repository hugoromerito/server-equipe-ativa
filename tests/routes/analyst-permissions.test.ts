import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applicants,
  demands,
  members,
  organizations,
  units,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  assignMemberToDemandRoute,
  getDemandRoute,
  getDemandsRoute,
} from '../../src/http/routes/demands/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('ANALYST Role Permissions - Security Tests', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  
  let organizationId: string
  let organizationSlug: string
  let unitId: string
  let unitSlug: string
  let applicantId: string

  // Médico 1 (Dr. João)
  let analyst1Id: string
  let analyst1Member: string
  let analyst1Token: string

  // Médico 2 (Dra. Maria)
  let analyst2Id: string
  let analyst2Member: string
  let analyst2Token: string

  // Recepcionista (para criar demands)
  let clerkId: string
  let clerkToken: string

  // Demands
  let demandAnalyst1Id: string // Demand atribuída ao Dr. João
  let demandAnalyst2Id: string // Demand atribuída à Dra. Maria

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registrar rotas
    await app.register(auth)
    await app.register(getDemandsRoute)
    await app.register(getDemandRoute)
    await app.register(assignMemberToDemandRoute)
    await app.ready()

    // Criar organizador/owner
    const { user: owner, organizationId: orgId } = await testAuth.createTestUser({
      password: 'password123',
    })

    organizationId = orgId
    organizationSlug = `clinic-${randomUUID()}`

    // Atualizar slug da organização
    if (testDb.db) {
      await testDb.db
        .update(organizations)
        .set({ slug: organizationSlug })
        .where(eq(organizations.id, organizationId))
    }

    // Criar unidade
    unitSlug = 'sede'
    if (testDb.db) {
      const [unit] = await testDb.db
        .insert(units)
        .values({
          name: 'Sede',
          slug: unitSlug,
          location: 'Centro',
          description: 'Unidade principal',
          organization_id: organizationId,
          owner_id: owner.id,
          created_at: new Date(),
        })
        .returning()
      unitId = unit.id
    }

    // Criar CLERK (Recepcionista)
    const clerkResult = await testAuth.createTestUser({
      password: 'clerk123',
    })
    clerkId = clerkResult.user.id
    clerkToken = testAuth.generateJwtToken(clerkId, app)

    if (testDb.db) {
      await testDb.db.insert(members).values({
        user_id: clerkId,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'BILLING',
        unit_role: 'CLERK',
      })
    }

    // Criar ANALYST 1 (Dr. João)
    const analyst1Result = await testAuth.createTestUser({
      password: 'analyst1',
    })
    analyst1Id = analyst1Result.user.id
    analyst1Token = testAuth.generateJwtToken(analyst1Id, app)

    if (testDb.db) {
      const [member1] = await testDb.db.insert(members).values({
        user_id: analyst1Id,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'BILLING',
        unit_role: 'ANALYST',
      }).returning()
      analyst1Member = member1.id
    }

    // Criar ANALYST 2 (Dra. Maria)
    const analyst2Result = await testAuth.createTestUser({
      password: 'analyst2',
    })
    analyst2Id = analyst2Result.user.id
    analyst2Token = testAuth.generateJwtToken(analyst2Id, app)

    if (testDb.db) {
      const [member2] = await testDb.db.insert(members).values({
        user_id: analyst2Id,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'BILLING',
        unit_role: 'ANALYST',
      }).returning()
      analyst2Member = member2.id
    }

    // Criar applicant
    if (testDb.db) {
      const [applicant] = await testDb.db
        .insert(applicants)
        .values({
          name: 'Paciente Teste',
          birthdate: '1990-01-01',
          cpf: '12345678901',
          phone: '11999999999',
          organization_id: organizationId,
          created_at: new Date(),
        })
        .returning()
      applicantId = applicant.id
    }

    // Criar demand atribuída ao ANALYST 1 (Dr. João)
    if (testDb.db) {
      const [demand1] = await testDb.db
        .insert(demands)
        .values({
          title: 'Consulta Paciente A',
          description: 'Consulta de rotina',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          category: 'PSYCHOLOGIST',
          unit_id: unitId,
          applicant_id: applicantId,
          owner_id: clerkId,
          responsible_id: analyst1Member,
          created_by_member_name: 'Recepcionista Teste',
          scheduled_date: '2025-10-25',
          scheduled_time: '14:00',
          created_at: new Date(),
        })
        .returning()
      demandAnalyst1Id = demand1.id
    }

    // Criar demand atribuída ao ANALYST 2 (Dra. Maria)
    if (testDb.db) {
      const [demand2] = await testDb.db
        .insert(demands)
        .values({
          title: 'Consulta Paciente B',
          description: 'Avaliação psicológica',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          category: 'PSYCHOLOGIST',
          unit_id: unitId,
          applicant_id: applicantId,
          owner_id: clerkId,
          responsible_id: analyst2Member,
          created_by_member_name: 'Recepcionista Teste',
          scheduled_date: '2025-10-25',
          scheduled_time: '15:00',
          created_at: new Date(),
        })
        .returning()
      demandAnalyst2Id = demand2.id
    }
  })

  describe('GET /demands - List Demands', () => {
    it('should ANALYST 1 (Dr. João) see only HIS demands', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands`,
        headers: {
          authorization: `Bearer ${analyst1Token}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      
      // Dr. João deve ver apenas 1 demand (a dele)
      expect(body.demands).toHaveLength(1)
      expect(body.demands[0].id).toBe(demandAnalyst1Id)
      expect(body.demands[0].title).toBe('Consulta Paciente A')
      expect(body.demands[0].responsible_id).toBe(analyst1Member)
    })

    it('should ANALYST 2 (Dra. Maria) see only HER demands', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands`,
        headers: {
          authorization: `Bearer ${analyst2Token}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      
      // Dra. Maria deve ver apenas 1 demand (a dela)
      expect(body.demands).toHaveLength(1)
      expect(body.demands[0].id).toBe(demandAnalyst2Id)
      expect(body.demands[0].title).toBe('Consulta Paciente B')
      expect(body.demands[0].responsible_id).toBe(analyst2Member)
    })

    it('should CLERK see ALL demands from unit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands`,
        headers: {
          authorization: `Bearer ${clerkToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      
      // Recepcionista deve ver ambas demands
      expect(body.demands.length).toBeGreaterThanOrEqual(2)
      const demandIds = body.demands.map((d: any) => d.id)
      expect(demandIds).toContain(demandAnalyst1Id)
      expect(demandIds).toContain(demandAnalyst2Id)
    })
  })

  describe('GET /demands/:id - Get Specific Demand', () => {
    it('should ANALYST 1 access HIS OWN demand successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst1Id}`,
        headers: {
          authorization: `Bearer ${analyst1Token}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      
      expect(body.demand.id).toBe(demandAnalyst1Id)
      expect(body.demand.title).toBe('Consulta Paciente A')
    })

    it('should ANALYST 1 NOT access ANALYST 2 demand (401)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst2Id}`,
        headers: {
          authorization: `Bearer ${analyst1Token}`,
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      
      expect(body.message).toContain('Você só pode visualizar suas próprias demandas')
    })

    it('should ANALYST 2 NOT access ANALYST 1 demand (401)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst1Id}`,
        headers: {
          authorization: `Bearer ${analyst2Token}`,
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      
      expect(body.message).toContain('Você só pode visualizar suas próprias demandas')
    })

    it('should CLERK access ANY demand successfully', async () => {
      // Acessar demand do ANALYST 1
      const response1 = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst1Id}`,
        headers: {
          authorization: `Bearer ${clerkToken}`,
        },
      })

      expect(response1.statusCode).toBe(200)

      // Acessar demand do ANALYST 2
      const response2 = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst2Id}`,
        headers: {
          authorization: `Bearer ${clerkToken}`,
        },
      })

      expect(response2.statusCode).toBe(200)
    })
  })

  describe('PATCH /demands/:id/assign - Assign Member', () => {
    it('should ANALYST 1 reassign HIS OWN demand successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst1Id}/assign`,
        headers: {
          authorization: `Bearer ${analyst1Token}`,
        },
        payload: {
          responsibleId: analyst1Member,
          scheduledDate: '2025-10-26',
          scheduledTime: '10:00',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      
      expect(body.demand.id).toBe(demandAnalyst1Id)
      expect(body.demand.scheduledDate).toBe('2025-10-26')
    })

    it('should ANALYST 1 NOT reassign ANALYST 2 demand (401)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst2Id}/assign`,
        headers: {
          authorization: `Bearer ${analyst1Token}`,
        },
        payload: {
          responsibleId: analyst1Member,
          scheduledDate: '2025-10-26',
          scheduledTime: '11:00',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      
      expect(body.message).toContain('Você só pode gerenciar suas próprias demandas')
    })

    it('should CLERK reassign ANY demand successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/demands/${demandAnalyst2Id}/assign`,
        headers: {
          authorization: `Bearer ${clerkToken}`,
        },
        payload: {
          responsibleId: analyst1Member,
          scheduledDate: '2025-10-27',
          scheduledTime: '14:00',
        },
      })

      expect(response.statusCode).toBe(200)
    })
  })
})
