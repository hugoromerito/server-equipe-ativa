import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  jobTitles,
  members,
  organizations,
  units,
  users,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  createJobTitleRoute,
  deleteJobTitleRoute,
  getJobTitleRoute,
  getJobTitlesRoute,
  updateJobTitleRoute,
} from '../../src/http/routes/job-titles/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Job Titles Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let authToken: string
  let organizationId: string
  let organizationSlug: string
  let userId: string
  let unitId: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(createJobTitleRoute)
    await app.register(getJobTitleRoute)
    await app.register(getJobTitlesRoute)
    await app.register(updateJobTitleRoute)
    await app.register(deleteJobTitleRoute)
    await app.ready()

    // Cria usuário de teste
    const { user, organizationId: orgId } = await testAuth.createTestUser({
      email: 'admin@example.com',
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

      // Cria membership ADMIN para o usuário
      await testDb.db.insert(members).values({
        user_id: userId,
        organization_id: organizationId,
        organization_role: 'ADMIN',
      })

      // Cria uma unidade para testes
      const [unit] = await testDb.db
        .insert(units)
        .values({
          name: 'Unidade Teste',
          slug: `unit-test-${randomUUID()}`,
          location: 'São Paulo, SP',
          organization_id: organizationId,
          owner_id: userId,
        })
        .returning()

      unitId = unit.id
    }

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('POST /organizations/:organizationSlug/job-titles', () => {
    it('deve criar um cargo/função com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Assistente Social',
          description: 'Responsável por atendimento social',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('jobTitleId')
      expect(body).toHaveProperty('jobTitle')
      expect(body.jobTitle.name).toBe('Assistente Social')
      expect(body.jobTitle.description).toBe('Responsável por atendimento social')
      expect(body.jobTitle.unitId).toBeNull()
    })

    it('deve criar um cargo/função vinculado a uma unidade', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Psicólogo',
          description: 'Atendimento psicológico',
          unit_id: unitId,
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.jobTitle.name).toBe('Psicólogo')
      expect(body.jobTitle.unitId).toBe(unitId)
    })

    it('deve criar um cargo sem descrição', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Terapeuta Ocupacional',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.jobTitle.name).toBe('Terapeuta Ocupacional')
      expect(body.jobTitle.description).toBeNull()
    })

    it('deve retornar erro para nome muito curto', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'A',
          description: 'Descrição válida',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para nome muito longo', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'A'.repeat(101),
          description: 'Descrição válida',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Criar usuário CLERK (sem permissão para gerenciar cargos)
      if (testDb.db) {
        const [clerkUser] = await testDb.db
          .insert(users)
          .values({
            email: 'clerk@example.com',
            name: 'Clerk User',
            password_hash: 'hash',
          })
          .returning()

        await testDb.db.insert(members).values({
          user_id: clerkUser.id,
          organization_id: organizationId,
          organization_role: 'CLERK',
        })

        const clerkToken = testAuth.generateJwtToken(clerkUser.id, app)

        // Act
        const response = await app.inject({
          method: 'POST',
          url: `/organizations/${organizationSlug}/job-titles`,
          headers: {
            authorization: `Bearer ${clerkToken}`,
          },
          payload: {
            name: 'Cargo Teste',
          },
        })

        // Assert
        expect(response.statusCode).toBe(401)
      }
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/job-titles`,
        payload: {
          name: 'Cargo Teste',
        },
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/organizations/org-inexistente/job-titles',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Cargo Teste',
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /organizations/:organizationSlug/job-titles', () => {
    beforeEach(async () => {
      // Criar alguns cargos para testar listagem
      if (testDb.db) {
        await testDb.db.insert(jobTitles).values([
          {
            name: 'Assistente Social',
            description: 'Atendimento social',
            organization_id: organizationId,
            unit_id: null,
          },
          {
            name: 'Psicólogo',
            description: 'Atendimento psicológico',
            organization_id: organizationId,
            unit_id: null,
          },
          {
            name: 'Fisioterapeuta',
            description: 'Atendimento fisioterapêutico',
            organization_id: organizationId,
            unit_id: unitId,
          },
        ])
      }
    })

    it('deve listar todos os cargos gerais da organização', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('jobTitles')
      expect(body).toHaveProperty('pagination')
      expect(body.jobTitles).toHaveLength(2) // Apenas cargos gerais (sem unit_id)
      expect(body.pagination.total).toBe(2)
    })

    it('deve listar cargos de uma unidade específica', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles?unit_id=${unitId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.jobTitles).toHaveLength(1)
      expect(body.jobTitles[0].name).toBe('Fisioterapeuta')
      expect(body.jobTitles[0].unitId).toBe(unitId)
    })

    it('deve retornar paginação correta', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles?page=1&limit=1`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.jobTitles).toHaveLength(1)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(1)
      expect(body.pagination.total).toBe(2)
      expect(body.pagination.totalPages).toBe(2)
    })

    it('deve retornar lista vazia quando não há cargos', async () => {
      // Limpar todos os cargos
      if (testDb.db) {
        await testDb.db
          .delete(jobTitles)
          .where(eq(jobTitles.organization_id, organizationId))
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.jobTitles).toHaveLength(0)
      expect(body.pagination.total).toBe(0)
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles`,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('deve ordenar cargos por nome alfabético', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.jobTitles[0].name).toBe('Assistente Social')
      expect(body.jobTitles[1].name).toBe('Psicólogo')
    })
  })

  describe('GET /organizations/:organizationSlug/job-titles/:jobTitleId', () => {
    let jobTitleId: string

    beforeEach(async () => {
      // Criar um cargo para testes
      if (testDb.db) {
        const [jobTitle] = await testDb.db
          .insert(jobTitles)
          .values({
            name: 'Terapeuta Ocupacional',
            description: 'Reabilitação funcional',
            organization_id: organizationId,
            unit_id: null,
          })
          .returning()

        jobTitleId = jobTitle.id
      }
    })

    it('deve buscar um cargo específico com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('jobTitle')
      expect(body.jobTitle.id).toBe(jobTitleId)
      expect(body.jobTitle.name).toBe('Terapeuta Ocupacional')
      expect(body.jobTitle.description).toBe('Reabilitação funcional')
    })

    it('deve retornar erro para cargo inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para ID inválido', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles/invalid-id`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })

  describe('PATCH /organizations/:organizationSlug/job-titles/:jobTitleId', () => {
    let jobTitleId: string

    beforeEach(async () => {
      // Criar um cargo para testes
      if (testDb.db) {
        const [jobTitle] = await testDb.db
          .insert(jobTitles)
          .values({
            name: 'Fonoaudiólogo',
            description: 'Descrição original',
            organization_id: organizationId,
            unit_id: null,
          })
          .returning()

        jobTitleId = jobTitle.id
      }
    })

    it('deve atualizar nome do cargo', async () => {
      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Fonoaudiólogo Sênior',
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.jobTitle.name).toBe('Fonoaudiólogo Sênior')
      expect(body.jobTitle.description).toBe('Descrição original')
      expect(body.jobTitle.updatedAt).not.toBeNull()
    })

    it('deve atualizar descrição do cargo', async () => {
      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          description: 'Nova descrição atualizada',
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.jobTitle.name).toBe('Fonoaudiólogo')
      expect(body.jobTitle.description).toBe('Nova descrição atualizada')
    })

    it('deve atualizar nome e descrição juntos', async () => {
      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Fonoaudiólogo Pleno',
          description: 'Atendimento intermediário',
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.jobTitle.name).toBe('Fonoaudiólogo Pleno')
      expect(body.jobTitle.description).toBe('Atendimento intermediário')
    })

    it('deve retornar erro para cargo inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/job-titles/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Novo Nome',
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para nome muito curto', async () => {
      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'A',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Criar usuário CLERK
      if (testDb.db) {
        const [clerkUser] = await testDb.db
          .insert(users)
          .values({
            email: 'clerk2@example.com',
            name: 'Clerk User 2',
            password_hash: 'hash',
          })
          .returning()

        await testDb.db.insert(members).values({
          user_id: clerkUser.id,
          organization_id: organizationId,
          organization_role: 'CLERK',
        })

        const clerkToken = testAuth.generateJwtToken(clerkUser.id, app)

        // Act
        const response = await app.inject({
          method: 'PATCH',
          url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
          headers: {
            authorization: `Bearer ${clerkToken}`,
          },
          payload: {
            name: 'Novo Nome',
          },
        })

        // Assert
        expect(response.statusCode).toBe(401)
      }
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'PATCH',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        payload: {
          name: 'Novo Nome',
        },
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })

  describe('DELETE /organizations/:organizationSlug/job-titles/:jobTitleId', () => {
    let jobTitleId: string
    let memberId: string

    beforeEach(async () => {
      // Criar um cargo e um membro com esse cargo
      if (testDb.db) {
        const [jobTitle] = await testDb.db
          .insert(jobTitles)
          .values({
            name: 'Nutricionista',
            description: 'Acompanhamento nutricional',
            organization_id: organizationId,
            unit_id: null,
          })
          .returning()

        jobTitleId = jobTitle.id

        // Criar um membro com este cargo
        const [member] = await testDb.db
          .insert(members)
          .values({
            user_id: userId,
            organization_id: organizationId,
            organization_role: 'ANALYST',
            job_title_id: jobTitleId,
          })
          .returning()

        memberId = member.id
      }
    })

    it('deve deletar um cargo com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(204)

      // Verificar que o cargo foi deletado
      if (testDb.db) {
        const [deletedJobTitle] = await testDb.db
          .select()
          .from(jobTitles)
          .where(eq(jobTitles.id, jobTitleId))

        expect(deletedJobTitle).toBeUndefined()
      }
    })

    it('deve definir job_title_id como null nos membros ao deletar cargo', async () => {
      // Act
      await app.inject({
        method: 'DELETE',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      if (testDb.db) {
        const [member] = await testDb.db
          .select()
          .from(members)
          .where(eq(members.id, memberId))

        expect(member.job_title_id).toBeNull()
      }
    })

    it('deve retornar erro para cargo inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/${organizationSlug}/job-titles/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para ID inválido', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/${organizationSlug}/job-titles/invalid-id`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Criar usuário CLERK
      if (testDb.db) {
        const [clerkUser] = await testDb.db
          .insert(users)
          .values({
            email: 'clerk3@example.com',
            name: 'Clerk User 3',
            password_hash: 'hash',
          })
          .returning()

        await testDb.db.insert(members).values({
          user_id: clerkUser.id,
          organization_id: organizationId,
          organization_role: 'CLERK',
        })

        const clerkToken = testAuth.generateJwtToken(clerkUser.id, app)

        // Act
        const response = await app.inject({
          method: 'DELETE',
          url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
          headers: {
            authorization: `Bearer ${clerkToken}`,
          },
        })

        // Assert
        expect(response.statusCode).toBe(401)
      }
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/${organizationSlug}/job-titles/${jobTitleId}`,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/org-inexistente/job-titles/${jobTitleId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })
})
