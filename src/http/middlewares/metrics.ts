import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import { logger } from '../../utils/logger.ts'

interface MetricData {
  method: string
  route: string
  statusCode: number
  responseTime: number
  timestamp: number
  userAgent?: string
  ip?: string
  userId?: string
}

interface RouteMetrics {
  count: number
  totalTime: number
  avgTime: number
  minTime: number
  maxTime: number
  errors: number
  lastAccess: number
}

class MetricsService {
  private metrics = new Map<string, RouteMetrics>()
  private recentRequests: MetricData[] = []
  private maxRecentRequests = 1000

  constructor() {
    // Limpeza automática a cada 10 minutos
    setInterval(() => {
      this.cleanup()
    }, 10 * 60 * 1000)
  }

  private cleanup(): void {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    // Manter apenas requests da última hora
    this.recentRequests = this.recentRequests.filter(
      req => req.timestamp > oneHourAgo
    )

    // Limitar o número de requests recentes
    if (this.recentRequests.length > this.maxRecentRequests) {
      this.recentRequests = this.recentRequests.slice(-this.maxRecentRequests)
    }

    logger.debug(`Metrics cleanup: ${this.recentRequests.length} requests mantidos`)
  }

  recordRequest(data: MetricData): void {
    const routeKey = `${data.method} ${data.route}`
    
    // Atualizar métricas da rota
    const existing = this.metrics.get(routeKey)
    
    if (existing) {
      existing.count++
      existing.totalTime += data.responseTime
      existing.avgTime = existing.totalTime / existing.count
      existing.minTime = Math.min(existing.minTime, data.responseTime)
      existing.maxTime = Math.max(existing.maxTime, data.responseTime)
      existing.lastAccess = data.timestamp
      
      if (data.statusCode >= 400) {
        existing.errors++
      }
    } else {
      this.metrics.set(routeKey, {
        count: 1,
        totalTime: data.responseTime,
        avgTime: data.responseTime,
        minTime: data.responseTime,
        maxTime: data.responseTime,
        errors: data.statusCode >= 400 ? 1 : 0,
        lastAccess: data.timestamp,
      })
    }

    // Adicionar aos requests recentes
    this.recentRequests.push(data)
    
    // Log de requests lentos
    if (data.responseTime > 5000) { // > 5 segundos
      logger.warn('Request lento detectado:', {
        route: routeKey,
        responseTime: data.responseTime,
        statusCode: data.statusCode,
        userId: data.userId,
      })
    }

    // Log de erros
    if (data.statusCode >= 500) {
      logger.error('Erro interno detectado:', {
        route: routeKey,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        userId: data.userId,
        userAgent: data.userAgent,
        ip: data.ip,
      })
    }
  }

  getMetrics(): Record<string, RouteMetrics> {
    return Object.fromEntries(this.metrics.entries())
  }

  getRouteMetrics(method: string, route: string): RouteMetrics | null {
    return this.metrics.get(`${method} ${route}`) || null
  }

  getRecentRequests(limit = 100): MetricData[] {
    return this.recentRequests.slice(-limit)
  }

  getErrorRate(timeWindowMs = 60 * 60 * 1000): number {
    const now = Date.now()
    const windowStart = now - timeWindowMs
    
    const recentRequests = this.recentRequests.filter(
      req => req.timestamp > windowStart
    )
    
    if (recentRequests.length === 0) return 0
    
    const errors = recentRequests.filter(req => req.statusCode >= 400).length
    return (errors / recentRequests.length) * 100
  }

  getAverageResponseTime(timeWindowMs = 60 * 60 * 1000): number {
    const now = Date.now()
    const windowStart = now - timeWindowMs
    
    const recentRequests = this.recentRequests.filter(
      req => req.timestamp > windowStart
    )
    
    if (recentRequests.length === 0) return 0
    
    const totalTime = recentRequests.reduce((sum, req) => sum + req.responseTime, 0)
    return totalTime / recentRequests.length
  }

  getRequestsPerMinute(timeWindowMs = 60 * 60 * 1000): number {
    const now = Date.now()
    const windowStart = now - timeWindowMs
    
    const recentRequests = this.recentRequests.filter(
      req => req.timestamp > windowStart
    )
    
    const windowMinutes = timeWindowMs / (60 * 1000)
    return recentRequests.length / windowMinutes
  }

  getSummary(): {
    totalRequests: number
    errorRate: number
    avgResponseTime: number
    requestsPerMinute: number
    topRoutes: Array<{ route: string; metrics: RouteMetrics }>
    slowestRoutes: Array<{ route: string; avgTime: number }>
  } {
    const totalRequests = this.recentRequests.length
    const errorRate = this.getErrorRate()
    const avgResponseTime = this.getAverageResponseTime()
    const requestsPerMinute = this.getRequestsPerMinute()

    // Top rotas por número de requests
    const topRoutes = Array.from(this.metrics.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([route, metrics]) => ({ route, metrics }))

    // Rotas mais lentas
    const slowestRoutes = Array.from(this.metrics.entries())
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 10)
      .map(([route, metrics]) => ({ route, avgTime: metrics.avgTime }))

    return {
      totalRequests,
      errorRate,
      avgResponseTime,
      requestsPerMinute,
      topRoutes,
      slowestRoutes,
    }
  }

  reset(): void {
    this.metrics.clear()
    this.recentRequests = []
    logger.info('Métricas resetadas')
  }
}

export const metricsService = new MetricsService()

// Middleware para coletar métricas
export async function metricsMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now()

  // Hook para capturar o final da resposta
  reply.raw.on('finish', () => {
    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Extrair informações do request
    const forwarded = request.headers['x-forwarded-for']
    const ip = forwarded 
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
      : request.ip

    const route = request.routeOptions?.url || request.url
    const userAgent = request.headers['user-agent']

    // Tentar extrair userId se disponível
    let userId: string | undefined
    try {
      userId = (request as any).getCurrentUserId?.() || undefined
    } catch {
      // Usuário não autenticado ou erro ao obter
    }

    const metricData: MetricData = {
      method: request.method,
      route,
      statusCode: reply.statusCode,
      responseTime,
      timestamp: endTime,
      userAgent,
      ip,
      userId,
    }

    metricsService.recordRequest(metricData)
  })
}

// Plugin para registrar métricas
export async function metricsPlugin(app: FastifyInstance): Promise<void> {
  // Registrar middleware de métricas
  app.addHook('preHandler', metricsMiddleware)

  // Rota para visualizar métricas (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    app.get('/metrics', {
      schema: {
        tags: ['System'],
        summary: 'Métricas do sistema',
        description: 'Retorna métricas de performance e uso do sistema',
      }
    }, async (request, reply) => {
      const summary = metricsService.getSummary()
      const recentRequests = metricsService.getRecentRequests(50)
      
      return reply.send({
        summary,
        recentRequests,
        timestamp: new Date().toISOString(),
      })
    })

    app.post('/metrics/reset', {
      schema: {
        tags: ['System'],
        summary: 'Reset das métricas',
        description: 'Limpa todas as métricas coletadas',
      }
    }, async (request, reply) => {
      metricsService.reset()
      return reply.send({ message: 'Métricas resetadas com sucesso' })
    })
  }

  logger.info('Sistema de métricas ativado')
}

export { MetricsService }
