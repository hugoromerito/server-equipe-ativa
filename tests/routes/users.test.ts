import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  members,
  organizations,
  users,
} from '../../src/db/schema/index.ts'
import { auth } from '../../src/http/middlewares/auth.ts'
import {
  createUserRoute,
  getUsersRoute,
} from '../../src/http/routes/users/index.ts'
import { testDb } from '../setup.ts'
import { createTestApp } from '../utils/create-test-app.ts'
import { TestAuth } from '../utils/test-auth.ts'

describe('Users Routes', () => {
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
    await app.register(createUserRoute)
    await app.register(getUsersRoute)
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

      // Cria membership para o usuário admin
      await testDb.db.insert(members).values({
        user_id: userId,
        organization_id: organizationId,
        organization_role: 'ADMIN',
      })
    }

    // Gera token de autenticação
    authToken = testAuth.generateJwtToken(userId, app)
  })

  describe('POST /users', () => {
    it('deve criar um usuário com sucesso', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'João Silva',
          email: 'joao@example.com',
          password: 'password123',
        },
      })

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message', 'Usuário criado com sucesso.')
    })

    it('deve retornar erro para dados inválidos', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: '', // nome vazio
          email: 'invalid-email', // email inválido
          password: '123', // senha muito curta
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve retornar erro para email duplicado', async () => {
      // Arrange - Cria um usuário primeiro
      await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'Primeiro Usuário',
          email: 'duplicado@example.com',
          password: 'password123',
        },
      })

      // Act - Tenta criar outro com o mesmo email
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'Segundo Usuário',
          email: 'duplicado@example.com',
          password: 'password456',
        },
      })

      // Assert
      expect(response.statusCode).toBe(409) // Conflict
    })

    it('deve validar formato de email', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'João Silva',
          email: 'not-an-email',
          password: 'password123',
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message')
    })

    it('deve validar senha mínima', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'João Silva',
          email: 'joao@example.com',
          password: '123', // senha muito curta
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('deve validar nome obrigatório', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'joao@example.com',
          password: 'password123',
          // name omitido
        },
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    // it('deve criar usuário com dados opcionais', async () => {
    //   // Act
    //   const response = await app.inject({
    //     method: 'POST',
    //     url: '/users',
    //     payload: {
    //       name: 'João Silva',
    //       email: 'joao@example.com',
    //       password: 'password123',
    //       phone: '+5511999999999',
    //       bio: 'Desenvolvedor Full Stack',
    //     },
    //   })

    //   // Assert
    //   expect(response.statusCode).toBe(201)
    //   const body = JSON.parse(response.body)
    //   expect(body).toHaveProperty('user')
    //   expect(body.user.phone).toBe('+5511999999999')
    //   expect(body.user.bio).toBe('Desenvolvedor Full Stack')
    // })
  })

  describe('GET /organizations/:organizationSlug/users', () => {
    it('deve retornar lista de usuários da organização', async () => {
      // Arrange - Cria mais usuários e adiciona à organização
      if (testDb.db) {
        // Cria usuários
        const [user1] = await testDb.db
          .insert(users)
          .values({
            name: 'Maria Santos',
            email: 'maria@example.com',
            password_hash: 'hash',
            created_at: new Date(),
          })
          .returning()

        const [user2] = await testDb.db
          .insert(users)
          .values({
            name: 'Pedro Silva',
            email: 'pedro@example.com',
            password_hash: 'hash',
            created_at: new Date(),
          })
          .returning()

        // Adiciona memberships
        await testDb.db.insert(members).values([
          {
            user_id: user1.id,
            organization_id: organizationId,
            organization_role: 'ADMIN',
          },
          {
            user_id: user2.id,
            organization_id: organizationId,
            organization_role: 'MANAGER',
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/users`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('users')
      expect(body.users).toHaveLength(3) // Admin + 2 membros
      
      const adminUser = body.users.find((u: any) => u.email === 'admin@example.com')
      const mariaUser = body.users.find((u: any) => u.email === 'maria@example.com')
      const pedroUser = body.users.find((u: any) => u.email === 'pedro@example.com')
      
      expect(adminUser).toBeDefined()
      expect(mariaUser).toBeDefined()
      expect(pedroUser).toBeDefined()
    })

    it('deve retornar erro para organização inexistente', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/organizations/non-existent/users',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro para usuário sem permissão', async () => {
      // Arrange - Cria usuário sem membership na organização
      const { user: outsiderUser } = await testAuth.createTestUser({
        email: 'outsider@example.com',
        password: 'password123',
      })
      const outsiderToken = testAuth.generateJwtToken(outsiderUser.id, app)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/users`,
        headers: {
          authorization: `Bearer ${outsiderToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(404)
    })

    it('deve retornar erro sem autenticação', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/users`,
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })

    it('deve permitir paginação da lista de usuários', async () => {
      // Arrange - Cria vários usuários
      if (testDb.db) {
        for (let i = 0; i < 10; i++) {
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
            organization_role: 'ADMIN',
          })
        }
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/users?page=1&pageSize=5`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('users')
      expect(body.users.length).toBeLessThanOrEqual(5)
      expect(body).toHaveProperty('totalUsers')
      expect(body.totalUsers).toBe(11) // Admin + 10 criados
    })

    it('deve permitir busca por nome do usuário', async () => {
      // Arrange - Cria usuários com nomes específicos
      if (testDb.db) {
        const [user1] = await testDb.db
          .insert(users)
          .values({
            name: 'João da Silva',
            email: 'joao.silva@example.com',
            password_hash: 'hash',
            created_at: new Date(),
          })
          .returning()

        const [user2] = await testDb.db
          .insert(users)
          .values({
            name: 'João Santos',
            email: 'joao.santos@example.com',
            password_hash: 'hash',
            created_at: new Date(),
          })
          .returning()

        const [user3] = await testDb.db
          .insert(users)
          .values({
            name: 'Maria Silva',
            email: 'maria.silva@example.com',
            password_hash: 'hash',
            created_at: new Date(),
          })
          .returning()

        await testDb.db.insert(members).values([
          {
            user_id: user1.id,
            organization_id: organizationId,
            organization_role: 'CLERK',
          },
          {
            user_id: user2.id,
            organization_id: organizationId,
            organization_role: 'MANAGER',
          },
          {
            user_id: user3.id,
            organization_id: organizationId,
            organization_role: 'ADMIN',
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/users?search=João`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('users')
      expect(body.users).toHaveLength(2) // Apenas os dois Joãos
      expect(body.users.every((u: any) => u.name.includes('João'))).toBe(true)
    })

    it('deve filtrar usuários por role', async () => {
      // Arrange - Cria usuários com diferentes roles
      if (testDb.db) {
        const [adminUser] = await testDb.db
          .insert(users)
          .values({
            name: 'Admin User',
            email: 'admin2@example.com',
            password_hash: 'hash',
            created_at: new Date(),
          })
          .returning()

        const [memberUser] = await testDb.db
          .insert(users)
          .values({
            name: 'Member User',
            email: 'member@example.com',
            password_hash: 'hash',
            created_at: new Date(),
          })
          .returning()

        await testDb.db.insert(members).values([
          {
            user_id: adminUser.id,
            organization_id: organizationId,
            organization_role: 'ADMIN',
          },
          {
            user_id: memberUser.id,
            organization_id: organizationId,
            organization_role: 'MANAGER',
          },
        ])
      }

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/organizations/${organizationSlug}/users?role=ADMIN`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('users')
      expect(body.users).toHaveLength(2) // Os dois admins
      expect(body.users.every((u: any) => u.role === 'ADMIN')).toBe(true)
    })
  })
})
