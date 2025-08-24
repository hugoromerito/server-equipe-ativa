/**
 * Utilitários para validação e formatação de dados
 */

/**
 * Utilitários para validação e formatação de dados
 */

/**
 * Valida CPF usando algoritmo oficial
 */
function isValidCPF(cpf: string): boolean {
  if (!cpf || cpf.length !== 11) return false
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false
  
  // Calcula os dígitos verificadores
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i)
  }
  let digit1 = 11 - (sum % 11)
  if (digit1 > 9) digit1 = 0
  
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i)
  }
  let digit2 = 11 - (sum % 11)
  if (digit2 > 9) digit2 = 0
  
  return parseInt(cpf[9]) === digit1 && parseInt(cpf[10]) === digit2
}

/**
 * Normaliza e valida CPF
 */
export function validateAndFormatCPF(cpfInput: string): string {
  // Remove caracteres não numéricos
  const cleanCPF = cpfInput.replace(/\D/g, '')
  
  if (cleanCPF.length !== 11) {
    throw new Error('CPF deve ter 11 dígitos')
  }
  
  if (!isValidCPF(cleanCPF)) {
    throw new Error('CPF inválido')
  }
  
  return cleanCPF
}

/**
 * Formata CPF para exibição
 */
export function formatCPFForDisplay(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, '')
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Normaliza e valida telefone
 */
export function validateAndFormatPhone(phone: string): string {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '')
  
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    throw new Error('Telefone deve ter 10 ou 11 dígitos')
  }
  
  // Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  } else {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
}

/**
 * Valida e normaliza email
 */
export function validateAndFormatEmail(email: string): string {
  const normalizedEmail = email.toLowerCase().trim()
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('Formato de e-mail inválido')
  }
  
  return normalizedEmail
}

/**
 * Normaliza texto removendo acentos e caracteres especiais
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toLowerCase()
    .trim()
}

/**
 * Sanitiza string para uso em nomes de arquivo
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Substitui caracteres especiais
    .replace(/_+/g, '_') // Remove underscores consecutivos
    .replace(/^_+|_+$/g, '') // Remove underscores do início e fim
    .toLowerCase()
}

/**
 * Valida força da senha
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0
  
  // Comprimento mínimo
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('Senha deve ter pelo menos 8 caracteres')
  }
  
  // Letra minúscula
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Senha deve conter pelo menos uma letra minúscula')
  }
  
  // Letra maiúscula
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Senha deve conter pelo menos uma letra maiúscula')
  }
  
  // Número
  if (/\d/.test(password)) {
    score += 1
  } else {
    feedback.push('Senha deve conter pelo menos um número')
  }
  
  // Caractere especial
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1
  } else {
    feedback.push('Senha deve conter pelo menos um caractere especial')
  }
  
  // Comprimento ideal
  if (password.length >= 12) {
    score += 1
  }
  
  return {
    isValid: score >= 4, // Mínimo 4 critérios
    score,
    feedback,
  }
}

/**
 * Formata tamanho de arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  
  if (bytes === 0) return '0 Bytes'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  
  return `${Math.round(size * 100) / 100} ${sizes[i]}`
}

/**
 * Valida se uma data está em um intervalo válido
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  maxRangeDays = 365
): boolean {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (start > end) {
    throw new Error('Data de início deve ser anterior à data de fim')
  }
  
  const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  
  if (diffInDays > maxRangeDays) {
    throw new Error(`Intervalo de datas não pode ser maior que ${maxRangeDays} dias`)
  }
  
  return true
}

/**
 * Escapa caracteres especiais para uso em regex
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Converte string para slug
 */
export function stringToSlug(text: string): string {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-') // Substitui espaços e caracteres especiais por hífen
    .replace(/^-+|-+$/g, '') // Remove hífens do início e fim
    .substring(0, 50) // Limita tamanho
}
