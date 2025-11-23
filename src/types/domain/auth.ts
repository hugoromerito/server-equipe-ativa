/**
 * Domain Types - User & Authentication
 * 
 * Types and interfaces for user authentication and management
 */

export interface User {
  id: string
  name: string | null
  email: string
  passwordHash: string | null
  avatarUrl: string | null
  lastSeen: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Account {
  id: string
  provider: 'GITHUB' | 'GOOGLE'
  providerAccountId: string
  userId: string
}

export interface Token {
  id: string
  type: 'PASSWORD_RECOVER'
  userId: string
  createdAt: Date
}

export interface AuthPayload {
  sub: string
  email: string
  name: string | null
}
