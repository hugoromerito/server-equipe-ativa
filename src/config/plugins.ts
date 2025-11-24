/**
 * Fastify Plugins Configuration
 * 
 * Configures and registers all Fastify plugins including:
 * - CORS
 * - JWT
 * - Multipart (file upload)
 * - Swagger documentation
 * - Metrics
 */

import { fastifyCors } from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'
import type { FastifyInstance } from 'fastify'

import { env } from '../config/env.ts'
import { SWAGGER_CONFIG } from '../config/constants.ts'
import { metricsPlugin } from '../http/middlewares/metrics.ts'

export async function registerPlugins(app: FastifyInstance) {
  // Configuração de upload com limites seguros
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
      files: env.MAX_FILES_PER_UPLOAD,
      fieldSize: 1024 * 1024, // 1MB
      headerPairs: 200,
    },
    throwFileSizeLimit: true,
  })

  // CORS configurado com segurança
  await app.register(fastifyCors, {
    origin: (origin, callback) => {
      // Lista de origins permitidos
      const allowedOrigins = [
        'http://localhost:3000', 
        'http://localhost:3333', 
        'http://localhost:5173',
        'https://equipeativa.com',
        'https://www.equipeativa.com',
      ]
      
      // Adicionar domínios customizados da variável de ambiente
      if (env.ALLOWED_ORIGINS) {
        const customOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        allowedOrigins.push(...customOrigins)
      }
      
      // Verificar se o origin é da Vercel ou GitHub Codespaces
      const isVercelDomain = origin && (
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.vercel.com')
      )
      
      const isGitHubCodespaces = origin && origin.includes('.app.github.dev')
      
      const isAllowedOrigin = origin && allowedOrigins.includes(origin)
      
      // Permitir se não tem origin (Postman/Insomnia), é domínio permitido, Vercel ou Codespaces
      if (!origin || isAllowedOrigin || isVercelDomain || isGitHubCodespaces) {
        callback(null, true)
        return
      }
      
      // Em produção, logar tentativas bloqueadas
      if (env.NODE_ENV === 'production') {
        console.warn(`⚠️ CORS bloqueou origem: ${origin}`)
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
    exposedHeaders: ['Content-Length', 'X-Request-ID'],
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
}
