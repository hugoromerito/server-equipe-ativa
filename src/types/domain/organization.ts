/**
 * Domain Types - Organization
 * 
 * Types and interfaces for organization-related entities
 */

export interface Organization {
  id: string
  name: string
  slug: string
  domain: string | null
  shouldAttachUsersByDomain: boolean
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
  ownerId: string
}

export interface Unit {
  id: string
  name: string
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

export interface Member {
  id: string
  userId: string
  organizationId: string
  unitId: string | null
  jobTitleId: string | null
  role: 'ADMIN' | 'MEMBER' | 'ANALYST' | 'BILLING'
  createdAt: Date
  updatedAt: Date
}

export interface Invite {
  id: string
  email: string
  role: 'ADMIN' | 'MEMBER' | 'ANALYST' | 'BILLING'
  unitId: string | null
  jobTitleId: string | null
  organizationId: string
  authorId: string
  createdAt: Date
}
