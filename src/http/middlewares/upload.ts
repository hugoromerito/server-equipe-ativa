import type { MultipartFile } from '@fastify/multipart'
import type { FastifyRequest } from 'fastify'
import { FILE_LIMITS } from '../../config/constants.ts'
import type { AttachmentType } from '../../services/storage.ts'
import { logger } from '../../utils/logger.ts'
import { BadRequestError } from '../routes/_errors/bad-request-error.ts'

export interface FileUpload {
  filename: string
  buffer: Buffer
  mimetype: string
  size: number
}

/**
 * Tipos MIME permitidos por categoria de arquivo
 */
const ALLOWED_MIME_TYPES: Record<AttachmentType, string[]> = {
  avatar: [...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES],
  document: [
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.DOCUMENTS,
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES,
  ],
  identity: [
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.DOCUMENTS,
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES,
  ],
  address: [
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.DOCUMENTS,
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES,
  ],
  income: [
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.DOCUMENTS,
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES,
  ],
  medical: [
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.DOCUMENTS,
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES,
  ],
  legal: [
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.DOCUMENTS,
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES,
  ],
  other: [
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.DOCUMENTS,
    ...FILE_LIMITS.ALLOWED_MIME_TYPES.IMAGES,
  ],
}

/**
 * Processa upload de arquivo com validações robustas
 * @param request - Requisição Fastify
 * @param attachmentType - Tipo de anexo para validação específica
 * @returns Promise<FileUpload> - Dados do arquivo processado
 * @throws BadRequestError quando arquivo inválido
 */
export async function processFileUpload(
  request: FastifyRequest,
  attachmentType: AttachmentType = 'document'
): Promise<FileUpload> {
  try {
    const file = await request.file()
    
    if (!file) {
      throw new BadRequestError('Nenhum arquivo foi enviado')
    }

    // Validar nome do arquivo
    if (!file.filename || file.filename.trim().length === 0) {
      throw new BadRequestError('Nome do arquivo é obrigatório')
    }

    // Validar extensão do arquivo
    const fileExtension = file.filename.toLowerCase().split('.').pop()
    if (!fileExtension) {
      throw new BadRequestError('Arquivo deve ter uma extensão válida')
    }

    // Validar tipo MIME
    const allowedMimeTypes = ALLOWED_MIME_TYPES[attachmentType]
    if (!allowedMimeTypes.includes(file.mimetype)) {
      const allowedExtensions = allowedMimeTypes
        .map(mime => {
          switch (mime) {
            case 'image/jpeg': return 'jpg, jpeg'
            case 'image/png': return 'png'
            case 'image/webp': return 'webp'
            case 'application/pdf': return 'pdf'
            case 'application/msword': return 'doc'
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx'
            case 'text/plain': return 'txt'
            case 'text/csv': return 'csv'
            default: return mime
          }
        })
        .join(', ')
      
      throw new BadRequestError(
        `Tipo de arquivo não permitido para ${attachmentType}. Tipos aceitos: ${allowedExtensions}`
      )
    }

    // Validar tamanho do arquivo
    const maxSize = FILE_LIMITS.MAX_FILE_SIZE[attachmentType.toUpperCase() as keyof typeof FILE_LIMITS.MAX_FILE_SIZE]
    
    // Converter arquivo para buffer para verificar tamanho real
    const buffer = await file.toBuffer()
    
    if (buffer.length > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      const fileSizeMB = Math.round(buffer.length / (1024 * 1024))
      
      throw new BadRequestError(
        `Arquivo muito grande. Tamanho atual: ${fileSizeMB}MB. Tamanho máximo permitido para ${attachmentType}: ${maxSizeMB}MB`
      )
    }

    // Validar se o arquivo não está vazio
    if (buffer.length === 0) {
      throw new BadRequestError('Arquivo está vazio')
    }

    // Sanitizar nome do arquivo
    const sanitizedFilename = file.filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Substituir caracteres especiais
      .replace(/_+/g, '_') // Remover underscores duplicados
      .replace(/^_+|_+$/g, '') // Remover underscores do início e fim

    // Log do upload
    logger.fileUpload(
      sanitizedFilename,
      buffer.length,
      file.mimetype,
      'system' // Idealmente deveria vir do contexto da requisição
    )

    return {
      filename: sanitizedFilename,
      buffer,
      mimetype: file.mimetype,
      size: buffer.length,
    }

  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error
    }
    
    logger.error('Erro no processamento de upload', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      attachmentType,
    })
    
    throw new BadRequestError('Erro interno no processamento do arquivo')
  }
}

