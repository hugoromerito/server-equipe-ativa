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
import {
  createApplicantRoute,
  getApplicantDemandsRoute,
  getApplicantRoute,
  getApplicantsRoute,
  getCheckApplicantRoute,
} from './http/routes/applicants/index.ts'
import {
  deleteAttachmentRoute,
  downloadAttachmentRoute,
  getAttachmentsRoute,
  uploadApplicantAvatarRoute,
  uploadApplicantDocumentRoute,
  uploadDemandDocumentRoute,
  uploadOrganizationAvatarRoute,
  uploadOrganizationDocumentRoute,
  uploadUserAvatarRoute,
} from './http/routes/attachments/index.ts'
import {
  authenticateWithPasswordRoute,
  getProfileRoute,
  requestPasswordRecoverRoute,
  resetPasswordRoute,
} from './http/routes/auth/index.ts'
import {
  createDemandRoute,
  getDemandRoute,
  getDemandsRoute,
  updateDemandRoute,
} from './http/routes/demands/index.ts'
import {
  acceptInviteRoute,
  createInviteRoute,
  getInviteRoute,
  getInvitesRoute,
  getPendingInvitesRoute,
  rejectInviteRoute,
} from './http/routes/invites/index.ts'
import {
  getMembersOrganizationRoute,
  getMembersUnitRoute,
} from './http/routes/members/index.ts'
import {
  createOrganizationRoute,
  getMembershipRoute,
  getOrganizationRoute,
  getOrganizationsRoute,
  shutdownOrganizationRoute,
  updateOrganizationRoute,
} from './http/routes/organizations/index.ts'
import { createUnitRoute, getUnitsRoute } from './http/routes/units/index.ts'
import { createUserRoute, getUsersRoute } from './http/routes/users/index.ts'
import { errorHandler } from './http/routes/_errors/error-handler.ts'

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

// Registrar error handler
app.setErrorHandler(errorHandler)

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
      { name: 'Attachments', description: 'Gerenciamento de anexos' },
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

// Attachments
app.register(uploadUserAvatarRoute)
app.register(uploadApplicantAvatarRoute)
app.register(uploadOrganizationAvatarRoute)
app.register(uploadDemandDocumentRoute)
app.register(uploadApplicantDocumentRoute)
app.register(uploadOrganizationDocumentRoute)
app.register(getAttachmentsRoute)
app.register(downloadAttachmentRoute)
app.register(deleteAttachmentRoute)

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

app.listen({ port: env.PORT })
