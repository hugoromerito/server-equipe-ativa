/**
 * Utilitário para geração de códigos de acesso TV
 * Gera códigos alfanuméricos de 6 caracteres únicos
 */

// Charset sem caracteres confusos (I/1, O/0, S/5)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Gera um código alfanumérico de 6 caracteres
 * Evita caracteres que podem causar confusão visual (I/1, O/0, S/5)
 * 
 * @returns String de 6 caracteres (ex: "AB2H7K")
 * 
 * Possibilidades: 30^6 = 729.000.000 combinações únicas
 */
export function generateTVAccessCode(): string {
  let code = ''
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length)
    code += CHARSET.charAt(randomIndex)
  }
  
  return code
}

/**
 * Valida formato de um código de TV
 * 
 * @param code - Código a ser validado
 * @returns true se o código tem formato válido
 */
export function isValidTVCodeFormat(code: string): boolean {
  if (code.length !== 6) return false
  
  // Verifica se todos os caracteres estão no charset permitido
  return code.split('').every(char => CHARSET.includes(char))
}

/**
 * Calcula data de expiração baseada em dias
 * 
 * @param days - Número de dias até expiração (default: 90)
 * @returns Date de expiração
 */
export function calculateExpirationDate(days: number = 90): Date {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)
  return expiresAt
}

/**
 * Verifica se um token está expirado
 * 
 * @param expiresAt - Data de expiração do token
 * @returns true se o token está expirado
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return new Date() > expiresAt
}
