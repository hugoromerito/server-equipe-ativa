/**
 * Domain Types - Job Titles & Scheduling
 * 
 * Types and interfaces for job titles and work scheduling
 */

export type WeekDay = 
  | 'monday' 
  | 'tuesday' 
  | 'wednesday' 
  | 'thursday' 
  | 'friday' 
  | 'saturday' 
  | 'sunday'

export interface JobTitle {
  id: string
  name: string
  description: string | null
  organizationId: string
  hourlyRate: number | null
  workingDays: WeekDay[]
  createdAt: Date
  updatedAt: Date
}

export interface MemberWorkingDays {
  memberId: string
  workingDays: WeekDay[]
}

export interface AvailabilitySchedule {
  date: string
  memberId: string
  memberName: string
  available: boolean
}
