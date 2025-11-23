/**
 * Constants Module
 * 
 * Centralized exports for all application constants organized by domain
 */

export * from './http.ts'
export * from './validation.ts'
export * from './business.ts'

// Re-export legacy flat structure for backward compatibility
// TODO: Gradually migrate to using specific imports
import { env } from '../env.ts'

export const API_VERSION = '1.0.0'
export const NODE_ENV = env.NODE_ENV
export const PORT = env.PORT
export const AUTH_TOKEN_EXPIRES_IN = env.JWT_EXPIRES_IN
export const JWT_SECRET = env.JWT_SECRET
export const MAX_FILE_SIZE = env.MAX_FILE_SIZE
export const MAX_FILES_PER_UPLOAD = env.MAX_FILES_PER_UPLOAD
export const DEFAULT_PAGINATION_LIMIT = 20
export const MAX_PAGINATION_LIMIT = 100
