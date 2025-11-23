/**
 * Domain Types - Demand Management
 * 
 * Types and interfaces for demand and applicant management
 */

export type DemandStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'waiting_approval' 
  | 'approved' 
  | 'rejected' 
  | 'cancelled' 
  | 'completed'

export type DemandPriority = 'low' | 'medium' | 'high' | 'urgent'

export type DemandCategory = 
  | 'maintenance' 
  | 'installation' 
  | 'inspection' 
  | 'repair' 
  | 'other'

export interface Demand {
  id: string
  title: string
  description: string | null
  status: DemandStatus
  priority: DemandPriority
  category: DemandCategory
  organizationId: string
  applicantId: string
  assignedMemberId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Applicant {
  id: string
  name: string
  email: string
  phone: string | null
  cpf: string
  avatarUrl: string | null
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

export interface DemandStatusAuditLog {
  id: string
  demandId: string
  previousStatus: DemandStatus | null
  newStatus: DemandStatus
  changedBy: string
  reason: string | null
  createdAt: Date
}
