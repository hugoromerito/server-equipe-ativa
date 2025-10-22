/**
 * Servidor WebSocket usando Socket.IO
 * 
 * Gerencia conexões em tempo real para atualizações de demandas,
 * organizando clientes em salas por organização e unidade.
 */

import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'node:http'
import { logger } from '../utils/logger.ts'
import {
  type TypedSocket,
  type TypedSocketServer,
  getOrganizationRoom,
  getUnitRoom,
} from '../types/socket.ts'
import { env } from '../config/env.ts'

let io: TypedSocketServer | null = null

/**
 * Inicializa o servidor Socket.IO
 */
export function initializeSocketServer(httpServer: HTTPServer): TypedSocketServer {
  if (io) {
    logger.warn('Socket.IO já foi inicializado')
    return io
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Em produção, permitir todos os origins (ou especifique os domínios permitidos)
        if (env.NODE_ENV === 'production') {
          callback(null, true)
          return
        }
        
        // Em desenvolvimento, permitir localhost e domínios Vercel
        const allowedOrigins = [
          'http://localhost:3000', 
          'http://localhost:3333', 
          'http://localhost:5173'
        ]
        
        // Adicionar domínios customizados da variável de ambiente
        if (env.ALLOWED_ORIGINS) {
          const customOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
          allowedOrigins.push(...customOrigins)
        }
        
        // Verificar se o origin é da Vercel
        const isVercelDomain = origin && (
          origin.endsWith('.vercel.app') ||
          origin.endsWith('.vercel.com')
        )
        
        const isAllowedOrigin = origin && allowedOrigins.includes(origin)
        
        if (!origin || isVercelDomain || isAllowedOrigin) {
          callback(null, true)
          return
        }
        
        callback(new Error('Não permitido pelo CORS'), false)
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  })

  // Handler para novas conexões
  io.on('connection', (socket: TypedSocket) => {
    logger.info('Cliente conectado ao WebSocket', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
    })

    // Enviar confirmação de conexão
    socket.emit('connected', {
      message: 'Conectado ao servidor WebSocket',
      timestamp: new Date(),
    })

    // Handler: Cliente entra em sala de organização
    socket.on('join-organization', (organizationSlug: string) => {
      const room = getOrganizationRoom(organizationSlug)
      socket.join(room)
      
      logger.info('Cliente entrou na sala da organização', {
        socketId: socket.id,
        organizationSlug,
        room,
      })
    })

    // Handler: Cliente sai de sala de organização
    socket.on('leave-organization', (organizationSlug: string) => {
      const room = getOrganizationRoom(organizationSlug)
      socket.leave(room)
      
      logger.info('Cliente saiu da sala da organização', {
        socketId: socket.id,
        organizationSlug,
        room,
      })
    })

    // Handler: Cliente entra em sala de unidade
    socket.on('join-unit', ({ organizationSlug, unitSlug }) => {
      const room = getUnitRoom(organizationSlug, unitSlug)
      socket.join(room)
      
      logger.info('Cliente entrou na sala da unidade', {
        socketId: socket.id,
        organizationSlug,
        unitSlug,
        room,
      })
    })

    // Handler: Cliente sai de sala de unidade
    socket.on('leave-unit', ({ organizationSlug, unitSlug }) => {
      const room = getUnitRoom(organizationSlug, unitSlug)
      socket.leave(room)
      
      logger.info('Cliente saiu da sala da unidade', {
        socketId: socket.id,
        organizationSlug,
        unitSlug,
        room,
      })
    })

    // Handler: Ping para manter conexão ativa
    socket.on('ping', () => {
      logger.debug('Ping recebido', { socketId: socket.id })
    })

    // Handler: Desconexão
    socket.on('disconnect', (reason) => {
      logger.info('Cliente desconectado do WebSocket', {
        socketId: socket.id,
        reason,
      })
    })

    // Handler: Erro
    socket.on('error', (error) => {
      logger.error('Erro no socket', {
        socketId: socket.id,
        error: error.message,
      })
    })
  })

  logger.info('✅ Servidor Socket.IO inicializado')

  return io
}

/**
 * Retorna a instância do servidor Socket.IO
 */
export function getSocketServer(): TypedSocketServer {
  if (!io) {
    throw new Error('Socket.IO não foi inicializado. Chame initializeSocketServer() primeiro.')
  }
  return io
}

/**
 * Emite evento para todos os clientes de uma sala de organização
 */
export function emitToOrganization<K extends keyof import('../types/socket.ts').ServerToClientEvents>(
  organizationSlug: string,
  event: K,
  data: Parameters<import('../types/socket.ts').ServerToClientEvents[K]>[0]
) {
  const room = getOrganizationRoom(organizationSlug)
  
  if (!io) {
    logger.error('Socket.IO não inicializado')
    return
  }

  // @ts-expect-error - Socket.IO types are complex with acknowledgements
  io.to(room).emit(event, data)
  
  logger.debug('Evento emitido para organização', {
    organizationSlug,
    room,
    event,
  })
}

/**
 * Emite evento para todos os clientes de uma sala de unidade
 */
export function emitToUnit<K extends keyof import('../types/socket.ts').ServerToClientEvents>(
  organizationSlug: string,
  unitSlug: string,
  event: K,
  data: Parameters<import('../types/socket.ts').ServerToClientEvents[K]>[0]
) {
  const room = getUnitRoom(organizationSlug, unitSlug)
  
  if (!io) {
    logger.error('Socket.IO não inicializado')
    return
  }

  // @ts-expect-error - Socket.IO types are complex with acknowledgements
  io.to(room).emit(event, data)
  
  logger.debug('Evento emitido para unidade', {
    organizationSlug,
    unitSlug,
    room,
    event,
  })
}

/**
 * Fecha o servidor Socket.IO
 */
export async function closeSocketServer(): Promise<void> {
  if (!io) {
    return
  }

  return new Promise((resolve) => {
    io?.close(() => {
      logger.info('Servidor Socket.IO fechado')
      io = null
      resolve()
    })
  })
}
