/**
 * Tipos e interfaces para o sistema de WebSocket
 * 
 * Define a estrutura de eventos, payloads e salas do Socket.IO
 */

import type { Socket as SocketIOSocket, Server as SocketIOServer } from 'socket.io'

/**
 * Dados do paciente chamado para atendimento
 */
export interface PatientCalledData {
  /** ID da demanda */
  demandId: string
  /** Nome do paciente (applicant) */
  patientName: string
  /** Nome do profissional responsável */
  memberName: string
  /** Cargo/título do profissional */
  jobTitle: string | null
  /** Status da demanda (deve ser 'IN_PROGRESS') */
  status: string
  /** Prioridade da demanda */
  priority: string
  /** Data/hora da chamada */
  calledAt: Date
  /** ID da unidade */
  unitId: string
  /** Slug da unidade */
  unitSlug: string
  /** ID da organização */
  organizationId: string
}

/**
 * Eventos emitidos pelo servidor para os clientes
 */
export interface ServerToClientEvents {
  /** Paciente foi chamado para atendimento */
  'patient-called': (data: PatientCalledData) => void
  
  /** Status da demanda foi atualizado */
  'demand-status-updated': (data: {
    demandId: string
    status: string
    updatedAt: Date
  }) => void
  
  /** Confirmação de conexão */
  'connected': (data: { message: string; timestamp: Date }) => void
}

/**
 * Eventos enviados pelos clientes para o servidor
 */
export interface ClientToServerEvents {
  /** Cliente entra em uma sala de organização */
  'join-organization': (organizationSlug: string) => void
  
  /** Cliente sai de uma sala de organização */
  'leave-organization': (organizationSlug: string) => void
  
  /** Cliente entra em uma sala de unidade */
  'join-unit': (data: { organizationSlug: string; unitSlug: string }) => void
  
  /** Cliente sai de uma sala de unidade */
  'leave-unit': (data: { organizationSlug: string; unitSlug: string }) => void
  
  /** Ping para manter conexão ativa */
  'ping': () => void
}

/**
 * Socket tipado com eventos customizados
 */
export type TypedSocket = SocketIOSocket<ClientToServerEvents, ServerToClientEvents>

/**
 * Servidor Socket.IO tipado
 */
export type TypedSocketServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>

/**
 * Função para gerar nome de sala por organização
 */
export function getOrganizationRoom(organizationSlug: string): string {
  return `org:${organizationSlug}`
}

/**
 * Função para gerar nome de sala por unidade
 */
export function getUnitRoom(organizationSlug: string, unitSlug: string): string {
  return `org:${organizationSlug}:unit:${unitSlug}`
}
