export function checkerCpf(cpf: string | number): boolean {
  // Converte o CPF para string e remove caracteres não numéricos
  const strCPF = String(cpf).replace(/[^\d]/g, '')

  // Verifica se o CPF possui 11 dígitos
  if (strCPF.length !== 11) {
    return false
  }

  // Verifica se todos os dígitos são iguais
  const cpfsInvalidos = [
    '00000000000',
    '11111111111',
    '22222222222',
    '33333333333',
    '44444444444',
    '55555555555',
    '66666666666',
    '77777777777',
    '88888888888',
    '99999999999',
  ]
  if (cpfsInvalidos.includes(strCPF)) {
    return false
  }

  let soma = 0
  let resto: number

  // Validação do primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    soma += Number.parseInt(strCPF.substring(i - 1, i)) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) {
    resto = 0
  }
  if (resto !== Number.parseInt(strCPF.substring(9, 10))) {
    return false
  }

  // Validação do segundo dígito verificador
  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += Number.parseInt(strCPF.substring(i - 1, i)) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) {
    resto = 0
  }
  if (resto !== Number.parseInt(strCPF.substring(10, 11))) {
    return false
  }

  return true
}
