import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  invites,
  members,
  organizations,
  units,
  users,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  acceptInviteRoute,
  createInviteRoute,
  getInviteRoute,
  getInvitesRoute,
  getOrganizationInvitesRoute,
  getPendingInvitesRoute,
  rejectInviteRoute,
} from '../../src/http/routes/invites/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Invites Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let authToken: string
  let organizationId: string
  let organizationSlug: string
  let unitId: string
  let userId: string
  let invitedUserId: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(createInviteRoute)
    await app.register(getInviteRoute)
    await app.register(getInvitesRoute)
    await app.register(getOrganizationInvitesRoute)
    await app.register(getPendingInvitesRoute)
    await app.register(acceptInviteRoute)
    await app.register(rejectInviteRoute)
    await app.ready()

    // Cria usuário de teste (admin)
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
    }

    // Cria unidade
    if (testDb.db) {
      const [unit] = await testDb.db
        .insert(units)
        .values({
          name: 'Test Unit',
          slug: `test-unit-${randomUUID()}`,
          location: 'Test Location',
          description: 'Test unit description',
          organization_id: organizationId,
          owner_id: userId,
          created_at: new Date(),
        })
        .returning()

      unitId = unit.id

      // Cria membership para o usuário admin
      await testDb.db.insert(members).values({
        user_id: userId,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'ADMIN',
      })
    }

    // Cria usuário convidado
    if (testDb.db) {
      const [invitedUser] = await testDb.db
        .insert(users)
        .values({
          name: 'Invited User',
          email: 'invited@example.com',
          password_hash: 'hash',
          created_at: new Date(),
        })
        .returning()

      invitedUserId = invitedUser.id
    }

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('POST /organizations/:organizationSlug/invites', () => {
    it('deve criar um convite com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/invites`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          email: 'newuser@example.com',
          role: 'MANAGER',
          unit_id: unitId,
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('inviteId')
      expect(typeof body.inviteId).toBe('string')
    })

    it('deve retornar erro para dados inválidos', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/organizations/${organizationSlug}/invites`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          email: 'invalid-email',
          role: 'MANAGER',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/organizations/non-existent/invites',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          email: 'newuser@example.com',
          role: 'MANAGER',
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /organizations/:organizationSlug/invites/:inviteId', () => {
    it('deve retornar um convite específico', async () => {
      // Arrange
      let inviteId: string = 'test-invite-id'
      if (testDb.db) {
        const [invite] = await testDb.db
          .insert(invites)
          .values({
            email: 'test@example.com',
            organization_id: organizationId,
            unit_id: unitId,
            role: 'CLERK',
            author_id: userId,
            created_at: new Date(),
          })
          .returning()

        inviteId = invite.id
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/invites/${inviteId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('invite')
      expect(body.invite.email).toBe('test@example.com')
    })

    it('deve retornar erro para convite inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/invites/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /organizations/:organizationSlug/invites', () => {
    it('deve retornar lista de convites', async () => {
      // Arrange
      if (testDb.db) {
        await testDb.db.insert(invites).values([
          {
            email: 'user1@example.com',
            organization_id: organizationId,
            role: 'MANAGER',
            unit_id: unitId,
            author_id: userId,
            created_at: new Date(),
          },
          {
            email: 'user2@example.com',
            organization_id: organizationId,
            role: 'ADMIN',
            author_id: userId,
            created_at: new Date(),
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/invites`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('invites')
      expect(body.invites).toHaveLength(2)
    })

    it('deve retornar lista vazia quando não há convites', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/invites`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('invites')
      expect(body.invites).toHaveLength(0)
    })
  })

  describe('GET /invites/pending', () => {
    it('deve retornar convites pendentes do usuário', async () => {
      // Arrange
      if (testDb.db) {
        await testDb.db.insert(invites).values({
          email: 'invited@example.com',
          organization_id: organizationId,
          role: 'MANAGER',
          unit_id: unitId,
          author_id: userId,
          created_at: new Date(),
        })
      }

      const invitedToken = testAuth.generateJwtToken(invitedUserId, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/invites/pending',
        headers: {
          authorization: `Bearer ${invitedToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('invites')
      expect(Array.isArray(body.invites)).toBe(true)
    })
  })

  describe('POST /invites/:inviteId/accept', () => {
    it('deve aceitar um convite com sucesso', async () => {
      // Arrange
      let inviteId: string = 'test-invite-id'
      if (testDb.db) {
        const [invite] = await testDb.db
          .insert(invites)
          .values({
            email: 'invited@example.com',
            organization_id: organizationId,
            role: 'MANAGER',
            unit_id: unitId,
            author_id: userId,
            created_at: new Date(),
          })
          .returning()

        inviteId = invite.id
      }

      const invitedToken = testAuth.generateJwtToken(invitedUserId, app)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/invites/${inviteId}/accept`,
        headers: {
          authorization: `Bearer ${invitedToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(204)
    })

    it('deve retornar erro para convite inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/invites/${randomUUID()}/accept`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /invites/:inviteId/reject', () => {
    it('deve rejeitar um convite com sucesso', async () => {
      // Arrange
      let inviteId: string = 'test-invite-id'
      if (testDb.db) {
        const [invite] = await testDb.db
          .insert(invites)
          .values({
            email: 'invited@example.com',
            organization_id: organizationId,
            role: 'MANAGER',
            unit_id: unitId,
            author_id: userId,
            created_at: new Date(),
          })
          .returning()

        inviteId = invite.id
      }

      const invitedToken = testAuth.generateJwtToken(invitedUserId, app)

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/invites/${inviteId}/reject`,
        headers: {
          authorization: `Bearer ${invitedToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(204)
    })

    it('deve retornar erro para convite inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/invites/${randomUUID()}/reject`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })
  })
})
