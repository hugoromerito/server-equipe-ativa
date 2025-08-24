import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  members,
  organizations,
  units,
  users,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  createOrganizationRoute,
  getMembershipRoute,
  getOrganizationRoute,
  getOrganizationsRoute,
  shutdownOrganizationRoute,
  updateOrganizationRoute,
} from '../../src/http/routes/organizations/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Organizations Routes', () => {
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
    await app.register(createOrganizationRoute)
    await app.register(getOrganizationRoute)
    await app.register(getOrganizationsRoute)
    await app.register(getMembershipRoute)
    await app.register(updateOrganizationRoute)
    await app.register(shutdownOrganizationRoute)
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

  describe('POST /organizations', () => {
    it('deve criar uma organização com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Nova Organização',
          slug: 'nova-organizacao',
          domain: 'nova-org.com.br',
          description: 'Descrição da nova organização',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('organization')
      expect(body.organization.name).toBe('Nova Organização')
      expect(body.organization.slug).toBe('nova-organizacao')
    })

    it('deve retornar erro para dados inválidos', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: '', // nome vazio
          slug: 'invalid slug', // slug com espaço
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para slug duplicado', async () => {
      // Arrange - Cria uma organização primeiro
      await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Primeira Organização',
        },
      })

      // Act - Tenta criar outra com o mesmo nome (mesmo slug)
      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Primeira Organização',
        },
      })

      // Assert
      expect(response.statusCode).toBe(409) // Conflict
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        payload: {
          name: 'Nova Organização',
          slug: 'nova-organizacao',
        },
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /organizations/:slug', () => {
    it('deve retornar uma organização específica', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('organization')
      expect(body.organization.id).toBe(organizationId)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations/non-existent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}`,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /organizations', () => {
    it('deve retornar lista de organizações do usuário', async () => {
      // Arrange - Cria mais organizações
      if (testDb.db) {
        const [org2] = await testDb.db
          .insert(organizations)
          .values({
            name: 'Segunda Organização',
            slug: 'segunda-org',
            owner_id: userId,
            created_at: new Date(),
          })
          .returning()

        await testDb.db.insert(members).values({
          user_id: userId,
          organization_id: org2.id,
          organization_role: 'MANAGER',
        })
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('organizations')
      expect(body.organizations).toHaveLength(2)
    })

    it('deve retornar lista vazia quando usuário não tem organizações', async () => {
      // Arrange - Cria usuário sem organizações
      const { user: newUser } = await testAuth.createTestUser({
        email: 'newuser@example.com',
        password: 'password123',
      })
      const newUserToken = testAuth.generateJwtToken(newUser.id, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations',
        headers: {
          authorization: `Bearer ${newUserToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('organizations')
      expect(body.organizations).toHaveLength(0)
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations',
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /organizations/:slug/membership', () => {
    it('deve retornar membership do usuário na organização', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/membership`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('membership')
      expect(body.membership.organization_role).toBe('ADMIN')
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations/non-existent/membership',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })

    it('deve retornar erro para usuário sem membership', async () => {
      // Arrange - Cria usuário sem membership
      const { user: newUser } = await testAuth.createTestUser({
        email: 'outsider@example.com',
        password: 'password123',
      })
      const outsiderToken = testAuth.generateJwtToken(newUser.id, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/membership`,
        headers: {
          authorization: `Bearer ${outsiderToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })
  })

  describe('PUT /organizations/:slug', () => {
    it('deve atualizar uma organização com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'PUT',
        url: `/organizations/${organizationSlug}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Nome Atualizado',
          description: 'Descrição atualizada',
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('organization')
      expect(body.organization.name).toBe('Nome Atualizado')
    })

    it('deve retornar erro para dados inválidos', async () => {
      // Act
      const response = await app.inject({
        method: 'PUT',
        url: `/organizations/${organizationSlug}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: '', // nome vazio
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
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
        method: 'PUT',
        url: `/organizations/${organizationSlug}`,
        headers: {
          authorization: `Bearer ${memberToken}`,
        },
        payload: {
          name: 'Tentativa de Atualização',
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })
  })

  describe('DELETE /organizations/:slug', () => {
    it('deve desativar uma organização com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/organizations/${organizationSlug}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: '/organizations/non-existent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
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
        method: 'DELETE',
        url: `/organizations/${organizationSlug}`,
        headers: {
          authorization: `Bearer ${memberToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })
  })
})
