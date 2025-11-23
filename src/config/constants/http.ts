/**
 * HTTP Constants
 * 
 * Constants related to HTTP status codes, headers, and responses
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export const RATE_LIMIT = {
  AUTH: {
    MAX_REQUESTS: 5,
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
  },
  UPLOAD: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 5 * 60 * 1000, // 5 minutos
  },
  GENERAL: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
  },
} as const

export const SWAGGER_CONFIG = {
  TITLE: 'Equipe Ativa API',
  DESCRIPTION: 'Documentação da API Equipe Ativa - Sistema de gerenciamento de equipes e organizações',
  VERSION: '1.0.0',
  TAGS: [
    { name: 'Auth', description: 'Operações de autenticação e autorização' },
    { name: 'Organizations', description: 'Gerenciamento de organizações' },
    { name: 'Units', description: 'Gerenciamento de unidades organizacionais' },
    { name: 'Users', description: 'Gerenciamento de usuários' },
    { name: 'Members', description: 'Gerenciamento de membros' },
    { name: 'Invites', description: 'Gerenciamento de convites' },
    { name: 'Applicants', description: 'Gerenciamento de solicitantes' },
    { name: 'Demands', description: 'Gerenciamento de demandas' },
    { name: 'Attachments', description: 'Gerenciamento de anexos e uploads' },
    { name: 'Billing', description: 'Gerenciamento de cobranças e assinaturas' },
    { name: 'Job Titles', description: 'Gerenciamento de cargos' },
    { name: 'TV Access', description: 'Sistema de acesso via TV' },
    { name: 'WebSocket', description: 'Comunicação em tempo real' },
    { name: 'System', description: 'Endpoints do sistema' },
  ],
} as const

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
