import type { MultipartFile } from '@fastify/multipart'
import type { FastifyRequest } from 'fastify'
import type { AttachmentType } from '../../services/storage.ts'
import { BadRequestError } from '../routes/_errors/bad-request-error.ts'

export interface FileUpload {
  buffer: Buffer
  filename: string
  mimetype: string
  size: number
}

const ALLOWED_MIME_TYPES = {
  avatar: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  identity: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  address: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  income: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  medical: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  legal: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  other: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
}

const MAX_FILE_SIZES = {
  avatar: 2 * 1024 * 1024, // 2MB para avatars
  document: 10 * 1024 * 1024, // 10MB para documentos
  identity: 5 * 1024 * 1024, // 5MB para identidade
  address: 5 * 1024 * 1024, // 5MB para endereço
  income: 5 * 1024 * 1024, // 5MB para renda
  medical: 10 * 1024 * 1024, // 10MB para médicos
  legal: 10 * 1024 * 1024, // 10MB para legais
  other: 10 * 1024 * 1024, // 10MB para outros
}

interface FastifyRequestWithFile extends FastifyRequest {
  file(): Promise<MultipartFile | undefined>
}

export async function processFileUpload(
  request: FastifyRequestWithFile,
  attachmentType: AttachmentType = 'document'
): Promise<FileUpload> {
  const data = await request.file()

  if (!data) {
    throw new BadRequestError('Nenhum arquivo foi enviado.')
  }

  // Validar tipo de arquivo
  const allowedTypes = ALLOWED_MIME_TYPES[attachmentType]
  if (!allowedTypes.includes(data.mimetype)) {
    throw new BadRequestError(
      `Tipo de arquivo não permitido para ${attachmentType}. Tipos aceitos: ${allowedTypes.join(', ')}.`
    )
  }

  // Validar tamanho do arquivo
  const maxSize = MAX_FILE_SIZES[attachmentType]
  const buffer = await data.toBuffer()

  if (buffer.length > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    throw new BadRequestError(
      `Arquivo muito grande para ${attachmentType}. Limite: ${maxSizeMB}MB.`
    )
  }

  // Validar se tem nome
  if (!data.filename) {
    throw new BadRequestError('Nome do arquivo é obrigatório.')
  }

  return {
    buffer,
    filename: data.filename,
    mimetype: data.mimetype,
    size: buffer.length,
  }
}
