export function normalizePhone(raw: string, defaultCountryCode = '55'): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length >= 12 && digits.length <= 15) return digits
  if (digits.length === 10 || digits.length === 11) return `${defaultCountryCode}${digits}`
  return null
}

export function extractTemplateVariables(body: string): string[] {
  return [...new Set((body.match(/{{\s*[\w.]+\s*}}/g) ?? []).map((value) => value.replace(/[{}]/g, '').trim()))]
}

export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => values[key] || `{{${key}}}`)
}
