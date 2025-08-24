import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import { cache, CacheService } from '../../services/cache.ts'
import { logger } from '../../utils/logger.ts'
import { TooManyRequestsError } from '../routes/_errors/too-many-requests-error.ts'

interface RateLimitOptions {
  max: number // Máximo de requests
  windowMs: number // Janela de tempo em milissegundos
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (request: FastifyRequest) => string
}

const defaultKeyGenerator = (request: FastifyRequest): string => {
  const forwarded = request.headers['x-forwarded-for']
  const ip = forwarded ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]) : request.ip
  return `${ip}:${request.routeOptions.url || request.url}`
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const {
    max,
    windowMs,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
  } = options

  const windowSeconds = Math.ceil(windowMs / 1000)

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const key = CacheService.keys.rateLimit(keyGenerator(request), Date.now().toString().slice(0, -3))
      
      // Se o cache não estiver disponível, permitir a requisição
      if (!cache.isAvailable()) {
        logger.warn('Rate limit desabilitado: cache não disponível')
        return
      }

      const current = await cache.get<number>(key) || 0

      if (current >= max) {
        logger.warn(`Rate limit excedido para ${key}: ${current}/${max}`)
        throw new TooManyRequestsError(
          `Muitas requisições. Tente novamente em ${Math.ceil(windowSeconds / 60)} minuto(s).`
        )
      }

      // Incrementar contador
      const newCount = await cache.increment(key, 1)
      
      // Definir expiração apenas na primeira requisição
      if (newCount === 1) {
        await cache.expire(key, windowSeconds)
      }

      // Headers informativos
      reply.header('X-RateLimit-Limit', max)
      reply.header('X-RateLimit-Remaining', Math.max(0, max - (newCount || 0)))
      reply.header('X-RateLimit-Reset', Date.now() + windowMs)

      // Hook para remover do contador em caso de erro (se configurado)
      if (skipFailedRequests) {
        reply.raw.on('finish', () => {
          if (reply.statusCode >= 400) {
            cache.increment(key, -1).catch((error) => {
              logger.error('Erro ao decrementar rate limit:', { 
                key, 
                error: error instanceof Error ? error.message : String(error) 
              })
            })
          }
        })
      }

      // Hook para remover do contador em caso de sucesso (se configurado)
      if (skipSuccessfulRequests) {
        reply.raw.on('finish', () => {
          if (reply.statusCode < 400) {
            cache.increment(key, -1).catch((error) => {
              logger.error('Erro ao decrementar rate limit:', { 
                key, 
                error: error instanceof Error ? error.message : String(error) 
              })
            })
          }
        })
      }
    } catch (error) {
      if (error instanceof TooManyRequestsError) {
        throw error
      }
      
      logger.error('Erro no middleware de rate limit:', {
        error: error instanceof Error ? error.message : String(error)
      })
      // Em caso de erro no rate limit, permitir a requisição
    }
  }
}

// Configurações pré-definidas para diferentes tipos de endpoint
export const rateLimitConfigs = {
  // Rate limit geral - 100 requests por minuto
  general: {
    max: 100,
    windowMs: 60 * 1000, // 1 minuto
  },

  // Rate limit para autenticação - 5 tentativas por minuto
  auth: {
    max: 5,
    windowMs: 60 * 1000, // 1 minuto
    skipSuccessfulRequests: true, // Não contar logins bem-sucedidos
  },

  // Rate limit para criação de recursos - 20 requests por minuto
  create: {
    max: 20,
    windowMs: 60 * 1000, // 1 minuto
  },

  // Rate limit para upload de arquivos - 10 uploads por minuto
  upload: {
    max: 10,
    windowMs: 60 * 1000, // 1 minuto
  },

  // Rate limit para busca/listagem - 200 requests por minuto
  read: {
    max: 200,
    windowMs: 60 * 1000, // 1 minuto
  },

  // Rate limit estrito para operações sensíveis - 3 requests por minuto
  strict: {
    max: 3,
    windowMs: 60 * 1000, // 1 minuto
  },
} as const

// Middlewares prontos para usar
export const rateLimitMiddleware = {
  general: createRateLimitMiddleware(rateLimitConfigs.general),
  auth: createRateLimitMiddleware(rateLimitConfigs.auth),
  create: createRateLimitMiddleware(rateLimitConfigs.create),
  upload: createRateLimitMiddleware(rateLimitConfigs.upload),
  read: createRateLimitMiddleware(rateLimitConfigs.read),
  strict: createRateLimitMiddleware(rateLimitConfigs.strict),
}

// Plugin para registrar rate limiting globalmente
export async function rateLimitPlugin(app: FastifyInstance) {
  // Rate limit geral para todas as rotas
  app.addHook('preHandler', rateLimitMiddleware.general)
  
  logger.info('Rate limiting ativado globalmente')
}
