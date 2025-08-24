import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  members,
  organizations,
  units,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  createUnitRoute,
  getUnitsRoute,
} from '../../src/http/routes/units/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Units Routes', () => {
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
    await app.register(createUnitRoute)
    await app.register(getUnitsRoute)
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

  describe('POST /organizations/:organizationSlug/units', () => {
    it('deve criar uma unidade com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Unidade Central',
          location: 'São Paulo, SP',
          description: 'Unidade principal da organização',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('unit')
      expect(body.unit.name).toBe('Unidade Central')
      expect(body.unit.slug).toBe('unidade-central')
      expect(body.unit.location).toBe('São Paulo, SP')
    })

    it('deve retornar erro para dados inválidos', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: '', // nome vazio
          description: null,
          location: '', // location vazio
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/organizations/non-existent/units',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Nova Unidade',
          description: null,
          location: 'São Paulo, SP',
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para slug duplicado na mesma organização', async () => {
      // Arrange - Cria uma unidade primeiro
      await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Primeira Unidade',
          description: null,
          location: 'Local 1',
        },
      })

      // Act - Tenta criar outra com o mesmo nome (que gerará o mesmo slug)
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Primeira Unidade', // mesmo nome
          description: null,
          location: 'Local 2',
        },
      })

      // Assert
      expect(response.statusCode).toBe(409) // Conflict
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Arrange - Cria usuário membro (não admin)
      const { user: memberUser } = await testAuth.createTestUser({
        email: 'member@example.com',
        password: 'password123',
      })

      if (testDb.db) {
        await testDb.db.insert(members).values({
          user_id: memberUser.id,
          organization_id: organizationId,
          organization_role: 'CLERK',
        })
      }

      const memberToken = testAuth.generateJwtToken(memberUser.id, app)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${memberToken}`,
        },
        payload: {
          name: 'Nova Unidade',
          description: null,
          location: 'São Paulo, SP',
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/units`,
        payload: {
          name: 'Nova Unidade',
          description: null,
          location: 'São Paulo, SP',
        },
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /organizations/:organizationSlug/units', () => {
    it('deve retornar lista de unidades da organização', async () => {
      // Arrange - Cria algumas unidades
      if (testDb.db) {
        await testDb.db.insert(units).values([
          {
            name: 'Unidade Norte',
            slug: 'unidade-norte',
            location: 'São Paulo, SP - Norte',
            description: 'Unidade da região norte',
            organization_id: organizationId,
            owner_id: userId,
            created_at: new Date(),
          },
          {
            name: 'Unidade Sul',
            slug: 'unidade-sul',
            location: 'São Paulo, SP - Sul',
            description: 'Unidade da região sul',
            organization_id: organizationId,
            owner_id: userId,
            created_at: new Date(),
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('units')
      expect(body.units).toHaveLength(2)
      
      const northUnit = body.units.find((u: any) => u.slug === 'unidade-norte')
      const southUnit = body.units.find((u: any) => u.slug === 'unidade-sul')
      
      expect(northUnit).toBeDefined()
      expect(northUnit.name).toBe('Unidade Norte')
      expect(southUnit).toBeDefined()
      expect(southUnit.name).toBe('Unidade Sul')
    })

    it('deve retornar lista vazia quando não há unidades', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('units')
      expect(body.units).toHaveLength(0)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations/non-existent/units',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para usuário sem acesso à organização', async () => {
      // Arrange - Cria usuário sem membership na organização
      const { user: outsiderUser } = await testAuth.createTestUser({
        email: 'outsider@example.com',
        password: 'password123',
      })
      const outsiderToken = testAuth.generateJwtToken(outsiderUser.id, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units`,
        headers: {
          authorization: `Bearer ${outsiderToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404) // Organization not found for this user
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units`,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })
})
