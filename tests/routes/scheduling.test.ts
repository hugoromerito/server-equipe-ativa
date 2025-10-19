import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  organizations,
  units,
  jobTitles,
  users,
  members,
  applicants,
} from '../../src/db/schema/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'
import { 
  createDemandRoute,
  updateDemandRoute,
  assignMemberToDemandRoute 
} from '../../src/http/routes/demands/index.ts'
import { getAvailableMembersRoute } from '../../src/http/routes/members/index.ts'

describe('Scheduling System Tests', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let organization: any
  let unit: any
  let member1: any
  let member2: any
  let applicant: any
  let authToken: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registrar as rotas necessárias
    await app.register(createDemandRoute)
    await app.register(updateDemandRoute)
    await app.register(assignMemberToDemandRoute)
    await app.register(getAvailableMembersRoute)
    await app.ready()

    // Criar usuário autenticado e organização
    const { user, organizationId } = await testAuth.createTestUser({
      name: 'Admin User',
      email: 'admin@exemplo.com'
    })
    authToken = testAuth.generateJwtToken(user.id, app)

    // Buscar organização criada
    if (!testDb.db) throw new Error('Database not initialized')
    const [org] = await testDb.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
    organization = org

    // Criar unidade através do banco de dados diretamente
    const [unitResult] = await testDb.db
      .insert(units)
      .values({
        name: 'Unidade Principal',
        slug: 'unidade-principal',
        organization_id: organization.id,
        owner_id: user.id,
        location: 'Localização Teste',
        created_at: new Date(),
      })
      .returning()
    unit = unitResult

    // Criar job title (importar se necessário)
    const { jobTitles } = await import('../../src/db/schema/index.ts')
    const [jobTitle] = await testDb.db
      .insert(jobTitles)
      .values({
        name: 'Psicólogo',
        organization_id: organization.id,
        unit_id: unit.id,
        created_at: new Date(),
      })
      .returning()

    // Criar usuários para os membros
    const { users } = await import('../../src/db/schema/index.ts')
    const [user1] = await testDb.db
      .insert(users)
      .values({
        name: 'Dr. João Silva',
        email: 'joao@exemplo.com',
        created_at: new Date(),
      })
      .returning()

    const [user2] = await testDb.db
      .insert(users)
      .values({
        name: 'Dra. Maria Santos',
        email: 'maria@exemplo.com',
        created_at: new Date(),
      })
      .returning()

    // Criar membro para o usuário principal (necessário para autorização)
    await testDb.db
      .insert(members)
      .values({
        user_id: user.id,
        organization_id: organization.id,
        unit_id: unit.id,
        job_title_id: jobTitle.id,
        organization_role: 'ADMIN',
        working_days: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'],
      })

    // Criar membros (profissionais)
    const [memberResult1] = await testDb.db
      .insert(members)
      .values({
        user_id: user1.id,
        organization_id: organization.id,
        unit_id: unit.id,
        job_title_id: jobTitle.id,
        organization_role: 'CLERK',
        working_days: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'], // Segunda a Sexta
      })
      .returning()
    member1 = memberResult1

    const [memberResult2] = await testDb.db
      .insert(members)
      .values({
        user_id: user2.id,
        organization_id: organization.id,
        unit_id: unit.id,
        job_title_id: jobTitle.id,
        organization_role: 'CLERK',
        working_days: ['SEGUNDA', 'QUARTA', 'SEXTA'], // Segunda, Quarta e Sexta
      })
      .returning()
    member2 = memberResult2

    // Criar solicitante
    const { applicants } = await import('../../src/db/schema/index.ts')
    const [applicantResult] = await testDb.db
      .insert(applicants)
      .values({
        name: 'João da Silva',
        phone: '11999999999',
        birthdate: '1990-01-01',
        cpf: '12345678901',
        organization_id: organization.id,
      })
      .returning()
    applicant = applicantResult
  })

  describe('Conflict Prevention', () => {
    it('should prevent double booking for the same member', async () => {
      const scheduledDate = '2025-10-20' // Segunda-feira
      const scheduledTime = '14:00'

      // Primeira demanda - deve funcionar
      const response1 = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.slug}/units/${unit.slug}/applicants/${applicant.id}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Consulta Psicológica',
          description: 'Atendimento psicológico de rotina',
          scheduledDate,
          scheduledTime,
          responsibleId: member1.id,
        },
      })

      expect(response1.statusCode).toBe(201)

      // Segunda demanda no mesmo horário - deve falhar
      const response2 = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.slug}/units/${unit.slug}/applicants/${applicant.id}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Outra Consulta',
          description: 'Outro atendimento',
          scheduledDate,
          scheduledTime,
          responsibleId: member1.id,
        },
      })

      expect(response2.statusCode).toBe(400)
      const errorResponse = response2.json()
      expect(errorResponse.message).toContain('já possui um agendamento neste horário')
    })

    it('should allow same time slot for different members', async () => {
      const scheduledDate = '2025-10-20' // Segunda-feira
      const scheduledTime = '14:00'

      // Primeira demanda com member1
      const response1 = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.slug}/units/${unit.slug}/applicants/${applicant.id}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Consulta Psicológica 1',
          description: 'Atendimento psicológico',
          scheduledDate,
          scheduledTime,
          responsibleId: member1.id,
        },
      })

      expect(response1.statusCode).toBe(201)

      // Segunda demanda com member2 no mesmo horário - deve funcionar
      const response2 = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.slug}/units/${unit.slug}/applicants/${applicant.id}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Consulta Psicológica 2',
          description: 'Outro atendimento psicológico',
          scheduledDate,
          scheduledTime,
          responsibleId: member2.id,
        },
      })

      expect(response2.statusCode).toBe(201)
    })

    it('should prevent booking on non-working days', async () => {
      const scheduledDate = '2025-10-21' // Terça-feira
      const scheduledTime = '14:00'

      // member2 não trabalha na terça-feira
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.slug}/units/${unit.slug}/applicants/${applicant.id}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Consulta Psicológica',
          description: 'Atendimento psicológico',
          scheduledDate,
          scheduledTime,
          responsibleId: member2.id,
        },
      })

      expect(response.statusCode).toBe(400)
      const errorResponse = response.json()
      expect(errorResponse.message).toContain('não trabalha neste dia da semana')
    })
  })

  describe('Assign Member to Demand', () => {
    it('should successfully assign member to existing demand', async () => {
      // Criar demanda sem agendamento
      const createResponse = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.slug}/units/${unit.slug}/applicants/${applicant.id}/demands`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Consulta Psicológica',
          description: 'Atendimento psicológico de rotina',
        },
      })

      expect(createResponse.statusCode).toBe(201)
      const { demandId } = createResponse.json()

      // Atribuir profissional
      const assignResponse = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organization.slug}/units/${unit.slug}/demands/${demandId}/assign`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          responsibleId: member1.id,
          scheduledDate: '2025-10-20',
          scheduledTime: '14:00',
        },
      })

      expect(assignResponse.statusCode).toBe(200)
      const response = assignResponse.json()
      expect(response.demand.responsible.name).toBe('Dr. João Silva')
      expect(response.demand.scheduledDate).toBe('2025-10-20')
      expect(response.demand.scheduledTime).toBe('14:00')
    })
  })
})