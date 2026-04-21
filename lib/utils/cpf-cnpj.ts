/**
 * Máscara inteligente para CPF/CNPJ
 * Se digitar número: aplica máscara de CPF (11 dígitos) ou CNPJ (14 dígitos)
 */
export function applyCpfCnpjMask(value: string): string {
  // Remove tudo que não é número
  const cleanValue = value.replace(/\D/g, '')
  
  if (cleanValue.length > 14) {
    return cleanValue.slice(0, 14)
  }
  
  // CNPJ: 14 dígitos - XX.XXX.XXX/XXXX-XX
  if (cleanValue.length > 11) {
    return cleanValue
      .slice(0, 14)
      .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  
  // CPF: 11 dígitos - XXX.XXX.XXX-XX
  if (cleanValue.length > 9) {
    return cleanValue
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  
  if (cleanValue.length > 6) {
    return cleanValue
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})/, '$1.$2')
  }
  
  if (cleanValue.length > 3) {
    return cleanValue
      .slice(0, 11)
      .replace(/(\d{3})/, '$1.')
  }
  
  return cleanValue
}

/**
 * Valida se é CPF ou CNPJ válido
 */
export function isValidCpfOrCnpj(value: string): boolean {
  const cleanValue = value.replace(/\D/g, '')
  
  // Se tem 11 dígitos, valida como CPF
  if (cleanValue.length === 11) {
    return isValidCpf(cleanValue)
  }
  
  // Se tem 14 dígitos, valida como CNPJ
  if (cleanValue.length === 14) {
    return isValidCnpj(cleanValue)
  }
  
  return false
}

/**
 * Valida CPF
 */
function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  
  let sum = 0
  let remainder
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (11 - i)
  }
  
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf.substring(9, 10))) return false
  
  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (12 - i)
  }
  
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf.substring(10, 11))) return false
  
  return true
}

/**
 * Valida CNPJ
 */
function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  
  let size = cnpj.length - 2
  let numbers = cnpj.substring(0, size)
  let digits = cnpj.substring(size)
  
  let sum = 0
  let pos = size - 7
  
  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) as any * pos--
    if (pos < 2) pos = 9
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) return false
  
  size = size + 1
  numbers = cnpj.substring(0, size)
  sum = 0
  pos = size - 7
  
  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) as any * pos--
    if (pos < 2) pos = 9
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) return false
  
  return true
}
