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
  getMembersOrganizationRoute,
  getMembersUnitRoute,
} from '../../src/http/routes/members/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Members Routes', () => {
  let testAuth: TestAuth
  let app: ReturnType<typeof createTestApp>
  let authToken: string
  let organizationId: string
  let organizationSlug: string
  let unitId: string
  let unitSlug: string
  let userId: string
  let memberUserId: string

  beforeEach(async () => {
    await testDb.clearDatabase()
    testAuth = new TestAuth(testDb)
    app = createTestApp()

    // Registra middleware de auth e as rotas
    await app.register(auth)
    await app.register(getMembersOrganizationRoute)
    await app.register(getMembersUnitRoute)
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

      // Cria membership para o usuário admin
      await testDb.db.insert(members).values({
        user_id: userId,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'ADMIN',
        unit_role: 'MANAGER',
      })
    }

    // Cria usuário membro
    if (testDb.db) {
      const [memberUser] = await testDb.db
        .insert(users)
        .values({
          name: 'Member User',
          email: 'member@example.com',
          password_hash: 'hash',
          created_at: new Date(),
        })
        .returning()

      memberUserId = memberUser.id

      // Cria membership para o usuário membro
      await testDb.db.insert(members).values({
        user_id: memberUserId,
        organization_id: organizationId,
        unit_id: unitId,
        organization_role: 'CLERK',
        unit_role: 'ANALYST', // ANALYST não tem get User
      })
    }

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('GET /organizations/:organizationSlug/members', () => {
    it('deve retornar lista de membros da organização', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/members`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('members')
      expect(body.members).toHaveLength(2) // Admin + Member
      
      const adminMember = body.members.find((m: any) => m.user.email === 'admin@example.com')
      const regularMember = body.members.find((m: any) => m.user.email === 'member@example.com')
      
      expect(adminMember).toBeDefined()
      expect(adminMember.organization_role).toBe('ADMIN')
      expect(regularMember).toBeDefined()
      expect(regularMember.organization_role).toBe('CLERK')
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations/non-existent/members',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Arrange
      const unauthorizedToken = testAuth.generateJwtToken(memberUserId, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/members`,
        headers: {
          authorization: `Bearer ${unauthorizedToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })

    it('deve permitir paginação da lista de membros', async () => {
      // Arrange - Cria mais membros
      if (testDb.db) {
        for (let i = 0; i < 5; i++) {
          const [user] = await testDb.db
            .insert(users)
            .values({
              name: `User ${i}`,
              email: `user${i}@example.com`,
              password_hash: 'hash',
              created_at: new Date(),
            })
            .returning()

          await testDb.db.insert(members).values({
            user_id: user.id,
            organization_id: organizationId,
            organization_role: 'MANAGER',
          })
        }
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/members?page=1&pageSize=3`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('members')
      expect(body.members.length).toBeLessThanOrEqual(3)
      expect(body).toHaveProperty('totalCount')
      expect(body.totalCount).toBe(7) // 2 iniciais + 5 criados
    })
  })

  describe('GET /organizations/:organizationSlug/units/:unitSlug/members', () => {
    it('deve retornar lista de membros da unidade', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/members`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('members')
      expect(body.members).toHaveLength(2) // Admin + Member

      const adminMember = body.members.find((m: any) => m.user.email === 'admin@example.com')
      const regularMember = body.members.find((m: any) => m.user.email === 'member@example.com')
      
      expect(adminMember).toBeDefined()
      expect(adminMember.unit_role).toBe('MANAGER')
      expect(regularMember).toBeDefined()
      expect(regularMember.unit_role).toBe('ANALYST')
    })

    it('deve retornar erro para unidade inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/non-existent/members`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/non-existent/units/${unitSlug}/members`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Arrange
      const unauthorizedToken = testAuth.generateJwtToken(memberUserId, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/members`,
        headers: {
          authorization: `Bearer ${unauthorizedToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(403)
    })

    it('deve filtrar membros por role na unidade', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/units/${unitSlug}/members?role=MANAGER`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('members')
      expect(body.members).toHaveLength(1) // Apenas o admin/manager
      expect(body.members[0].unit_role).toBe('MANAGER')
    })
  })
})
