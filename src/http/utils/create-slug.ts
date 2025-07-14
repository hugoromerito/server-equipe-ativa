export function createSlug(text: string): string {
  return text
    .toLowerCase() // Converte o texto para minúsculas
    .normalize('NFD') // Normaliza a string para separar os acentos dos caracteres
    .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove símbolos, mantendo apenas letras, números, espaços e hífens
    .trim() // Remove espaços do início e do fim
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens repetidos
}
