import { env } from '../config/env.ts'

/**
 * Sistema de logging profissional com diferentes níveis
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const

export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

export interface LogContext {
  [key: string]: unknown
}

class Logger {
  private readonly logLevel: LogLevel

  constructor() {
    this.logLevel = env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.logLevel) return

    const timestamp = new Date().toISOString()
    const levelName = this.getLogLevelName(level)
    
    const logEntry = {
      timestamp,
      level: levelName,
      message,
      ...(context && { context }),
    }

    // Em produção, usar um sistema de logging mais robusto
    if (env.NODE_ENV === 'production') {
      // Aqui você poderia integrar com serviços como Winston, Pino, etc.
      console.log(JSON.stringify(logEntry))
    } else {
      // Em desenvolvimento, formato mais legível
      const contextStr = context ? ` | Context: ${JSON.stringify(context, null, 2)}` : ''
      console.log(`[${timestamp}] ${levelName}: ${message}${contextStr}`)
    }
  }

  private getLogLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return 'DEBUG'
      case LogLevel.INFO: return 'INFO'
      case LogLevel.WARN: return 'WARN'
      case LogLevel.ERROR: return 'ERROR'
      default: return 'UNKNOWN'
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context)
  }

  // Métodos específicos para casos comuns
  apiRequest(method: string, path: string, userId?: string, duration?: number): void {
    this.info('API Request', {
      method,
      path,
      userId,
      duration: duration ? `${duration}ms` : undefined,
    })
  }

  apiError(method: string, path: string, error: Error, userId?: string): void {
    this.error('API Error', {
      method,
      path,
      error: error.message,
      stack: error.stack,
      userId,
    })
  }

  dbQuery(query: string, duration?: number): void {
    this.debug('Database Query', {
      query: query.substring(0, 200), // Limitar tamanho da query no log
      duration: duration ? `${duration}ms` : undefined,
    })
  }

  authAttempt(email: string, success: boolean, ip?: string): void {
    this.info('Authentication Attempt', {
      email,
      success,
      ip,
    })
  }

  fileUpload(filename: string, size: number, type: string, userId: string): void {
    this.info('File Upload', {
      filename,
      size: `${Math.round(size / 1024)}KB`,
      type,
      userId,
    })
  }
}

// Exportar instância singleton
export const logger = new Logger()

// Interceptor para logs de performance
export const withPerformanceLogging = <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = Date.now()
  
  return fn()
    .then((result) => {
      const duration = Date.now() - start
      logger.debug(`Operation completed: ${operation}`, { duration: `${duration}ms` })
      return result
    })
    .catch((error) => {
      const duration = Date.now() - start
      logger.error(`Operation failed: ${operation}`, { 
        duration: `${duration}ms`,
        error: error.message 
      })
      throw error
    })
}
