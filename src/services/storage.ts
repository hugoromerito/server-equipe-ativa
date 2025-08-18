import crypto from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.ts'

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
})

export interface UploadResult {
  key: string
  url: string
  originalName: string
  size: number
  mimeType: string
  encrypted: boolean
}

export type AttachmentType =
  | 'avatar'
  | 'document'
  | 'identity'
  | 'address'
  | 'income'
  | 'medical'
  | 'legal'
  | 'other'

export class StorageService {
  private generateKey(
    originalName: string,
    organizationId: string,
    type: AttachmentType,
    entityId?: string
  ): string {
    const timestamp = Date.now()
    const randomId = crypto.randomUUID()
    const extension = originalName.split('.').pop()

    const basePath = entityId
      ? `${type}/${organizationId}/${entityId}`
      : `${type}/${organizationId}`

    return `${basePath}/${timestamp}-${randomId}.${extension}`
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    organizationId: string,
    type: AttachmentType = 'document',
    entityId?: string
  ): Promise<UploadResult> {
    const key = this.generateKey(originalName, organizationId, type, entityId)

    const command = new PutObjectCommand({
      Bucket: env.AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalName,
        organizationId,
        type,
        entityId: entityId || '',
        uploadedAt: new Date().toISOString(),
      },
    })

    const response = await s3Client.send(command)

    const url = `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`

    return {
      key,
      url,
      originalName,
      size: buffer.length,
      mimeType,
      encrypted: !!response.ServerSideEncryption,
    }
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: env.AWS_BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)
  }

  async getSignedDownloadUrl(
    key: string,
    // expiresIn: number = 3600
    expiresIn: 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.AWS_BUCKET_NAME,
      Key: key,
    })

    return await getSignedUrl(s3Client, command, { expiresIn })
  }
}

export const storageService = new StorageService()
