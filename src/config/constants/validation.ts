/**
 * Validation Constants
 * 
 * Constants for data validation rules
 */

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
    PATTERN: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
  TITLE: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 200,
  },
  CPF: {
    LENGTH: 11,
  },
  PHONE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 11,
  },
  CODE: {
    LENGTH: 6,
  },
} as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

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
    ALL: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
    ],
  },
} as const
