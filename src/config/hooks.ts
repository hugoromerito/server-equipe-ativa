/**
 * Application Hooks Configuration
 * 
 * Configures Fastify hooks for:
 * - Request logging
 * - Response logging
 * - User activity tracking
 * - Performance metrics
 */

import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'

import { db } from '../db/connection.ts'
import { users } from '../db/schema/auth.ts'
import { logger } from '../utils/logger.ts'

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number
  }
}

export async function registerHooks(app: FastifyInstance) {
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
}