/**
 * Valida múltiplos arquivos de upload
 * @param request - Requisição Fastify
 * @param attachmentType - Tipo de anexo
 * @param maxFiles - Número máximo de arquivos permitidos
 * @returns Promise<FileUpload[]> - Array de arquivos processados
 */
export async function processMultipleFileUploads(
  request: FastifyRequest,
  attachmentType: AttachmentType = 'document',
  maxFiles: number = 5
): Promise<FileUpload[]> {
  try {
    const files: FileUpload[] = []
    let fileCount = 0

    for await (const file of request.files()) {
      if (fileCount >= maxFiles) {
        throw new BadRequestError(`Número máximo de arquivos excedido. Máximo: ${maxFiles}`)
      }

      // Processar cada arquivo individualmente
      const buffer = await file.toBuffer()
      
      // Validações similares ao processFileUpload
      if (!file.filename || file.filename.trim().length === 0) {
        throw new BadRequestError('Nome do arquivo é obrigatório')
      }

      const allowedMimeTypes = ALLOWED_MIME_TYPES[attachmentType]
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestError(
          `Tipo de arquivo não permitido: ${file.filename}`
        )
      }

      const maxSize = FILE_LIMITS.MAX_FILE_SIZE[attachmentType.toUpperCase() as keyof typeof FILE_LIMITS.MAX_FILE_SIZE]
      if (buffer.length > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024))
        throw new BadRequestError(
          `Arquivo ${file.filename} muito grande. Máximo: ${maxSizeMB}MB`
        )
      }

      if (buffer.length === 0) {
        throw new BadRequestError(`Arquivo ${file.filename} está vazio`)
      }

      const sanitizedFilename = file.filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')

      files.push({
        filename: sanitizedFilename,
        buffer,
        mimetype: file.mimetype,
        size: buffer.length,
      })

      fileCount++
    }

    if (files.length === 0) {
      throw new BadRequestError('Nenhum arquivo válido foi encontrado')
    }

    return files

  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error
    }
    
    logger.error('Erro no processamento de múltiplos uploads', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      attachmentType,
    })
    
    throw new BadRequestError('Erro interno no processamento dos arquivos')
  }
}

/**
 * Utilitário para obter informações sobre limites de arquivo
 * @param attachmentType - Tipo de anexo
 * @returns Informações sobre limites do tipo de arquivo
 */
export function getFileTypeLimits(attachmentType: AttachmentType) {
  const maxSize = FILE_LIMITS.MAX_FILE_SIZE[attachmentType.toUpperCase() as keyof typeof FILE_LIMITS.MAX_FILE_SIZE]
  const allowedMimeTypes = ALLOWED_MIME_TYPES[attachmentType]
  
  return {
    maxSize,
    maxSizeMB: Math.round(maxSize / (1024 * 1024)),
    allowedMimeTypes,
    allowedExtensions: allowedMimeTypes.map(mime => {
      switch (mime) {
        case 'image/jpeg': return ['jpg', 'jpeg']
        case 'image/png': return ['png']
        case 'image/webp': return ['webp']
        case 'application/pdf': return ['pdf']
        case 'application/msword': return ['doc']
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return ['docx']
        case 'text/plain': return ['txt']
        case 'text/csv': return ['csv']
        default: return [mime]
      }
    }).flat(),
  }
}
