/**
 * Servidor principal da aplicação Equipe Ativa
 * 
 * Este arquivo configura e inicializa o servidor Fastify com todas as rotas,
 * middlewares, plugins e configurações necessárias para o funcionamento da API.
 * 
 * Funcionalidades incluem:
 * - Autenticação JWT
 * - Upload de arquivos
 * - Documentação Swagger
 * - Rate limiting
 * - Logging estruturado
 * - Métricas de performance
 * - Graceful shutdown
 */

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
import { SWAGGER_CONFIG } from './config/constants.ts'
import { logger } from './utils/logger.ts'

// Extensão dos tipos do Fastify para incluir startTime para métricas
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number
  }
}

import { db } from './db/connection.ts'
import { users } from './db/schema/auth.ts'
import { auth } from './http/middlewares/auth.ts'
import { metricsPlugin } from './http/middlewares/metrics.ts'

// Import all routes
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
  authenticateWithGoogleRoute,
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
  getOrganizationInvitesRoute,
  getPendingInvitesRoute,
  rejectInviteRoute,
} from './http/routes/invites/index.ts'
import {
  createJobTitleRoute,
  deleteJobTitleRoute,
  getJobTitleRoute,
  getJobTitlesRoute,
  updateJobTitleRoute,
} from './http/routes/job-titles/index.ts'
import {
  getAvailableMembersRoute,
  getMembersOrganizationRoute,
  getMembersUnitRoute,
  updateMemberWorkingDaysRoute,
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

// Função para criar a aplicação
async function createApp() {
  const app = fastify({ 
    logger: false, // Usar nosso logger customizado
    disableRequestLogging: true,
    trustProxy: true,
    ignoreTrailingSlash: true,
    ignoreDuplicateSlashes: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    bodyLimit: env.MAX_FILE_SIZE,
  }).withTypeProvider<ZodTypeProvider>()

  // Configuração de upload com limites seguros
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
      files: env.MAX_FILES_PER_UPLOAD,
      fieldSize: 1024 * 1024, // 1MB
      headerPairs: 200,
    },
    attachFieldsToBody: 'keyValues',
    throwFileSizeLimit: true,
  })

  // CORS configurado com segurança
  await app.register(fastifyCors, {
    origin: (origin, callback) => {
      // Em produção, permitir todos os origins (ou especifique os domínios permitidos)
      if (env.NODE_ENV === 'production') {
        callback(null, true)
        return
      }
      
      // Em desenvolvimento, permitir localhost
      const allowedOrigins = [
        'http://localhost:3000', 
        'http://localhost:3333', 
        'http://localhost:5173'
      ]
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      
      callback(new Error('Não permitido pelo CORS'), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Accept', 
      'X-Requested-With',
      'X-Request-ID',
    ],
    maxAge: 86400, // 24 horas
  })

  // JWT configuration
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
    verify: {
      maxAge: env.JWT_EXPIRES_IN,
    },
    messages: {
      badRequestErrorMessage: 'Token JWT malformado',
      noAuthorizationInHeaderMessage: 'Token de autorização não encontrado',
      authorizationTokenExpiredMessage: 'Token de autorização expirado',
      authorizationTokenInvalid: 'Token de autorização inválido',
    },
  })

  // Configurar validação e serialização
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Plugin de métricas
  await app.register(metricsPlugin)

  // Configuração do Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: SWAGGER_CONFIG.TITLE,
        description: SWAGGER_CONFIG.DESCRIPTION,
        version: SWAGGER_CONFIG.VERSION,
        contact: {
          name: 'Equipe de Desenvolvimento',
          email: 'dev@equipeativa.com',
        },
        license: {
          name: 'Proprietary',
        },
      },
      servers: [
        {
          url: env.NODE_ENV === 'production' 
            ? 'https://api.equipeativa.com' 
            : `http://localhost:${env.PORT}`,
          description: env.NODE_ENV === 'production' 
            ? 'Servidor de produção' 
            : 'Servidor de desenvolvimento',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Token JWT para autenticação. Formato: Bearer {token}',
          },
        },
      },
      tags: [...SWAGGER_CONFIG.TAGS],
    },
    transform: jsonSchemaTransform,
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      displayOperationId: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
    transformSpecification: (swaggerObject, _request, _reply) => {
      return swaggerObject
    },
    transformSpecificationClone: true,
  })

  // Hook para logging de request
  app.addHook('onRequest', async (request, _reply) => {
    request.startTime = Date.now()
    
    logger.info(`${request.method} ${request.url}`, {
      requestId: request.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    })
    
    // Atualizar last_seen do usuário se autenticado
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

  // Hook para logging de response
  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now())
    
    const logLevel = reply.statusCode >= 500 ? 'error' 
      : reply.statusCode >= 400 ? 'warn' 
      : duration > 1000 ? 'warn' 
      : 'info'

    logger[logLevel](`${request.method} ${request.url} - ${reply.statusCode}`, {
      requestId: request.id,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      ip: request.ip,
    })
  })

  // Registrar plugin de autenticação
  await app.register(auth)

  // Registrar todas as rotas de forma organizada
  await Promise.all([
    // Auth routes
    app.register(authenticateWithPasswordRoute),
    app.register(authenticateWithGoogleRoute),
    app.register(getProfileRoute),
    app.register(requestPasswordRecoverRoute),
    app.register(resetPasswordRoute),

    // Organization routes
    app.register(createOrganizationRoute),
    app.register(getMembershipRoute),
    app.register(getOrganizationRoute),
    app.register(getOrganizationsRoute),
    app.register(shutdownOrganizationRoute),
    app.register(updateOrganizationRoute),

    // Unit routes
    app.register(createUnitRoute),
    app.register(getUnitsRoute),

    // User routes
    app.register(getUsersRoute),
    app.register(createUserRoute),

    // Member routes
    app.register(getMembersOrganizationRoute),
    app.register(getMembersUnitRoute),
    app.register(updateMemberWorkingDaysRoute),
    app.register(getAvailableMembersRoute),

    // Invite routes
    app.register(acceptInviteRoute),
    app.register(createInviteRoute),
    app.register(getInviteRoute),
    app.register(getInvitesRoute),
    app.register(getOrganizationInvitesRoute),
    app.register(getPendingInvitesRoute),
    app.register(rejectInviteRoute),

    // Job Title routes
    app.register(createJobTitleRoute),
    app.register(getJobTitlesRoute),
    app.register(getJobTitleRoute),
    app.register(updateJobTitleRoute),
    app.register(deleteJobTitleRoute),

    // Applicant routes
    app.register(createApplicantRoute),
    app.register(getApplicantDemandsRoute),
    app.register(getApplicantRoute),
    app.register(getApplicantsRoute),
    app.register(getCheckApplicantRoute),

    // Demand routes
    app.register(createDemandRoute),
    app.register(getDemandRoute),
    app.register(getDemandsRoute),
    app.register(updateDemandRoute),

    // Attachment routes
    app.register(uploadUserAvatarRoute),
    app.register(uploadApplicantAvatarRoute),
    app.register(uploadOrganizationAvatarRoute),
    app.register(uploadDemandDocumentRoute),
    app.register(uploadApplicantDocumentRoute),
    app.register(uploadOrganizationDocumentRoute),
    app.register(getAttachmentsRoute),
    app.register(downloadAttachmentRoute),
    app.register(deleteAttachmentRoute),
  ])

  // Health check endpoint
  app.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Verifica se a API está funcionando corretamente',
    },
  }, async (request, reply) => {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: SWAGGER_CONFIG.VERSION,
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    }

    return reply.status(200).send(healthData)
  })

  // Endpoint raiz com informações da API
  app.get('/', {
    schema: {
      tags: ['System'],
      summary: 'API Info',
      description: 'Informações básicas da API',
    },
  }, async (request, reply) => {
    return reply.send({
      name: 'Equipe Ativa API',
      version: SWAGGER_CONFIG.VERSION,
      description: SWAGGER_CONFIG.DESCRIPTION,
      environment: env.NODE_ENV,
      documentation: '/docs',
      health: '/health',
      metrics: env.NODE_ENV === 'development' ? '/metrics' : undefined,
      timestamp: new Date().toISOString(),
    })
  })

  // Registrar error handler (deve ser por último)
  app.setErrorHandler(errorHandler)

  return app
}

