import { fastifyCors } from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { eq } from 'drizzle-orm'
import { fastify } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from './config/env.ts'
import { db } from './db/connection.ts'
import { users } from './db/schema/auth.ts'
import { auth } from './http/middlewares/auth.ts'
import { createApplicantRoute } from './http/routes/applicants/create-applicant.ts'
import { getApplicantRoute } from './http/routes/applicants/get-applicant.ts'
import { getApplicantDemandsRoute } from './http/routes/applicants/get-applicant-demands.ts'
import { getApplicantsRoute } from './http/routes/applicants/get-applicants.ts'
import { getCheckApplicantRoute } from './http/routes/applicants/get-check-applicant.ts'
import { uploadUserAvatarRoute } from './http/routes/attachments/upload-user-avatar.ts'
import { authenticateWithPasswordRoute } from './http/routes/auth/authenticate-with-password.ts'
import { getProfileRoute } from './http/routes/auth/get-profile.ts'
import { requestPasswordRecoverRoute } from './http/routes/auth/request-password-recover.ts'
import { resetPasswordRoute } from './http/routes/auth/reset-password.ts'
import { createDemandRoute } from './http/routes/demands/create-demand.ts'
import { getDemandRoute } from './http/routes/demands/get-demand.ts'
import { getDemandsRoute } from './http/routes/demands/get-demands.ts'
import { updateDemandRoute } from './http/routes/demands/update-demand.ts'
import { acceptInviteRoute } from './http/routes/invites/accept-invite.ts'
import { createInviteRoute } from './http/routes/invites/create-invite.ts'
import { getInviteRoute } from './http/routes/invites/get-invite.ts'
import { getInvitesRoute } from './http/routes/invites/get-invites.ts'
import { getPendingInvitesRoute } from './http/routes/invites/get-pending-invites.ts'
import { rejectInviteRoute } from './http/routes/invites/reject-invite.ts'
import { getMembersOrganizationRoute } from './http/routes/members/get-members-organization.ts'
import { getMembersUnitRoute } from './http/routes/members/get-members-unit.ts'
import { createOrganizationRoute } from './http/routes/organizations/create-organization.ts'
import { getMembershipRoute } from './http/routes/organizations/get-membership.ts'
import { getOrganizationRoute } from './http/routes/organizations/get-organization.ts'
import { getOrganizationsRoute } from './http/routes/organizations/get-organizations.ts'
import { shutdownOrganizationRoute } from './http/routes/organizations/shutdown-organization.ts'
import { updateOrganizationRoute } from './http/routes/organizations/update-organization.ts'
import { createUnitRoute } from './http/routes/units/create-unit.ts'
import { getUnitsRoute } from './http/routes/units/get-units.ts'
import { createUserRoute } from './http/routes/users/create-user.ts'
import { getUsersRoute } from './http/routes/users/get-users.ts'

const app = fastify().withTypeProvider<ZodTypeProvider>()
app.register(fastifyMultipart)
// app.register(fastifyCors, {
//   origin: 'http://localhost:5173', //URL do Frontend
// })

app.register(fastifyCors, {
  origin: (origin, callback) => {
    const hostname = new URL(origin || 'http://localhost:3333').hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || !origin) {
      callback(null, true)
      return
    }
    callback(new Error('Not allowed by CORS'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
})

app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(swagger, {
  openapi: {
    info: {
      title: 'Equipe Ativa API',
      description: 'Documentação da API Equipe Ativa',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Servidor de desenvolvimento',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT para autenticação',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Operações de autenticação' },
      { name: 'Organizations', description: 'Gerenciamento de organizações' },
      { name: 'Units', description: 'Gerenciamento de unidades' },
      { name: 'Users', description: 'Gerenciamento de usuários' },
      { name: 'Members', description: 'Gerenciamento de membros' },
      { name: 'Invites', description: 'Gerenciamento de convites' },
      { name: 'Applicants', description: 'Gerenciamento de solicitantes' },
      { name: 'Demands', description: 'Gerenciamento de demandas' },
    ],
  },
  transform: jsonSchemaTransform,
})

app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  },
  staticCSP: true,
  transformSpecification: (swaggerObject, _request, _reply) => {
    return swaggerObject
  },
  transformSpecificationClone: true,
})

// ✅ Hook para atualizar o last_seen
app.addHook('onRequest', async (request, _reply) => {
  if (typeof request.getCurrentUserId !== 'function') {
    return
  }
  try {
    const userId = await request.getCurrentUserId()
    if (userId) {
      await db
        .update(users)
        .set({ last_seen: new Date() })
        .where(eq(users.id, userId))
    }
  } catch {
    // ignorar erro de token inválido aqui, pois pode ser rota pública
  }
})

app.register(auth)

// Applicants
app.register(createApplicantRoute)
app.register(getApplicantDemandsRoute)
app.register(getApplicantRoute)
app.register(getApplicantsRoute)
app.register(getCheckApplicantRoute)

// Auth
app.register(authenticateWithPasswordRoute)
app.register(getProfileRoute)
app.register(requestPasswordRecoverRoute)
app.register(resetPasswordRoute)

// Demands
app.register(createDemandRoute)
app.register(getDemandRoute)
app.register(getDemandsRoute)
app.register(updateDemandRoute)

// Invites
app.register(acceptInviteRoute)
app.register(createInviteRoute)
app.register(getInviteRoute)
app.register(getInvitesRoute)
app.register(getPendingInvitesRoute)
app.register(rejectInviteRoute)

// Members
app.register(getMembersOrganizationRoute)
app.register(getMembersUnitRoute)

// Organizations
app.register(createOrganizationRoute)
app.register(getMembershipRoute)
app.register(getOrganizationRoute)
app.register(getOrganizationsRoute)
app.register(shutdownOrganizationRoute)
app.register(updateOrganizationRoute)

// Units
app.register(createUnitRoute)
app.register(getUnitsRoute)

// Users
app.register(getUsersRoute)
app.register(createUserRoute)
app.register(uploadUserAvatarRoute)

app.listen({ port: env.PORT })
