/**
 * Domain Types - Attachments
 * 
 * Types and interfaces for file attachments
 */

export type AttachmentType = 
  | 'user_avatar' 
  | 'organization_avatar' 
  | 'applicant_avatar' 
  | 'demand_document' 
  | 'applicant_document' 
  | 'organization_document'

export interface Attachment {
  id: string
  filename: string
  contentType: string
  size: number
  url: string
  type: AttachmentType
  entityId: string
  uploadedById: string
  createdAt: Date
}