// Função para iniciar o servidor
async function startServer() {
  try {
    const app = await createApp()

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Recebido ${signal}. Iniciando graceful shutdown...`)
      
      try {
        await app.close()
        logger.info('Servidor fechado com sucesso')
        process.exit(0)
      } catch (error) {
        logger.error('Erro durante o shutdown:', {
          error: error instanceof Error ? error.message : String(error)
        })
        process.exit(1)
      }
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', { error: error.message, stack: error.stack })
      process.exit(1)
    })
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', { reason })
      process.exit(1)
    })

    // Iniciar servidor
    await app.listen({ 
      port: env.PORT, 
      host: env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' 
    })
    
    logger.info(`🚀 Servidor rodando em http://localhost:${env.PORT}`)
    logger.info(`📚 Documentação disponível em http://localhost:${env.PORT}/docs`)
    logger.info(`🏥 Health check disponível em http://localhost:${env.PORT}/health`)
    
    if (env.NODE_ENV === 'development') {
      logger.info(`📊 Métricas disponíveis em http://localhost:${env.PORT}/metrics`)
    }
    
  } catch (error) {
    logger.error('Erro ao iniciar servidor:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    process.exit(1)
  }
}

// Se este arquivo for executado diretamente, iniciar o servidor
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}

export { createApp, startServer }
