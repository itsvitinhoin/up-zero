export function normalizePhone(raw: string, defaultCountryCode = '55'): string | null {
  const value = String(raw ?? '').trim()
  const digitsOnly = value.replace(/\D/g, '')
  const hasInternationalPrefix = value.startsWith('+') || value.startsWith('00')
  const digits = value.startsWith('00') ? digitsOnly.slice(2) : digitsOnly
  const countryCode = String(defaultCountryCode ?? '').replace(/\D/g, '') || '55'

  if (!digits) return null
  if (hasInternationalPrefix) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null
  }

  if (digits.length >= 12 && digits.length <= 15) return digits
  if (countryCode === '1' && digits.length === 11 && digits.startsWith('1')) return digits
  if (digits.length === 10 || digits.length === 11) return `${countryCode}${digits}`
  return null
}

export function extractTemplateVariables(body: string): string[] {
  return [...new Set((body.match(/{{\s*[\w.]+\s*}}/g) ?? []).map((value) => value.replace(/[{}]/g, '').trim()))]
}

export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => values[key] || `{{${key}}}`)
}
