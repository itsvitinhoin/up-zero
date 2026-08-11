import type { SignWholesaleSettings } from '@/lib/types'

const LOCKED_VISIBLE_SIGN_WHOLESALE_FIELD_IDS = new Set(['name', 'email', 'cnpj'])

export function resolveSignWholesaleFieldEnabled(
  field: { id: string; enabled?: boolean; required?: boolean },
  defaultEnabled = true,
): boolean {
  if (LOCKED_VISIBLE_SIGN_WHOLESALE_FIELD_IDS.has(field.id)) {
    return true
  }

  if (typeof field.enabled === 'boolean') {
    return field.enabled
  }

  // Legacy: admin "Obrigatório" toggle stored visibility in `required`.
  if (typeof field.required === 'boolean') {
    return field.required
  }

  return defaultEnabled
}

export function getDefaultSignWholesale(): SignWholesaleSettings {
  return {
    fields: [
      { id: 'name', label: 'Nome Completo', type: 'TEXT', enabled: true, required: true, order: 1, isDefault: true },
      { id: 'email', label: 'E-mail', type: 'EMAIL', enabled: true, required: true, order: 2, isDefault: true },
      { id: 'phone', label: 'Telefone / WhatsApp', type: 'PHONE', enabled: true, required: true, order: 3, isDefault: true },
      { id: 'cnpj', label: 'CNPJ', type: 'CNPJ', enabled: true, required: true, order: 4, isDefault: true },
      { id: 'companyName', label: 'Razão Social', type: 'TEXT', enabled: true, required: true, order: 5, isDefault: true },
      { id: 'tradeName', label: 'Nome Fantasia', type: 'TEXT', enabled: false, required: false, order: 6, isDefault: true },
      { id: 'stateRegistration', label: 'Inscrição Estadual', type: 'TEXT', enabled: false, required: false, order: 7, isDefault: true },
      { id: 'segment', label: 'Segmento de Atuação', type: 'TEXT', enabled: false, required: false, order: 8, isDefault: true },
      { id: 'address', label: 'Endereço Completo', type: 'ADDRESS', enabled: true, required: true, order: 9, isDefault: true },
    ],
    autoApproval: {
      enabled: true,
      mode: 'CNAE',
      validateCnpjOnReceita: true,
      allowedCnaes: ['4781-4/00', '4782-2/01', '4789-0/99', '4755-5/01', '4755-5/02', '4781-4/01'],
      approveCpfAutomatically: true,
    },
    sellerAssignment: {
      enabled: true,
      mode: 'ROUND_ROBIN',
      sellerIds: [],
      fallbackSellerId: null,
    },
  }
}

const CANONICAL_SIGN_WHOLESALE_FIELD_ORDER = Object.fromEntries(
  getDefaultSignWholesale().fields.map((field) => [field.id, field.order]),
) as Record<string, number>

function applyCanonicalSignWholesaleFieldOrder<T extends { id: string; order: number }>(
  fields: T[],
): T[] {
  return fields
    .map((field) => {
      const canonicalOrder = CANONICAL_SIGN_WHOLESALE_FIELD_ORDER[field.id]
      return canonicalOrder !== undefined ? { ...field, order: canonicalOrder } : field
    })
    .sort((left, right) => left.order - right.order)
}

export function mergeSignWholesaleFieldsWithDefaults(
  fields: SignWholesaleSettings['fields'],
  defaults: SignWholesaleSettings['fields'] = getDefaultSignWholesale().fields,
): SignWholesaleSettings['fields'] {
  const existingIds = new Set(fields.map((field) => field.id))
  const missingDefaults = defaults.filter((field) => !existingIds.has(field.id))

  const merged =
    missingDefaults.length === 0
      ? [...fields]
      : (() => {
          const maxOrder = fields.reduce((max, field) => Math.max(max, field.order), 0)
          const appendedDefaults = missingDefaults.map((field, index) => ({
            ...field,
            order: maxOrder + index + 1,
          }))
          return [...fields, ...appendedDefaults]
        })()

  return applyCanonicalSignWholesaleFieldOrder(merged)
}
