/**
 * Format CNPJ or CPF with masks
 * CPF: 000.000.000-00
 * CNPJ: 00.000.000/0000-00
 */
export function formatCNPJorCPF(value: string): string {
  if (!value) return ''
  
  // Remove non-digits
  const clean = value.replace(/\D/g, '')
  
  // CPF: 11 digits
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  
  // CNPJ: 14 digits
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  
  return value
}

/**
 * Format phone number with mask
 * 10 digits: (00) 00000-0000
 * 11 digits: (00) 00000-0000 (same pattern)
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return ''
  
  // Remove non-digits
  const clean = value.replace(/\D/g, '')

  // Preserve explicit international numbers instead of applying a Brazilian DDD mask.
  if (value.trim().startsWith('+1') && clean.length === 11) {
    return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`
  }

  if (value.trim().startsWith('+55') && (clean.length === 12 || clean.length === 13)) {
    const national = clean.slice(2)
    const prefixLength = national.length === 11 ? 5 : 4
    return `+55 (${national.slice(0, 2)}) ${national.slice(2, 2 + prefixLength)}-${national.slice(2 + prefixLength)}`
  }
  
  // Standard phone format: (00) 0000-0000 or (00) 00000-0000
  if (clean.length >= 10) {
    return clean.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
  }
  
  return value
}
