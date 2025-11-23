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

console.log('🚀 Iniciando servidor...')

import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

console.log('📦 Carregando configurações...')
import { env, SWAGGER_CONFIG } from './config/index.ts'
import { registerPlugins } from './config/plugins.ts'
import { registerRoutes } from './config/routes.ts'
import { registerHooks } from './config/hooks.ts'
console.log('✅ Configurações carregadas')

import { logger } from './utils/logger.ts'
console.log('🔌 Carregando socket server...')
import { initializeSocketServer, closeSocketServer } from './lib/socket-server.ts'
console.log('✅ Socket server carregado')

import { auth } from './http/middlewares/auth.ts'
import { errorHandler } from './http/routes/_errors/error-handler.ts'

console.log('✅ Módulos carregados')

// Função para criar a aplicação
async function createApp() {
  console.log('🏗️  Criando aplicação Fastify...')
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

  // Configurar validação e serialização
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Registrar todos os plugins (CORS, JWT, Swagger, etc)
  await registerPlugins(app)

  // Registrar hooks (logging, métricas, etc)
  await registerHooks(app)

  // Registrar plugin de autenticação
  await app.register(auth)

  // Registrar todas as rotas
  await registerRoutes(app)

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
      // Fechar servidor Socket.IO primeiro
      await closeSocketServer()
      
      // Depois fechar o servidor HTTP/Fastify
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

    // Iniciar servidor HTTP
    await app.listen({ 
      port: env.PORT, 
      host: env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' 
    })

    // Inicializar servidor Socket.IO
    const httpServer = app.server
    initializeSocketServer(httpServer)
    
    logger.info(`🚀 Servidor rodando em http://localhost:${env.PORT}`)
    logger.info(`📚 Documentação disponível em http://localhost:${env.PORT}/docs`)
    logger.info(`🏥 Health check disponível em http://localhost:${env.PORT}/health`)
    logger.info(`🔌 WebSocket disponível em ws://localhost:${env.PORT}`)
    
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
const isMainModule = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`
if (isMainModule) {
  startServer()
}

export { createApp, startServer }
