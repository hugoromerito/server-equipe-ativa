/**
 * Constantes centralizadas da aplicação
 * Seguindo as melhores práticas de Clean Code
 */

import { env } from './env.ts'

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
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

// Configurações da API
export const API_VERSION = '1.0.0'
export const NODE_ENV = env.NODE_ENV
export const PORT = env.PORT

// Configurações de autenticação
export const AUTH_TOKEN_EXPIRES_IN = env.JWT_EXPIRES_IN
export const JWT_SECRET = env.JWT_SECRET

// Configurações de paginação
export const DEFAULT_PAGINATION_LIMIT = 20
export const MAX_PAGINATION_LIMIT = 100

// Configurações de arquivo
export const MAX_FILE_SIZE = env.MAX_FILE_SIZE
export const MAX_FILES_PER_UPLOAD = env.MAX_FILES_PER_UPLOAD

export const FILE_LIMITS = {
  MAX_FILE_SIZE: {
    AVATAR: 2 * 1024 * 1024, // 2MB
    DOCUMENT: 10 * 1024 * 1024, // 10MB
    IDENTITY: 5 * 1024 * 1024, // 5MB
    ADDRESS: 5 * 1024 * 1024, // 5MB
    INCOME: 5 * 1024 * 1024, // 5MB
    MEDICAL: 10 * 1024 * 1024, // 10MB
    LEGAL: 10 * 1024 * 1024, // 10MB
    OTHER: 10 * 1024 * 1024, // 10MB
  },
  ALLOWED_MIME_TYPES: {
    IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    DOCUMENTS: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
    ],
  },
} as const

export const VALIDATION_RULES = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  },
  EMAIL: {
    MAX_LENGTH: 255,
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
  },
  SLUG: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
  CPF: {
    LENGTH: 11,
  },
} as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

export const JWT_CONFIG = {
  DEFAULT_EXPIRES_IN: '7d',
  ALGORITHM: 'HS256',
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
  ],
} as const

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
