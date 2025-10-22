import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { getSocketServer } from '../../../lib/socket-server.ts'

/**
 * Rota para obter informações sobre o servidor WebSocket
 */
export const websocketInfoRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/websocket/info',
    {
      schema: {
        tags: ['WebSocket'],
        summary: 'Informações do WebSocket',
        description: 'Retorna informações sobre o servidor WebSocket e conexões ativas',
        response: {
          200: z.object({
            active: z.boolean(),
            connectedClients: z.number(),
            rooms: z.array(z.string()),
            timestamp: z.string(),
          }),
        },
      },
    },
    async (_request, reply) => {
      try {
        const io = getSocketServer()
        const sockets = await io.fetchSockets()
        const rooms = new Set<string>()

        // Coletar todas as salas
        for (const socket of sockets) {
          for (const room of socket.rooms) {
            // Ignorar sala privada do socket (room === socket.id)
            if (room !== socket.id) {
              rooms.add(room)
            }
          }
        }

        return reply.send({
          active: true,
          connectedClients: sockets.length,
          rooms: Array.from(rooms).sort(),
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        return reply.send({
          active: false,
          connectedClients: 0,
          rooms: [],
          timestamp: new Date().toISOString(),
        })
      }
    }
  )
}
