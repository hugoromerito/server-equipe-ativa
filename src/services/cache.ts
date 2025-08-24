import { env } from '../config/env.ts'
import { logger } from '../utils/logger.ts'

/**
 * Serviço de cache simples em memória
 * Em produção, deve ser substituído por Redis
 */
class CacheService {
  private cache = new Map<string, { value: unknown; expiresAt?: number }>()
  private isEnabled = false

  constructor() {
    this.isEnabled = env.NODE_ENV === 'production' || env.REDIS_URL !== undefined
    
    if (!this.isEnabled) {
      logger.warn('Cache em memória ativo (apenas para desenvolvimento)')
    }

    // Limpeza automática a cada 5 minutos
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup(): void {
    const now = Date.now()
    let removedCount = 0

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        this.cache.delete(key)
        removedCount++
      }
    }

    if (removedCount > 0) {
      logger.debug(`Cache cleanup: ${removedCount} items removidos`)
    }
  }

  async get<T = string>(key: string): Promise<T | null> {
    if (!this.isEnabled) return null

    try {
      const item = this.cache.get(key)
      
      if (!item) return null

      // Verificar se expirou
      if (item.expiresAt && item.expiresAt < Date.now()) {
        this.cache.delete(key)
        return null
      }

      return item.value as T
    } catch (error) {
      logger.error('Erro ao buscar no cache:', {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlInSeconds?: number
  ): Promise<boolean> {
    if (!this.isEnabled) return false

    try {
      const expiresAt = ttlInSeconds 
        ? Date.now() + (ttlInSeconds * 1000)
        : undefined

      this.cache.set(key, { value, expiresAt })
      return true
    } catch (error) {
      logger.error('Erro ao salvar no cache:', {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isEnabled) return false

    try {
      return this.cache.delete(key)
    } catch (error) {
      logger.error('Erro ao deletar do cache:', {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled) return false

    try {
      const item = this.cache.get(key)
      
      if (!item) return false

      // Verificar se expirou
      if (item.expiresAt && item.expiresAt < Date.now()) {
        this.cache.delete(key)
        return false
      }

      return true
    } catch (error) {
      logger.error('Erro ao verificar existência no cache:', {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  async flush(): Promise<boolean> {
    if (!this.isEnabled) return false

    try {
      this.cache.clear()
      logger.info('Cache limpo completamente')
      return true
    } catch (error) {
      logger.error('Erro ao limpar cache:', {
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  async increment(key: string, increment = 1): Promise<number | null> {
    if (!this.isEnabled) return null

    try {
      const current = await this.get<number>(key) || 0
      const newValue = current + increment
      await this.set(key, newValue)
      return newValue
    } catch (error) {
      logger.error('Erro ao incrementar no cache:', {
        key,
        increment,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  async expire(key: string, ttlInSeconds: number): Promise<boolean> {
    if (!this.isEnabled) return false

    try {
      const item = this.cache.get(key)
      if (!item) return false

      const expiresAt = Date.now() + (ttlInSeconds * 1000)
      this.cache.set(key, { ...item, expiresAt })
      return true
    } catch (error) {
      logger.error('Erro ao definir expiração no cache:', {
        key,
        ttlInSeconds,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  isAvailable(): boolean {
    return this.isEnabled
  }

  getStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache.size,
      enabled: this.isEnabled,
    }
  }

  // Métodos utilitários para chaves padronizadas
  static keys = {
    user: (id: string) => `user:${id}`,
    userPermissions: (userId: string, orgSlug: string, unitSlug?: string) => 
      `permissions:${userId}:${orgSlug}${unitSlug ? `:${unitSlug}` : ''}`,
    organization: (slug: string) => `org:${slug}`,
    unit: (orgSlug: string, unitSlug: string) => `unit:${orgSlug}:${unitSlug}`,
    demand: (id: string) => `demand:${id}`,
    demands: (filters: string) => `demands:${filters}`,
    session: (token: string) => `session:${token}`,
    rateLimit: (ip: string, endpoint: string) => `rate:${ip}:${endpoint}`,
  } as const
}

export const cache = new CacheService()
export { CacheService }
