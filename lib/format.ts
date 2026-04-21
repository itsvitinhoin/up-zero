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
  
  // Standard phone format: (00) 0000-0000 or (00) 00000-0000
  if (clean.length >= 10) {
    return clean.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
  }
  
  return value
}
