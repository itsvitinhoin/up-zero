'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getSession, canManageSettings, canManagePriceTables, canManageCoupons, getAdminStoreIdFromToken } from '@/lib/auth'
import {
  getSiteSettings,
  updateSiteSettings,
  getUsers,
  updateUser,
  createAuditLog,
  createUser,
} from '@/lib/backend-data'
import {
  priceTableSchema,
  priceTableItemSchema,
  tierDiscountSchema,
} from '@/lib/validations'
import { getValidationErrorMessage } from '@/lib/utils/validation-error'
import { getDefaultSignWholesale, mergeSignWholesaleFieldsWithDefaults, resolveSignWholesaleFieldEnabled } from '@/lib/sign-wholesale-defaults'
import type {
  ApiResponse,
  SiteSettings,
  SiteCustomization,
  PaymentSettings,
  PaymentMethod,
  PriceTable,
  PriceTableItem,
  Coupon,
  TierDiscount,
  ShippingOption,
  ShippingSettings,
  MarketingSettings,
  ErpSettings,
  User,
} from '@/lib/types'
import {
  appendStoreScopeParam,
  resolveStorefrontApiKeyFromRequest,
  withStorefrontScopeHeaders,
} from '@/lib/actions/storefront-scope'
import { checkUserPermission } from '@/lib/actions/permissions'

type FixedShippingOptionBackend = {
  id: number
  name: string
  estimated_days: number
  price_cents: number
  active: boolean
  priority: number
}

type FixedShippingTableBackend = {
  method_id: number | null
  store_id: number
  method_name: string
  options: FixedShippingOptionBackend[]
}

type PaymentMethodBackend = {
  id: number
  name: string
  type: string
  store_id: number
  meta: Record<string, unknown>
}

type ShippingMethodBackend = {
  id: number
  name: string
  type: string
  store_id: number | null
  free_shipping: boolean
  free_shipping_min_value_cents: number
  active: boolean
  reverse_code_status: boolean
  settings: Record<string, unknown> | null
  priority: number
}

export type PaymentMethodConfig = {
  id: string
  name: string
  type: string
  storeId: number
  meta: Record<string, unknown>
}

export type StoreProfileConfig = {
  id: string
  name: string
  cnpj: string
  description: string
  email: string
  phone: string
  whatsapp: string
  b2bMasterPassword: string
  address: {
    zip_code: string
    street_name: string
    house_number: string
    address_complement: string
    neighborhood: string
    city: string
    state: string
  }
  meta: {
    title: string
    description: string
    headCode: string
    maintenanceMode: boolean
    socialLinks: {
      instagram: { enabled: boolean; url: string }
      facebook: { enabled: boolean; url: string }
      youtube: { enabled: boolean; url: string }
      linkedin: { enabled: boolean; url: string }
      tiktok: { enabled: boolean; url: string }
    }
  }
}

const DEFAULT_STORE_SOCIAL_LINKS: StoreProfileConfig['meta']['socialLinks'] = {
  instagram: { enabled: false, url: '' },
  facebook: { enabled: false, url: '' },
  youtube: { enabled: false, url: '' },
  linkedin: { enabled: false, url: '' },
  tiktok: { enabled: false, url: '' },
}

function normalizeStoreSocialLinkEntry(value: unknown): { enabled: boolean; url: string } {
  if (typeof value === 'string') {
    const url = value.trim()
    return { enabled: url.length > 0, url }
  }

  if (value && typeof value === 'object') {
    const entry = value as Record<string, unknown>
    const rawUrl = entry.url
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''

    return {
      enabled: typeof entry.enabled === 'boolean' ? entry.enabled : url.length > 0,
      url,
    }
  }

  return { enabled: false, url: '' }
}

function normalizeStoreSocialLinks(metaRaw: Record<string, unknown>): StoreProfileConfig['meta']['socialLinks'] {
  const rawSocialLinks = (
    (metaRaw.socialLinks && typeof metaRaw.socialLinks === 'object' ? metaRaw.socialLinks : null)
    ?? (metaRaw.social_links && typeof metaRaw.social_links === 'object' ? metaRaw.social_links : null)
    ?? {}
  ) as Record<string, unknown>

  return {
    instagram: normalizeStoreSocialLinkEntry(rawSocialLinks.instagram),
    facebook: normalizeStoreSocialLinkEntry(rawSocialLinks.facebook),
    youtube: normalizeStoreSocialLinkEntry(rawSocialLinks.youtube),
    linkedin: normalizeStoreSocialLinkEntry(rawSocialLinks.linkedin),
    tiktok: normalizeStoreSocialLinkEntry(rawSocialLinks.tiktok),
  }
}

type B2BSettingsMeta = {
  requireCnpj: boolean
  defaultMinPieces: number
  minOrderValue: number | null
  maxInstallmentsText: string
  stockMode: 'FANTASY' | 'BINARY' | 'REAL' | 'INFINITO' | 'WMS'
  variantMaxQty: number
  pendingCustomerMessage: string
  priceVisibilityMode: 'LOGIN_REQUIRED' | 'PUBLIC'
  userLinksPriceVisibilityMode: 'LOGIN_REQUIRED' | 'PUBLIC'
  sellerCanApproveCustomers: boolean
  sellerCanEditPriceTable: boolean
  sellerCanCreateOrders: boolean
  paymentTerms: PaymentMethod[]
  sign_wholesale: SiteSettings['sign_wholesale']
}

type ThemeSettingsMeta = SiteCustomization
type PaymentSettingsMeta = PaymentSettings
type ProductSettingsMeta = {
  fields: NonNullable<SiteSettings['productCustomFields']>
}

type PaymentMethodOption = {
  id?: number
  value: string
  label: string
}

const DEFAULT_PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'FATURADO', label: 'Faturado' },
  { value: 'CARTAO_EXTERNO', label: 'Cartão' },
]

type BackendSettingRecord = {
  id: number
  store_id: number
  code: string
  title: string
  meta: Record<string, unknown>
}

const SUSPICIOUS_MOJIBAKE_PATTERN = /Ã.|Â.|â.|�/
const PT_BR_CHAR_PATTERN = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/
const SERIALIZED_DATE_PATTERN = /^\$D\d{4}-\d{2}-\d{2}T/

function countPatternMatches(text: string, pattern: RegExp): number {
  const matches = text.match(new RegExp(pattern.source, 'g'))
  return matches ? matches.length : 0
}

function fixMojibakeText(value: string): string {
  if (!SUSPICIOUS_MOJIBAKE_PATTERN.test(value)) {
    return value
  }

  const decoded = Buffer.from(value, 'latin1').toString('utf8')
  const originalNoise = countPatternMatches(value, SUSPICIOUS_MOJIBAKE_PATTERN)
  const decodedNoise = countPatternMatches(decoded, SUSPICIOUS_MOJIBAKE_PATTERN)
  const originalPtChars = countPatternMatches(value, PT_BR_CHAR_PATTERN)
  const decodedPtChars = countPatternMatches(decoded, PT_BR_CHAR_PATTERN)

  if (decodedNoise < originalNoise) return decoded
  if (decodedNoise === originalNoise && decodedPtChars > originalPtChars) return decoded

  return value
}

function normalizeTransportValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value

  if (typeof value === 'string') {
    const maybeFixedText = fixMojibakeText(value)

    if (SERIALIZED_DATE_PATTERN.test(maybeFixedText)) {
      const parsed = new Date(maybeFixedText.slice(2))
      return Number.isNaN(parsed.getTime()) ? maybeFixedText : parsed
    }

    return maybeFixedText
  }

  if (Array.isArray(value)) {
    return value.map(normalizeTransportValue)
  }

  if (typeof value === 'object') {
    const normalizedEntries = Object.entries(value).map(([key, entryValue]) => [
      key,
      normalizeTransportValue(entryValue),
    ])

    return Object.fromEntries(normalizedEntries)
  }

  return value
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function centsToCurrency(value: unknown): number | null {
  const numeric = toOptionalNumber(value)
  if (numeric === null) return null
  return numeric / 100
}

function currencyToCents(value: unknown): number | null {
  const numeric = toOptionalNumber(value)
  if (numeric === null) return null
  return Math.round(numeric * 100)
}

const PAYMENT_METHOD_CODES: PaymentMethod[] = ['PIX', 'BOLETO', 'FATURADO', 'CARTAO_EXTERNO']

function getDefaultDomainSettings(): SiteSettings['domainSettings'] {
  return {
    customDomain: null,
    domainStatus: 'PENDING',
    domainVerificationToken: null,
    sslEnabled: true,
    wwwRedirect: true,
  }
}

function normalizeDomainSettingsMeta(value: unknown): SiteSettings['domainSettings'] {
  const defaults = getDefaultDomainSettings()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const meta = value as Record<string, unknown>
  const domainStatus = String(meta.domainStatus || '').trim().toUpperCase()

  return {
    customDomain: typeof meta.customDomain === 'string' && meta.customDomain.trim().length > 0
      ? meta.customDomain.trim()
      : null,
    domainStatus:
      domainStatus === 'ACTIVE' || domainStatus === 'VERIFYING' || domainStatus === 'ERROR' || domainStatus === 'PENDING'
        ? domainStatus as SiteSettings['domainSettings']['domainStatus']
        : defaults.domainStatus,
    domainVerificationToken: typeof meta.domainVerificationToken === 'string' && meta.domainVerificationToken.trim().length > 0
      ? meta.domainVerificationToken.trim()
      : null,
    sslEnabled: typeof meta.sslEnabled === 'boolean' ? meta.sslEnabled : defaults.sslEnabled,
    wwwRedirect: typeof meta.wwwRedirect === 'boolean' ? meta.wwwRedirect : defaults.wwwRedirect,
  }
}

function getDefaultErpSettings(): ErpSettings {
  return { provider: 'NONE' }
}

function normalizeErpSettingsMeta(value: unknown): ErpSettings {
  const defaults = getDefaultErpSettings()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const meta = value as Record<string, unknown>
  const provider = String(meta.provider || '').trim().toUpperCase()

  if (provider === 'MANSE' || provider === 'MIRE' || provider === 'BLING') {
    return { provider }
  }

  return defaults
}

function normalizePaymentMethodCode(value: unknown): PaymentMethod | null {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')

  if (!normalized) return null
  if (PAYMENT_METHOD_CODES.includes(normalized as PaymentMethod)) {
    return normalized as PaymentMethod
  }

  if (normalized === 'CARTAO' || normalized === 'CARTAO_CREDITO' || normalized === 'CARTAO_DE_CREDITO') {
    return 'CARTAO_EXTERNO'
  }

  return null
}

function normalizePaymentMethodsList(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map(normalizePaymentMethodCode)
    .filter((entry): entry is PaymentMethod => Boolean(entry))

  return Array.from(new Set(normalized))
}

function getDefaultSignWholesaleSettings(): SiteSettings['sign_wholesale'] {
  return getDefaultSignWholesale()
}

function normalizeSignWholesaleSettings(
  value: unknown,
  fallback?: SiteSettings['sign_wholesale'],
): SiteSettings['sign_wholesale'] {
  const safeFallback = fallback && typeof fallback === 'object'
    ? fallback
    : getDefaultSignWholesaleSettings()

  if (!value || typeof value !== 'object') return safeFallback

  const raw = value as Record<string, unknown>
  const fallbackFields = Array.isArray(safeFallback.fields) ? safeFallback.fields : []
  const fallbackAutoApproval = safeFallback.autoApproval
  const fallbackSellerAssignment = safeFallback.sellerAssignment ?? {
    enabled: true,
    mode: 'ROUND_ROBIN' as const,
    sellerIds: [],
    fallbackSellerId: null,
  }

  const fields = Array.isArray(raw.fields)
    ? raw.fields
        .map((entry, index) => {
          if (!entry || typeof entry !== 'object') return null

          const field = entry as Record<string, unknown>
          const type = field.type
          const normalizedType =
            type === 'TEXT' || type === 'EMAIL' || type === 'PHONE' || type === 'CNPJ' ||
            type === 'LONG_TEXT' || type === 'ADDRESS' || type === 'URL' || type === 'SELECT' || type === 'UPLOAD'
              ? type
              : null

          const id = typeof field.id === 'string' ? field.id : null
          const label = typeof field.label === 'string' ? field.label : null
          if (!id || !label || !normalizedType) return null

          const normalizedId = id.trim().toLowerCase()
          const resolvedType =
            normalizedType === 'LONG_TEXT'
            && (normalizedId === 'address' || normalizedId === 'enderecocompleto')
              ? 'ADDRESS'
              : normalizedType

          const defaultField = fallbackFields.find((entry) => entry.id === id)

          return {
            id,
            label,
            type: resolvedType,
            enabled: resolveSignWholesaleFieldEnabled(
              {
                id,
                enabled: typeof field.enabled === 'boolean' ? field.enabled : undefined,
                required: typeof field.required === 'boolean' ? field.required : undefined,
              },
              defaultField?.enabled !== false,
            ),
            required: typeof field.required === 'boolean' ? field.required : false,
            order: toOptionalNumber(field.order) ?? index + 1,
            isDefault: typeof field.isDefault === 'boolean' ? field.isDefault : false,
            helpText: typeof field.helpText === 'string' ? field.helpText : undefined,
          }
        })
        .filter((entry): entry is SiteSettings['sign_wholesale']['fields'][number] => Boolean(entry))
    : fallbackFields

  const autoApprovalRaw = raw.autoApproval && typeof raw.autoApproval === 'object'
    ? raw.autoApproval as Record<string, unknown>
    : {}

  const sellerAssignmentRaw = raw.sellerAssignment && typeof raw.sellerAssignment === 'object'
    ? raw.sellerAssignment as Record<string, unknown>
    : {}

  return {
    fields: fields.length > 0
      ? mergeSignWholesaleFieldsWithDefaults(fields.sort((left, right) => left.order - right.order), fallbackFields)
      : fallbackFields,
    autoApproval: {
      enabled: typeof autoApprovalRaw.enabled === 'boolean' ? autoApprovalRaw.enabled : fallbackAutoApproval.enabled,
      mode: autoApprovalRaw.mode === 'MANUAL' ? 'MANUAL' : 'CNAE',
      validateCnpjOnReceita:
        typeof autoApprovalRaw.validateCnpjOnReceita === 'boolean'
          ? autoApprovalRaw.validateCnpjOnReceita
          : fallbackAutoApproval.validateCnpjOnReceita,
      allowedCnaes: Array.isArray(autoApprovalRaw.allowedCnaes)
        ? autoApprovalRaw.allowedCnaes.map((entry) => String(entry).trim()).filter(Boolean)
        : fallbackAutoApproval.allowedCnaes,
      approveCpfAutomatically:
        typeof autoApprovalRaw.approveCpfAutomatically === 'boolean'
          ? autoApprovalRaw.approveCpfAutomatically
          : fallbackAutoApproval.approveCpfAutomatically,
    },
    sellerAssignment: {
      enabled:
        typeof sellerAssignmentRaw.enabled === 'boolean'
          ? sellerAssignmentRaw.enabled
          : fallbackSellerAssignment.enabled,
      mode: sellerAssignmentRaw.mode === 'MANUAL' ? 'MANUAL' : 'ROUND_ROBIN',
      sellerIds: Array.isArray(sellerAssignmentRaw.sellerIds)
        ? sellerAssignmentRaw.sellerIds.map((entry) => String(entry)).filter(Boolean)
        : fallbackSellerAssignment.sellerIds,
      fallbackSellerId:
        typeof sellerAssignmentRaw.fallbackSellerId === 'string' && sellerAssignmentRaw.fallbackSellerId.trim().length > 0
          ? sellerAssignmentRaw.fallbackSellerId
          : null,
    },
  }
}

function normalizeProductCustomFieldsMeta(
  value: unknown,
  fallback?: SiteSettings['productCustomFields'],
): NonNullable<SiteSettings['productCustomFields']> {
  const safeFallback = Array.isArray(fallback) ? fallback : []

  const source = (() => {
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') {
      const raw = value as Record<string, unknown>
      if (Array.isArray(raw.fields)) return raw.fields
    }
    return safeFallback
  })()

  return source
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null
      const field = entry as Record<string, unknown>

      const typeRaw = String(field.type || '').trim().toUpperCase()
      const type =
        typeRaw === 'TEXT' || typeRaw === 'LONG_TEXT' || typeRaw === 'NUMBER' || typeRaw === 'URL' || typeRaw === 'SELECT' || typeRaw === 'MULTI_UPLOAD' || typeRaw === 'RICH_TEXT'
          ? typeRaw
          : 'TEXT'

      const id = typeof field.id === 'string' && field.id.trim().length > 0
        ? field.id.trim()
        : `product_field_${index + 1}`
      const label = typeof field.label === 'string' && field.label.trim().length > 0
        ? field.label.trim()
        : id

      const options = Array.isArray(field.options)
        ? field.options
            .map((option) => {
              if (!option || typeof option !== 'object') return null
              const rawOption = option as Record<string, unknown>
              const optionValue = typeof rawOption.value === 'string' ? rawOption.value.trim() : ''
              if (!optionValue) return null
              const optionLabel = typeof rawOption.label === 'string' && rawOption.label.trim().length > 0
                ? rawOption.label.trim()
                : optionValue
              return { value: optionValue, label: optionLabel }
            })
            .filter((option): option is { value: string; label: string } => Boolean(option))
        : []

      return {
        id,
        label,
        type,
        enabled: typeof field.enabled === 'boolean' ? field.enabled : true,
        required: typeof field.required === 'boolean' ? field.required : false,
        order: toOptionalNumber(field.order) ?? index + 1,
        placeholder: typeof field.placeholder === 'string' ? field.placeholder : undefined,
        helpText: typeof field.helpText === 'string' ? field.helpText : undefined,
        options: type === 'SELECT' ? options : undefined,
      }
    })
    .filter((entry): entry is NonNullable<SiteSettings['productCustomFields']>[number] => Boolean(entry))
    .sort((left, right) => left.order - right.order)
}

function getDefaultShippingSettings(fallback?: SiteSettings): ShippingSettings {
  return fallback?.shippingSettings ?? {
    defaultPackage: {
      weight: 0.3,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 5,
      largeItemThresholdGrams: 1000,
      largeItemWeight: 1.5,
      largeItemLengthCm: 40,
      largeItemWidthCm: 30,
      largeItemHeightCm: 20,
    },
    defaultOriginCep: '',
    defaultPackageWeight: 0.3,
    checkoutMessage: '',
    showEstimatedDelivery: true,
    freeShippingEnabled: false,
    freeShippingMinValue: 0,
    freeShippingRegions: ['ALL'],
    regionalOffers: [],
    correios: {
      enabled: false,
      idCorreios: null,
      apiKey: null,
      postcardNumber: null,
      contractCode: null,
      contractPassword: null,
      originCep: '',
      enabledServices: ['SEDEX', 'PAC'],
      markupPercent: 0,
      markupFixed: 0,
      additionalDays: 0,
      declareValue: true,
    },
    customMethods: [],
  }
}

function normalizeShippingSettingsMeta(value: unknown, fallback: SiteSettings): ShippingSettings {
  const defaults = getDefaultShippingSettings(fallback)
  if (!value || typeof value !== 'object') return defaults

  const meta = value as Record<string, unknown>
  const defaultPackageRaw = meta.defaultPackage && typeof meta.defaultPackage === 'object'
    ? (meta.defaultPackage as Record<string, unknown>)
    : {}
  const correiosRaw = meta.correios && typeof meta.correios === 'object'
    ? (meta.correios as Record<string, unknown>)
    : {}

  return {
    defaultPackage: {
      weight: toOptionalNumber(defaultPackageRaw.weight) ?? defaults.defaultPackage.weight,
      lengthCm: toOptionalNumber(defaultPackageRaw.lengthCm) ?? defaults.defaultPackage.lengthCm,
      widthCm: toOptionalNumber(defaultPackageRaw.widthCm) ?? defaults.defaultPackage.widthCm,
      heightCm: toOptionalNumber(defaultPackageRaw.heightCm) ?? defaults.defaultPackage.heightCm,
      largeItemThresholdGrams: toOptionalNumber(defaultPackageRaw.largeItemThresholdGrams) ?? defaults.defaultPackage.largeItemThresholdGrams,
      largeItemWeight: toOptionalNumber(defaultPackageRaw.largeItemWeight) ?? defaults.defaultPackage.largeItemWeight,
      largeItemLengthCm: toOptionalNumber(defaultPackageRaw.largeItemLengthCm) ?? defaults.defaultPackage.largeItemLengthCm,
      largeItemWidthCm: toOptionalNumber(defaultPackageRaw.largeItemWidthCm) ?? defaults.defaultPackage.largeItemWidthCm,
      largeItemHeightCm: toOptionalNumber(defaultPackageRaw.largeItemHeightCm) ?? defaults.defaultPackage.largeItemHeightCm,
    },
    defaultOriginCep: typeof meta.defaultOriginCep === 'string' ? meta.defaultOriginCep : defaults.defaultOriginCep,
    defaultPackageWeight: toOptionalNumber(meta.defaultPackageWeight) ?? defaults.defaultPackageWeight,
    checkoutMessage: typeof meta.checkoutMessage === 'string' ? meta.checkoutMessage : defaults.checkoutMessage,
    showEstimatedDelivery: typeof meta.showEstimatedDelivery === 'boolean' ? meta.showEstimatedDelivery : defaults.showEstimatedDelivery,
    freeShippingEnabled: typeof meta.freeShippingEnabled === 'boolean' ? meta.freeShippingEnabled : defaults.freeShippingEnabled,
    freeShippingMinValue: toOptionalNumber(meta.freeShippingMinValue) ?? defaults.freeShippingMinValue,
    freeShippingRegions: Array.isArray(meta.freeShippingRegions)
      ? meta.freeShippingRegions.map((entry) => String(entry)).filter(Boolean)
      : defaults.freeShippingRegions,
    regionalOffers: Array.isArray(meta.regionalOffers)
      ? meta.regionalOffers as ShippingSettings['regionalOffers']
      : defaults.regionalOffers,
    correios: {
      enabled: typeof correiosRaw.enabled === 'boolean' ? correiosRaw.enabled : defaults.correios.enabled,
      idCorreios: typeof correiosRaw.idCorreios === 'string' ? correiosRaw.idCorreios : defaults.correios.idCorreios,
      apiKey: typeof correiosRaw.apiKey === 'string' ? correiosRaw.apiKey : defaults.correios.apiKey,
      postcardNumber: typeof correiosRaw.postcardNumber === 'string' ? correiosRaw.postcardNumber : defaults.correios.postcardNumber,
      contractCode: typeof correiosRaw.contractCode === 'string' ? correiosRaw.contractCode : defaults.correios.contractCode,
      contractPassword: typeof correiosRaw.contractPassword === 'string' ? correiosRaw.contractPassword : defaults.correios.contractPassword,
      originCep: typeof correiosRaw.originCep === 'string' ? correiosRaw.originCep : defaults.correios.originCep,
      enabledServices: Array.isArray(correiosRaw.enabledServices)
        ? correiosRaw.enabledServices.map((entry) => String(entry)) as ShippingSettings['correios']['enabledServices']
        : defaults.correios.enabledServices,
      markupPercent: toOptionalNumber(correiosRaw.markupPercent) ?? defaults.correios.markupPercent,
      markupFixed: toOptionalNumber(correiosRaw.markupFixed) ?? defaults.correios.markupFixed,
      additionalDays: toOptionalNumber(correiosRaw.additionalDays) ?? defaults.correios.additionalDays,
      declareValue: typeof correiosRaw.declareValue === 'boolean' ? correiosRaw.declareValue : defaults.correios.declareValue,
    },
    customMethods: Array.isArray(meta.customMethods)
      ? meta.customMethods as ShippingSettings['customMethods']
      : defaults.customMethods,
  }
}

function normalizeB2BMeta(meta: Record<string, unknown>, fallback: SiteSettings): B2BSettingsMeta {
  const requireCnpj = typeof meta.requireCnpj === 'boolean' ? meta.requireCnpj : fallback.requireCnpj
  const defaultMinPieces = toOptionalNumber(meta.defaultMinPieces) ?? fallback.defaultMinPieces
  const minOrderValue = meta.minOrderValue === null
    ? null
    : toOptionalNumber(meta.minOrderValue) ?? fallback.minOrderValue
  const maxInstallmentsText = typeof meta.maxInstallmentsText === 'string'
    ? meta.maxInstallmentsText
    : fallback.maxInstallmentsText
  const stockMode = meta.stockMode === 'BINARY' || meta.stockMode === 'REAL' || meta.stockMode === 'FANTASY' || meta.stockMode === 'INFINITO' || meta.stockMode === 'WMS'
    ? meta.stockMode
    : ((fallback as SiteSettings).stockMode || 'FANTASY')
  const variantMaxQty = toOptionalNumber(meta.variantMaxQty)
    ?? ((fallback as SiteSettings).variantMaxQty || 999)
  const pendingCustomerMessage = typeof meta.pendingCustomerMessage === 'string'
    ? meta.pendingCustomerMessage
    : fallback.pendingCustomerMessage
  const priceVisibilityMode = meta.priceVisibilityMode === 'PUBLIC' ? 'PUBLIC' : (meta.priceVisibilityMode === 'LOGIN_REQUIRED' ? 'LOGIN_REQUIRED' : fallback.priceVisibilityMode)
  const userLinksPriceVisibilityMode = meta.userLinksPriceVisibilityMode === 'PUBLIC'
    ? 'PUBLIC'
    : (meta.userLinksPriceVisibilityMode === 'LOGIN_REQUIRED'
      ? 'LOGIN_REQUIRED'
      : (meta.user_links_price_visibility_mode === 'PUBLIC'
        ? 'PUBLIC'
        : (meta.user_links_price_visibility_mode === 'LOGIN_REQUIRED'
          ? 'LOGIN_REQUIRED'
          : (fallback.userLinksPriceVisibilityMode || fallback.priceVisibilityMode))))
  const sellerCanApproveCustomers = typeof meta.sellerCanApproveCustomers === 'boolean'
    ? meta.sellerCanApproveCustomers
    : fallback.sellerCanApproveCustomers
  const sellerCanEditPriceTable = typeof meta.sellerCanEditPriceTable === 'boolean'
    ? meta.sellerCanEditPriceTable
    : fallback.sellerCanEditPriceTable
  const sellerCanCreateOrders = typeof meta.sellerCanCreateOrders === 'boolean'
    ? meta.sellerCanCreateOrders
    : fallback.sellerCanCreateOrders
  const paymentTerms = normalizePaymentMethodsList(meta.payment_terms ?? meta.paymentTerms)
  const signWholesale = normalizeSignWholesaleSettings(meta.sign_wholesale, fallback.sign_wholesale)

  return {
    requireCnpj,
    defaultMinPieces,
    minOrderValue,
    maxInstallmentsText,
    stockMode,
    variantMaxQty,
    pendingCustomerMessage,
    priceVisibilityMode,
    userLinksPriceVisibilityMode,
    sellerCanApproveCustomers,
    sellerCanEditPriceTable,
    sellerCanCreateOrders,
    paymentTerms,
    sign_wholesale: signWholesale,
  }
}

function normalizeThemeMeta(meta: Record<string, unknown>, fallback: SiteCustomization): ThemeSettingsMeta {
  const normalizeFontFamily = (value: unknown): SiteCustomization['fontFamily'] | null => {
    const normalized = String(value || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[\s-]+/g, '_')

    if (!normalized) return null
    if (normalized === 'SYSTEM' || normalized === 'SISTEMA' || normalized === 'DEFAULT' || normalized === 'PADRAO') return 'SYSTEM'
    if (normalized === 'INTER') return 'INTER'
    if (normalized === 'POPPINS') return 'POPPINS'
    if (normalized === 'MONTSERRAT') return 'MONTSERRAT'
    if (normalized === 'ZEN_KAKU_GOTHIC_NEW' || normalized === 'ZENKAKUGOTHICNEW') return 'ZEN_KAKU_GOTHIC_NEW'

    return null
  }

  const parseBoolean = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null
    if (typeof value !== 'string') return null

    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'sim', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'nao', 'off'].includes(normalized)) return false
    return null
  }

  const fallbackFontFamily = fallback.fontFamily || 'SYSTEM'
  const fallbackForceUppercaseText = typeof fallback.forceUppercaseText === 'boolean' ? fallback.forceUppercaseText : false
  const fallbackAnnouncementBar = fallback.announcementBar ?? {
    enabled: true,
    items: [
      'Frete gratis para compras acima de R$ 1000',
      'Novidades toda semana',
      'Atacado exclusivo para lojistas',
    ],
    separator: '|',
    backgroundColor: '#1a1a1a',
    textColor: '#ffffff',
    isAnimated: true,
    animationSpeed: 'NORMAL' as const,
  }
  const announcementBarRaw = meta.announcementBar
  const popupCouponRaw = meta.popupCoupon ?? meta.couponPopup
  const mainBannerRaw = meta.mainBanner
  const mainBannersRaw = meta.mainBanners
  const miniBannersRaw = meta.miniBanners
  const categoryBannerModeRaw = meta.categoryBannerMode
  const storefrontDisplayModeRaw =
    meta.storefrontDisplayMode
    ?? meta.storefront_display_mode
    ?? meta.vitrineDisplayMode
    ?? meta.vitrine_display_mode
  const storefrontNavigationModeRaw =
    meta.storefrontNavigationMode
    ?? meta.storefront_navigation_mode
    ?? meta.vitrineNavigationMode
    ?? meta.vitrine_navigation_mode
  const storefrontDefaultSortRaw =
    meta.storefrontDefaultSort
    ?? meta.storefront_default_sort
    ?? meta.defaultSort
    ?? meta.default_sort
    ?? meta.vitrineDefaultSort
    ?? meta.vitrine_default_sort
  const parsePositiveNumber = (value: unknown): number | null => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
  }
  const mediaAspectWidth = parsePositiveNumber(meta.mediaAspectWidth ?? meta.media_aspect_width)
    ?? (fallback.mediaAspectWidth ?? null)
  const mediaAspectHeight = parsePositiveNumber(meta.mediaAspectHeight ?? meta.media_aspect_height)
    ?? (fallback.mediaAspectHeight ?? null)
  const categoryBannersRaw = meta.categoryBanners
  const infoBannersRaw = meta.infoBanners
  const homeCategoriesRaw =
    meta.homeCategories
    ?? meta.home_categories
    ?? meta.homeCategoryIds
    ?? meta.home_category_ids
  const fontFamilyRaw =
    meta.fontFamily
    ?? meta.font_family
    ?? meta.storeFont
    ?? meta.store_font
    ?? meta.font
  const forceUppercaseRaw =
    meta.forceUppercaseText
    ?? meta.force_uppercase_text
    ?? meta.uppercaseText
    ?? meta.uppercase_text
    ?? meta.uppercase

  const defaultInfoBanners = fallback.infoBanners ?? {
    pedidoMinimo: { isActive: true, icon: 'package', title: 'Pedido Minimo', description: 'A partir de 6 pecas' },
    entrega: { isActive: true, icon: 'truck', title: 'Entrega', description: 'Para todo o Brasil' },
    pagamento: { isActive: true, icon: 'credit-card', title: 'Pagamento', description: 'Ate 6x sem juros' },
    atendimento: { isActive: true, icon: 'users', title: 'Atendimento', description: 'Vendedora exclusiva' },
  }

  const normalizeInfoBanner = (raw: unknown, defaultBanner: typeof defaultInfoBanners.pedidoMinimo) => {
    if (!raw || typeof raw !== 'object') return defaultBanner

    const banner = raw as Record<string, unknown>
    const icon = banner.icon

    return {
      isActive: typeof banner.isActive === 'boolean' ? banner.isActive : defaultBanner.isActive,
      icon:
        icon === 'package' || icon === 'truck' || icon === 'credit-card' || icon === 'users' ||
        icon === 'clock' || icon === 'shield' || icon === 'star' || icon === 'heart'
          ? icon
          : defaultBanner.icon,
      title: typeof banner.title === 'string' ? banner.title : defaultBanner.title,
      description: typeof banner.description === 'string' ? banner.description : defaultBanner.description,
    }
  }

  const normalizeBanner = (raw: unknown, defaultBanner?: BannerConfig | null): BannerConfig | null => {
    if (!raw || typeof raw !== 'object') return defaultBanner ?? null

    const banner = raw as Record<string, unknown>

    return {
      imageUrl:
        typeof banner.imageUrl === 'string'
          ? banner.imageUrl
          : defaultBanner?.imageUrl || '',
      mobileImageUrl:
        typeof banner.mobileImageUrl === 'string'
          ? banner.mobileImageUrl
          : defaultBanner?.mobileImageUrl || null,
      altText:
        typeof banner.altText === 'string'
          ? banner.altText
          : defaultBanner?.altText || '',
      linkUrl:
        typeof banner.linkUrl === 'string'
          ? banner.linkUrl
          : null,
      isActive:
        typeof banner.isActive === 'boolean'
          ? banner.isActive
          : defaultBanner?.isActive ?? true,
      useMobileImage:
        typeof banner.useMobileImage === 'boolean'
          ? banner.useMobileImage
          : (typeof banner.mobileImageUrl === 'string' ? true : (defaultBanner?.useMobileImage ?? false)),
    }
  }

  const infoBanners = infoBannersRaw && typeof infoBannersRaw === 'object'
    ? {
        pedidoMinimo: normalizeInfoBanner((infoBannersRaw as Record<string, unknown>).pedidoMinimo, defaultInfoBanners.pedidoMinimo),
        entrega: normalizeInfoBanner((infoBannersRaw as Record<string, unknown>).entrega, defaultInfoBanners.entrega),
        pagamento: normalizeInfoBanner((infoBannersRaw as Record<string, unknown>).pagamento, defaultInfoBanners.pagamento),
        atendimento: normalizeInfoBanner((infoBannersRaw as Record<string, unknown>).atendimento, defaultInfoBanners.atendimento),
      }
    : defaultInfoBanners

  const parseAnnouncementItems = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      const normalized = value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)

      if (normalized.length > 0) return normalized
    }

    if (typeof value === 'string') {
      const normalized = value
        .split('|')
        .map((entry) => entry.trim())
        .filter(Boolean)

      if (normalized.length > 0) return normalized
    }

    return [...fallbackAnnouncementBar.items]
  }

  const announcementBar = announcementBarRaw && typeof announcementBarRaw === 'object'
    ? {
        enabled:
          typeof (announcementBarRaw as Record<string, unknown>).enabled === 'boolean'
            ? (announcementBarRaw as Record<string, unknown>).enabled as boolean
            : fallbackAnnouncementBar.enabled,
        items: parseAnnouncementItems(
          (announcementBarRaw as Record<string, unknown>).items
          ?? (announcementBarRaw as Record<string, unknown>).text
        ),
        separator:
          typeof (announcementBarRaw as Record<string, unknown>).separator === 'string'
            ? ((announcementBarRaw as Record<string, unknown>).separator as string).trim() || fallbackAnnouncementBar.separator
            : fallbackAnnouncementBar.separator,
        backgroundColor:
          typeof (announcementBarRaw as Record<string, unknown>).backgroundColor === 'string'
            ? (announcementBarRaw as Record<string, unknown>).backgroundColor as string
            : fallbackAnnouncementBar.backgroundColor,
        textColor:
          typeof (announcementBarRaw as Record<string, unknown>).textColor === 'string'
            ? (announcementBarRaw as Record<string, unknown>).textColor as string
            : fallbackAnnouncementBar.textColor,
        isAnimated:
          typeof (announcementBarRaw as Record<string, unknown>).isAnimated === 'boolean'
            ? (announcementBarRaw as Record<string, unknown>).isAnimated as boolean
            : fallbackAnnouncementBar.isAnimated,
        animationSpeed:
          (announcementBarRaw as Record<string, unknown>).animationSpeed === 'SLOW'
          || (announcementBarRaw as Record<string, unknown>).animationSpeed === 'FAST'
          || (announcementBarRaw as Record<string, unknown>).animationSpeed === 'NORMAL'
            ? (announcementBarRaw as Record<string, unknown>).animationSpeed as 'SLOW' | 'NORMAL' | 'FAST'
            : fallbackAnnouncementBar.animationSpeed,
      }
    : fallbackAnnouncementBar

  const fallbackPopupCoupon = fallback.popupCoupon ?? {
    enabled: false,
    imageUrl: null,
    couponCode: '',
    applyButtonText: 'Aplicar cupom',
  }

  const popupCoupon = popupCouponRaw && typeof popupCouponRaw === 'object'
    ? {
        enabled:
          typeof (popupCouponRaw as Record<string, unknown>).enabled === 'boolean'
            ? (popupCouponRaw as Record<string, unknown>).enabled as boolean
            : fallbackPopupCoupon.enabled,
        imageUrl:
          typeof (popupCouponRaw as Record<string, unknown>).imageUrl === 'string'
            ? (popupCouponRaw as Record<string, unknown>).imageUrl as string
            : fallbackPopupCoupon.imageUrl,
        couponCode:
          typeof (popupCouponRaw as Record<string, unknown>).couponCode === 'string'
            ? ((popupCouponRaw as Record<string, unknown>).couponCode as string)
            : fallbackPopupCoupon.couponCode,
        applyButtonText:
          typeof (popupCouponRaw as Record<string, unknown>).applyButtonText === 'string'
            ? ((popupCouponRaw as Record<string, unknown>).applyButtonText as string)
            : fallbackPopupCoupon.applyButtonText,
      }
    : fallbackPopupCoupon

  const fallbackMainBanners = Array.isArray(fallback.mainBanners) && fallback.mainBanners.length > 0
    ? fallback.mainBanners
    : fallback.mainBanner
      ? [fallback.mainBanner]
      : []

  const mainBanners = Array.isArray(mainBannersRaw)
    ? mainBannersRaw
        .map((entry, index) => normalizeBanner(entry, fallbackMainBanners[index] || fallbackMainBanners[0] || null))
        .filter((entry): entry is BannerConfig => Boolean(entry))
    : (() => {
        const legacyBanner = mainBannerRaw === null
          ? null
          : normalizeBanner(mainBannerRaw, fallback.mainBanner)

        if (legacyBanner) return [legacyBanner]
        return fallbackMainBanners
      })()

  const mainBanner = mainBanners[0] || null

  const fallbackMiniBanners = Array.isArray(fallback.miniBanners)
    ? fallback.miniBanners
    : []

  const miniBanners = Array.isArray(miniBannersRaw)
    ? miniBannersRaw
        .map((entry, index) => normalizeBanner(entry, fallbackMiniBanners[index] || fallbackMiniBanners[0] || null))
        .filter((entry): entry is BannerConfig => Boolean(entry))
    : fallbackMiniBanners

  const categoryBannerMode: SiteCustomization['categoryBannerMode'] =
    categoryBannerModeRaw === 'auto' || categoryBannerModeRaw === 'disabled' || categoryBannerModeRaw === 'custom'
      ? categoryBannerModeRaw
      : (fallback.categoryBannerMode || 'custom')

  const categoryBanners = Array.isArray(categoryBannersRaw)
    ? categoryBannersRaw
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map((entry) => {
          const mode: 'auto' | 'custom' = entry.mode === 'auto' || entry.mode === 'custom'
            ? entry.mode
            : (categoryBannerMode === 'auto' ? 'auto' : 'custom')

          return {
            categoryId: typeof entry.categoryId === 'string' ? entry.categoryId : '',
            imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : '',
            altText: typeof entry.altText === 'string' ? entry.altText : '',
            isActive: typeof entry.isActive === 'boolean' ? entry.isActive : true,
            mode,
          }
        })
    : fallback.categoryBanners

  const storefrontDisplayMode: SiteCustomization['storefrontDisplayMode'] =
    storefrontDisplayModeRaw === 'products' || storefrontDisplayModeRaw === 'imageLevels'
      ? storefrontDisplayModeRaw
      : (fallback.storefrontDisplayMode || 'products')

  const storefrontNavigationMode: SiteCustomization['storefrontNavigationMode'] =
    storefrontNavigationModeRaw === 'pagination' || storefrontNavigationModeRaw === 'infiniteScroll'
      ? storefrontNavigationModeRaw
      : (fallback.storefrontNavigationMode || 'pagination')

  const storefrontDefaultSort: SiteCustomization['storefrontDefaultSort'] =
    storefrontDefaultSortRaw === 'relevance'
    || storefrontDefaultSortRaw === 'price_asc'
    || storefrontDefaultSortRaw === 'price_desc'
    || storefrontDefaultSortRaw === 'newest'
    || storefrontDefaultSortRaw === 'sku'
      ? storefrontDefaultSortRaw
      : (fallback.storefrontDefaultSort || 'relevance')

  const showPixDiscount = parseBoolean(meta.showPixDiscount ?? meta.show_pix_discount)
    ?? (typeof fallback.showPixDiscount === 'boolean' ? fallback.showPixDiscount : true)
  const showInstallments = parseBoolean(meta.showInstallments ?? meta.show_installments)
    ?? (typeof fallback.showInstallments === 'boolean' ? fallback.showInstallments : true)

  const fallbackHomeCategories = Array.isArray(fallback.homeCategories)
    ? fallback.homeCategories
    : []

  const homeCategories = Array.isArray(homeCategoriesRaw)
    ? homeCategoriesRaw
        .map((entry) => {
          if (typeof entry === 'string') {
            return {
              categoryId: entry,
              title: undefined,
              isActive: true,
            }
          }

          if (!entry || typeof entry !== 'object') {
            return null
          }

          const raw = entry as Record<string, unknown>
          const categoryId = typeof raw.categoryId === 'string'
            ? raw.categoryId
            : (typeof raw.id === 'string' ? raw.id : '')

          if (!categoryId) {
            return null
          }

          return {
            categoryId,
            title: typeof raw.title === 'string' ? raw.title : undefined,
            isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
          }
        })
        .filter((entry): entry is SiteCustomization['homeCategories'][number] => Boolean(entry))
    : fallbackHomeCategories

  return {
    primaryColor: typeof meta.primaryColor === 'string' ? meta.primaryColor : fallback.primaryColor,
    secondaryColor: typeof meta.secondaryColor === 'string' ? meta.secondaryColor : fallback.secondaryColor,
    accentColor: typeof meta.accentColor === 'string' ? meta.accentColor : fallback.accentColor,
    backgroundColor: typeof meta.backgroundColor === 'string' ? meta.backgroundColor : fallback.backgroundColor,
    textColor: typeof meta.textColor === 'string' ? meta.textColor : fallback.textColor,
    buttonColor: typeof meta.buttonColor === 'string' ? meta.buttonColor : fallback.buttonColor,
    buttonTextColor: typeof meta.buttonTextColor === 'string' ? meta.buttonTextColor : fallback.buttonTextColor,
    fontFamily: normalizeFontFamily(fontFamilyRaw) ?? fallbackFontFamily,
    forceUppercaseText: parseBoolean(forceUppercaseRaw) ?? fallbackForceUppercaseText,
    menuTransparent: parseBoolean(meta.menuTransparent) ?? false,
    announcementBar,
    popupCoupon,
    mainBanners,
    miniBanners,
    mainBanner,
    categoryBannerMode,
    categoryBanners,
    infoBanners,
    homeCategories,
    storefrontDisplayMode,
    storefrontNavigationMode,
    storefrontDefaultSort,
    showPixDiscount,
    showInstallments,
    mediaAspectWidth,
    mediaAspectHeight,
    loginSideImageUrl:
      typeof meta.loginSideImageUrl === 'string'
        ? meta.loginSideImageUrl
        : (typeof meta.login_side_image_url === 'string'
          ? meta.login_side_image_url
          : (fallback.loginSideImageUrl ?? null)),
    logoUrl: typeof meta.logoUrl === 'string' ? meta.logoUrl : fallback.logoUrl,
    logoLightUrl: typeof meta.logoLightUrl === 'string' ? meta.logoLightUrl : fallback.logoLightUrl,
    logoDarkUrl: typeof meta.logoDarkUrl === 'string' ? meta.logoDarkUrl : fallback.logoDarkUrl,
    faviconUrl: typeof meta.faviconUrl === 'string' ? meta.faviconUrl : fallback.faviconUrl,
  }
}

function normalizePaymentSettingsMeta(meta: Record<string, unknown>, fallback: PaymentSettings): PaymentSettingsMeta {
  const read = (camelKey: string, snakeKey: string): unknown => {
    if (meta[camelKey] !== undefined) return meta[camelKey]
    if (meta[snakeKey] !== undefined) return meta[snakeKey]
    return undefined
  }

  const enablePixRaw = read('enablePix', 'enable_pix')
  const enableBoletoRaw = read('enableBoleto', 'enable_boleto')
  const enableCreditCardRaw = read('enableCreditCard', 'enable_credit_card')
  const maxInstallmentsRaw = read('maxInstallments', 'max_installments')
  const enableFaturadoRaw = read('enableFaturado', 'enable_faturado')
  const faturadoMinOrderValueRaw = read('faturadoMinOrderValue', 'faturado_min_order_value')
  const faturadoMaxDaysRaw = read('faturadoMaxDays', 'faturado_max_days')
  const pixConditionsRaw = read('pixConditions', 'pix_conditions')
  const boletoConditionsRaw = read('boletoConditions', 'boleto_conditions')
  const creditCardConditionsRaw = read('creditCardConditions', 'credit_card_conditions')
  const faturadoConditionsRaw = read('faturadoConditions', 'faturado_conditions')
  const customMethodsRaw = read('customMethods', 'custom_methods')
  const gatewayEnvironmentRaw = String(
    read('gatewayEnvironment', 'gateway_environment')
      ?? read('environment', 'environment')
      ?? fallback.gatewayEnvironment
      ?? '',
  )
    .trim()
    .toUpperCase()

  const mode = meta.mode === 'INTEGRATED' ? 'INTEGRATED' : (meta.mode === 'MANUAL' ? 'MANUAL' : fallback.mode)
  const integratedFlowRaw = String(read('integratedFlow', 'integrated_flow') ?? fallback.integratedFlow ?? 'AUTO_CHARGE')
    .trim()
    .toUpperCase()
  const integratedFlow: PaymentSettings['integratedFlow'] = integratedFlowRaw === 'LINK_AFTER_VALIDATION'
    ? 'LINK_AFTER_VALIDATION'
    : 'AUTO_CHARGE'
  const rawProvider = String(meta.provider || '').trim().toUpperCase()
  const normalizedProvider = rawProvider === 'PAGSEGURO' ? 'PAGBANK' : rawProvider
  const provider = ['STRIPE', 'MERCADO_PAGO', 'PAGBANK', 'ASAAS', 'GETNET', 'PAGARME', 'REDE', 'NONE'].includes(normalizedProvider)
    ? (normalizedProvider as PaymentSettings['provider'])
    : fallback.provider
  const gatewayEnvironment: PaymentSettings['gatewayEnvironment'] = gatewayEnvironmentRaw === 'SANDBOX'
    ? 'SANDBOX'
    : (gatewayEnvironmentRaw === 'PRODUCTION' || gatewayEnvironmentRaw === 'PROD' || gatewayEnvironmentRaw === 'LIVE')
      ? 'PRODUCTION'
      : (fallback.gatewayEnvironment ?? 'PRODUCTION')

  const normalizeConditions = (
    raw: unknown,
    fallbackConditions: PaymentSettings['pixConditions'],
  ): NonNullable<PaymentSettings['pixConditions']> => {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const fallbackValue = fallbackConditions || {
      discountPercent: 0,
      discountFixed: 0,
      feePercent: 0,
      minOrderValue: null,
      maxOrderValue: null,
      allowDiscountCombination: true,
      label: null,
    }

    return {
      discountPercent: toOptionalNumber(source.discountPercent) ?? fallbackValue.discountPercent,
      discountFixed: source.discountFixed === null
        ? null
        : centsToCurrency(source.discountFixed) ?? fallbackValue.discountFixed,
      feePercent: toOptionalNumber(source.feePercent) ?? fallbackValue.feePercent,
      minOrderValue: source.minOrderValue === null
        ? null
        : centsToCurrency(source.minOrderValue) ?? fallbackValue.minOrderValue,
      maxOrderValue: source.maxOrderValue === null
        ? null
        : centsToCurrency(source.maxOrderValue) ?? fallbackValue.maxOrderValue,
      minInstallmentAmount: source.minInstallmentAmount === null
        ? null
        : centsToCurrency(source.minInstallmentAmount) ?? fallbackValue.minInstallmentAmount,
      allowDiscountCombination: typeof source.allowDiscountCombination === 'boolean'
        ? source.allowDiscountCombination
        : (source.allow_discount_combination === null
          ? null
          : typeof source.allow_discount_combination === 'boolean'
            ? source.allow_discount_combination
            : (fallbackValue.allowDiscountCombination ?? true)),
      label: typeof source.label === 'string' ? source.label : (source.label === null ? null : fallbackValue.label),
    }
  }

  const normalizeCustomMethods = (raw: unknown, fallbackMethods: PaymentSettings['customMethods']) => {
    const sourceList = Array.isArray(raw) ? raw : (Array.isArray(fallbackMethods) ? fallbackMethods : [])
    const seenIds = new Set<string>()

    const ensureUniqueId = (rawId: string, paymentMethodId: number | null, index: number): string => {
      const base = rawId.trim() || (paymentMethodId != null ? `custom_${paymentMethodId}` : `custom_${index + 1}`)
      if (!seenIds.has(base)) {
        seenIds.add(base)
        return base
      }

      if (paymentMethodId != null) {
        const withPaymentMethodId = `${base}_${paymentMethodId}`
        if (!seenIds.has(withPaymentMethodId)) {
          seenIds.add(withPaymentMethodId)
          return withPaymentMethodId
        }
      }

      let suffix = 2
      while (seenIds.has(`${base}_${suffix}`)) {
        suffix += 1
      }

      const uniqueId = `${base}_${suffix}`
      seenIds.add(uniqueId)
      return uniqueId
    }

    return sourceList
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry, index) => {
        const paymentMethodId = toOptionalNumber(entry.paymentMethodId ?? entry.payment_method_id)

        return {
          id: ensureUniqueId(typeof entry.id === 'string' ? entry.id : '', paymentMethodId, index),
          paymentMethodId,
          title: typeof entry.title === 'string' ? entry.title : '',
          description: typeof entry.description === 'string' ? entry.description : '',
          icon: typeof entry.icon === 'string' ? entry.icon : null,
          isActive: typeof entry.isActive === 'boolean' ? entry.isActive : true,
          sortOrder: toOptionalNumber(entry.sortOrder) ?? index + 1,
          conditions: normalizeConditions(entry.conditions, {
            discountPercent: 0,
            discountFixed: 0,
            feePercent: 0,
            minOrderValue: null,
            maxOrderValue: null,
            minInstallmentAmount: null,
            allowDiscountCombination: true,
            label: null,
          }),
        }
      })
  }

  return {
    mode,
    integratedFlow,
    provider,
    gatewayEnvironment,
    manualInstructions: typeof meta.manualInstructions === 'string' ? meta.manualInstructions : fallback.manualInstructions,
    apiKey: typeof meta.apiKey === 'string' ? meta.apiKey : (meta.apiKey === null ? null : fallback.apiKey),
    secretKey: typeof meta.secretKey === 'string' ? meta.secretKey : (meta.secretKey === null ? null : fallback.secretKey),
    webhookSecret: typeof meta.webhookSecret === 'string' ? meta.webhookSecret : (meta.webhookSecret === null ? null : fallback.webhookSecret),
    webhookToken: typeof meta.webhookToken === 'string' ? meta.webhookToken : (meta.webhookToken === null ? null : fallback.webhookToken),
    providerWebhookUrl: typeof meta.providerWebhookUrl === 'string'
      ? meta.providerWebhookUrl
      : (typeof meta.provider_webhook_url === 'string'
        ? meta.provider_webhook_url
        : (meta.providerWebhookUrl === null || meta.provider_webhook_url === null
          ? null
          : fallback.providerWebhookUrl)),
    providerCronUrl: typeof meta.providerCronUrl === 'string'
      ? meta.providerCronUrl
      : (typeof meta.provider_cron_url === 'string'
        ? meta.provider_cron_url
        : (meta.providerCronUrl === null || meta.provider_cron_url === null
          ? null
          : fallback.providerCronUrl)),
    getnetWebhookEvent: typeof meta.getnetWebhookEvent === 'string'
      ? meta.getnetWebhookEvent
      : (typeof meta.getnet_webhook_event === 'string'
        ? meta.getnet_webhook_event
        : (meta.getnetWebhookEvent === null || meta.getnet_webhook_event === null
          ? null
          : (fallback.getnetWebhookEvent ?? null))),
    getnetWebhookSubscriptionId: typeof meta.getnetWebhookSubscriptionId === 'string'
      ? meta.getnetWebhookSubscriptionId
      : (typeof meta.getnet_webhook_subscription_id === 'string'
        ? meta.getnet_webhook_subscription_id
        : (meta.getnetWebhookSubscriptionId === null || meta.getnet_webhook_subscription_id === null
          ? null
          : (fallback.getnetWebhookSubscriptionId ?? null))),
    getnetWebhookAuthenticationType: typeof meta.getnetWebhookAuthenticationType === 'string'
      ? meta.getnetWebhookAuthenticationType
      : (typeof meta.getnet_webhook_authentication_type === 'string'
        ? meta.getnet_webhook_authentication_type
        : (meta.getnetWebhookAuthenticationType === null || meta.getnet_webhook_authentication_type === null
          ? null
          : (fallback.getnetWebhookAuthenticationType ?? null))),
    enablePix: typeof enablePixRaw === 'boolean' ? enablePixRaw : fallback.enablePix,
    enableBoleto: typeof enableBoletoRaw === 'boolean' ? enableBoletoRaw : fallback.enableBoleto,
    enableCreditCard: typeof enableCreditCardRaw === 'boolean' ? enableCreditCardRaw : fallback.enableCreditCard,
    maxInstallments: Math.min(12, Math.max(1, Math.trunc(toOptionalNumber(maxInstallmentsRaw) ?? fallback.maxInstallments))),
    enableFaturado: typeof enableFaturadoRaw === 'boolean' ? enableFaturadoRaw : fallback.enableFaturado,
    faturadoMinOrderValue: faturadoMinOrderValueRaw === null
      ? null
      : centsToCurrency(faturadoMinOrderValueRaw) ?? fallback.faturadoMinOrderValue,
    faturadoMaxDays: toOptionalNumber(faturadoMaxDaysRaw) ?? fallback.faturadoMaxDays,
    pixConditions: normalizeConditions(pixConditionsRaw, fallback.pixConditions),
    boletoConditions: normalizeConditions(boletoConditionsRaw, fallback.boletoConditions),
    creditCardConditions: normalizeConditions(creditCardConditionsRaw, fallback.creditCardConditions),
    faturadoConditions: normalizeConditions(faturadoConditionsRaw, fallback.faturadoConditions),
    customMethods: normalizeCustomMethods(customMethodsRaw, fallback.customMethods),
  }
}

function getFormValue(formData: FormData, field: string): FormDataEntryValue | null {
  if (formData.has(field)) {
    return formData.get(field)
  }

  const suffix = `_${field}`
  for (const [key, value] of formData.entries()) {
    if (key.endsWith(suffix)) {
      return value
    }
  }

  return null
}

function hasFormField(formData: FormData, field: string): boolean {
  return getFormValue(formData, field) !== null
}

function getFormString(formData: FormData, field: string): string | null {
  const value = getFormValue(formData, field)
  return typeof value === 'string' ? value : null
}

async function getB2BSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/settings', base)
    url.searchParams.set('store_id', String(storeId))
    url.searchParams.set('code', 'b2b')

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const fallback = 'Erro ao buscar configuração b2b'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord[]
    const first = Array.isArray(payload) ? payload[0] : null
    const normalizedMeta = normalizeTransportValue(first?.meta)
    const meta = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: meta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configuração b2b'),
    }
  }
}

async function getThemeSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  try {
    const explicitStoreId = normalizeStoreIdInput(preferredStoreId)
    const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
    const acceptedThemeCodes = new Set(['theme', 'store_theme', 'theme_settings'])

    const fetchSettings = async (params: { storeId?: number | null; code?: string }) => {
      const url = new URL('/settings', base)
      if (typeof params.storeId === 'number') {
        url.searchParams.set('store_id', String(params.storeId))
      }
      if (params.code) {
        url.searchParams.set('code', params.code)
      }

      const response = await fetch(url, {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        return null
      }

      const payload = (await response.json()) as BackendSettingRecord[]
      return Array.isArray(payload) ? payload : []
    }

    const pickThemeMeta = (records: BackendSettingRecord[] | null) => {
      if (!records || records.length === 0) return null

      const byExactTheme = records.find((record) =>
        String(record?.code || '').trim().toLowerCase() === 'theme'
      )
      if (byExactTheme?.meta && typeof byExactTheme.meta === 'object') {
        return byExactTheme.meta as Record<string, unknown>
      }

      const byAcceptedCode = records.find((record) =>
        acceptedThemeCodes.has(String(record?.code || '').trim().toLowerCase())
      )
      if (byAcceptedCode?.meta && typeof byAcceptedCode.meta === 'object') {
        return byAcceptedCode.meta as Record<string, unknown>
      }

      return null
    }

    const recordsWithStoreAndCode = await fetchSettings({ storeId, code: 'theme' })
    let meta = pickThemeMeta(recordsWithStoreAndCode)

    if (!meta && typeof storeId === 'number') {
      const recordsWithStore = await fetchSettings({ storeId })
      meta = pickThemeMeta(recordsWithStore)
    }

    if (!meta && explicitStoreId) {
      return { success: true, data: {} }
    }

    if (!meta) {
      const recordsWithCodeOnly = await fetchSettings({ code: 'theme' })
      meta = pickThemeMeta(recordsWithCodeOnly)
    }

    if (!meta) {
      const recordsNoFilters = await fetchSettings({})
      meta = pickThemeMeta(recordsNoFilters)
    }

    if (!meta) {
      return { success: true, data: {} }
    }

    const normalizedMeta = normalizeTransportValue(meta)
    const normalizedObject = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: normalizedObject }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configuração de tema'),
    }
  }
}

async function getProductSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/settings', base)
    url.searchParams.set('store_id', String(storeId))
    url.searchParams.set('code', 'product')

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const fallback = 'Erro ao buscar configuração de produto'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord[]
    const first = Array.isArray(payload) ? payload[0] : null
    const normalizedMeta = normalizeTransportValue(first?.meta)
    const meta = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: meta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configuração de produto'),
    }
  }
}

async function getPaymentSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  try {
    const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
    if (!storeId) {
      return { success: false, error: 'Erro ao obter loja atual' }
    }

    const url = new URL('/payment-config', base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const fallback = 'Erro ao buscar configuração de pagamento'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    if (!payload || typeof payload !== 'object') {
      return { success: true, data: {} }
    }

    const normalizedMeta = normalizeTransportValue(payload)
    const normalizedObject = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: normalizedObject }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configuração de pagamento'),
    }
  }
}

async function saveB2BSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: B2BSettingsMeta,
  actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Loja do admin não resolvida para criar usuário' }
  }
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const actorIdParsed = Number(actorUserId)
  const actorId = Number.isInteger(actorIdParsed) ? actorIdParsed : null

  try {
    const response = await fetch(new URL('/settings/upsert', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        code: 'b2b',
        title: 'B2B Settings',
        meta,
        updated_by: actorId,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configuração b2b'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord
    const savedMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}
    return { success: true, data: savedMeta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao salvar configuração b2b'),
    }
  }
}

async function getStockSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/settings', base)
    url.searchParams.set('store_id', String(storeId))
    url.searchParams.set('code', 'stock')

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar configuração de estoque' }
    }

    const payload = (await response.json()) as BackendSettingRecord[]
    const first = Array.isArray(payload) ? payload[0] : null
    const normalizedMeta = normalizeTransportValue(first?.meta)
    const meta = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: meta }
  } catch {
    return { success: false, error: 'Erro ao buscar configuração de estoque' }
  }
}

async function saveStockSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: { stockMode: string; variantMaxQty: number },
  actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Loja do admin não resolvida' }
  }

  const actorIdParsed = Number(actorUserId)
  const actorId = Number.isInteger(actorIdParsed) ? actorIdParsed : null

  try {
    const response = await fetch(new URL('/settings/upsert', base), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({
        store_id: storeId,
        code: 'stock',
        title: 'Stock Settings',
        meta,
        updated_by: actorId,
      }),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao salvar configuração de estoque')
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord
    const savedMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}
    return { success: true, data: savedMeta as Record<string, unknown> }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao salvar configuração de estoque') }
  }
}

async function getShippingSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
  }

  const getMethodIntegration = (method: ShippingMethodBackend): string => {
    const settings = asRecord(method.settings)
    const integration = settings.integration
    if (typeof integration === 'string' && integration.trim()) {
      return integration.trim().toUpperCase()
    }
    return String(method.type || '').trim().toUpperCase()
  }

  const findByIntegration = (
    methods: ShippingMethodBackend[],
    integration: string,
  ): ShippingMethodBackend | null => {
    const normalized = integration.trim().toUpperCase()
    return methods.find((method) => getMethodIntegration(method) === normalized) ?? null
  }

  try {
    const url = new URL('/shipping/methods', base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const fallback = 'Erro ao buscar configuração de frete'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const methods = (await response.json()) as ShippingMethodBackend[]
    if (!Array.isArray(methods) || methods.length === 0) {
      return { success: true, data: {} }
    }

    const globalMethod = findByIntegration(methods, 'GLOBAL_FREE')
    const regionalMethod = findByIntegration(methods, 'REGIONAL_OFFER')
    const correiosMethod = findByIntegration(methods, 'CORREIOS')
    const customFixedMethod = methods.find((method) => {
      if (String(method.type || '').trim().toUpperCase() !== 'TABELA_FIXA') return false
      const integration = getMethodIntegration(method)
      return integration === 'CUSTOM_TABLE' || integration === 'TABELA_FIXA'
    }) ?? null

    const sharedSource = [globalMethod, regionalMethod, correiosMethod, ...methods]
      .find((method) => {
        if (!method) return false
        const settings = asRecord(method.settings)
        return [
          'defaultPackage',
          'defaultOriginCep',
          'defaultPackageWeight',
          'checkoutMessage',
          'showEstimatedDelivery',
          'freeShippingRegions',
          'customMethods',
          'correios',
        ].some((key) => key in settings)
      })

    const sharedSettings = asRecord(sharedSource?.settings)
    const regionalSettings = asRecord(regionalMethod?.settings)
    const correiosSettings = asRecord(correiosMethod?.settings)
    const customSettings = asRecord(customFixedMethod?.settings)
    const correiosMeta = asRecord(correiosSettings.correios)

    const defaultOriginCep =
      typeof sharedSettings.defaultOriginCep === 'string'
        ? sharedSettings.defaultOriginCep
        : typeof correiosSettings.originCep === 'string'
          ? correiosSettings.originCep
          : ''

    const freeShippingMinValue = globalMethod
      ? Math.max(0, Number(globalMethod.free_shipping_min_value_cents || 0)) / 100
      : sharedSettings.freeShippingMinValue

    const customMethods = Array.isArray(customSettings.customMethods)
      ? customSettings.customMethods
      : Array.isArray(sharedSettings.customMethods)
        ? sharedSettings.customMethods
        : []

    const meta: Record<string, unknown> = {
      ...sharedSettings,
      freeShippingEnabled: globalMethod?.active ?? sharedSettings.freeShippingEnabled,
      freeShippingMinValue,
      customMethods,
      regionalOffers: Array.isArray(regionalSettings.regionalOffers)
        ? regionalSettings.regionalOffers
        : sharedSettings.regionalOffers,
      defaultOriginCep,
      correios: {
        ...correiosMeta,
        enabled: correiosMethod?.active ?? correiosMeta.enabled,
        originCep:
          typeof correiosSettings.originCep === 'string'
            ? correiosSettings.originCep
            : (typeof correiosMeta.originCep === 'string' ? correiosMeta.originCep : defaultOriginCep),
      },
    }

    return { success: true, data: normalizeTransportValue(meta) as Record<string, unknown> }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configuração de frete'),
    }
  }
}

async function getMarketingSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/settings', base)
    url.searchParams.set('store_id', String(storeId))
    url.searchParams.set('code', 'marketing')

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar configurações de marketing' }
    }

    const payload = (await response.json()) as BackendSettingRecord[]
    const first = Array.isArray(payload) ? payload[0] : null
    const normalizedMeta = normalizeTransportValue(first?.meta)
    const meta = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: meta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configurações de marketing'),
    }
  }
}

async function getDomainSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/settings', base)
    url.searchParams.set('store_id', String(storeId))
    url.searchParams.set('code', 'domain')

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar configurações de domínio' }
    }

    const payload = (await response.json()) as BackendSettingRecord[]
    const first = Array.isArray(payload) ? payload[0] : null
    const normalizedMeta = normalizeTransportValue(first?.meta)
    const meta = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: meta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configurações de domínio'),
    }
  }
}

async function getErpSettingsMetaFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/settings', base)
    url.searchParams.set('store_id', String(storeId))
    url.searchParams.set('code', 'erp')

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar configurações de ERP' }
    }

    const payload = (await response.json()) as BackendSettingRecord[]
    const first = Array.isArray(payload) ? payload[0] : null
    const normalizedMeta = normalizeTransportValue(first?.meta)
    const meta = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return { success: true, data: meta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar configurações de ERP'),
    }
  }
}

async function saveShippingSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: ShippingSettings,
  _actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
  }

  const toCents = (value: number): number => Math.max(0, Math.round((Number(value) || 0) * 100))

  const getMethodIntegration = (method: ShippingMethodBackend): string => {
    const settings = asRecord(method.settings)
    const integration = settings.integration
    if (typeof integration === 'string' && integration.trim()) {
      return integration.trim().toUpperCase()
    }
    return String(method.type || '').trim().toUpperCase()
  }

  const findByIntegration = (
    methods: ShippingMethodBackend[],
    integration: string,
  ): ShippingMethodBackend | null => {
    const normalized = integration.trim().toUpperCase()
    return methods.find((method) => getMethodIntegration(method) === normalized) ?? null
  }

  const hasCorreiosConfiguration = (value: ShippingSettings['correios']): boolean => {
    return Boolean(
      value.enabled ||
      value.idCorreios ||
      value.apiKey ||
      value.postcardNumber ||
      value.originCep ||
      value.contractCode ||
      value.contractPassword ||
      value.additionalDays ||
      value.markupPercent ||
      value.markupFixed,
    )
  }

  const upsertMethod = async (
    existingMethod: ShippingMethodBackend | null,
    payload: {
      name: string
      type: string
      free_shipping: boolean
      free_shipping_min_value_cents: number
      active: boolean
      reverse_code_status: boolean
      settings: Record<string, unknown>
      priority: number
    },
  ): Promise<ApiResponse<ShippingMethodBackend>> => {
    const targetUrl = existingMethod
      ? new URL(`/shipping/methods/${existingMethod.id}`, base)
      : new URL('/shipping/methods', base)

    const response = await fetch(targetUrl, {
      method: existingMethod ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        name: payload.name,
        type: payload.type,
        store_id: storeId,
        free_shipping: payload.free_shipping,
        free_shipping_min_value_cents: payload.free_shipping_min_value_cents,
        active: payload.active,
        reverse_code_status: payload.reverse_code_status,
        settings: payload.settings,
        priority: payload.priority,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configuração de frete'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const method = (await response.json()) as ShippingMethodBackend
    return { success: true, data: method }
  }

  try {
    const methodsResponse = await fetch(new URL(`/shipping/methods?store_id=${storeId}`, base), {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (!methodsResponse.ok) {
      const fallback = 'Erro ao buscar métodos de frete'
      const errorText = await getBackendErrorMessage(methodsResponse, fallback)
      return { success: false, error: errorText }
    }

    const methods = (await methodsResponse.json()) as ShippingMethodBackend[]

    const globalMethod = findByIntegration(methods, 'GLOBAL_FREE')
    const regionalMethod = findByIntegration(methods, 'REGIONAL_OFFER')
    const correiosMethod = findByIntegration(methods, 'CORREIOS')
    const customFixedMethod = methods.find((method) => {
      if (String(method.type || '').trim().toUpperCase() !== 'TABELA_FIXA') return false
      const integration = getMethodIntegration(method)
      return integration === 'CUSTOM_TABLE' || integration === 'TABELA_FIXA'
    }) ?? null

    const globalSettings = {
      integration: 'GLOBAL_FREE',
      enabled: meta.freeShippingEnabled,
      delivery_days: 1,
      defaultPackage: meta.defaultPackage,
      defaultOriginCep: meta.defaultOriginCep,
      defaultPackageWeight: meta.defaultPackageWeight,
      checkoutMessage: meta.checkoutMessage,
      showEstimatedDelivery: meta.showEstimatedDelivery,
      freeShippingRegions: meta.freeShippingRegions,
    }

    const upsertGlobal = await upsertMethod(globalMethod, {
      name: globalMethod?.name || 'Frete Grátis Global',
      type: 'TABELA_FIXA',
      free_shipping: true,
      free_shipping_min_value_cents: toCents(meta.freeShippingMinValue),
      active: meta.freeShippingEnabled,
      reverse_code_status: false,
      settings: globalSettings,
      priority: globalMethod?.priority ?? -100,
    })

    if (!upsertGlobal.success) return { success: false, error: upsertGlobal.error }

    const hasRegionalOffers = meta.regionalOffers.some((offer) => offer.isActive)
    if (regionalMethod || meta.regionalOffers.length > 0) {
      const regionalSettings = {
        integration: 'REGIONAL_OFFER',
        enabled: hasRegionalOffers,
        checkoutMessage: meta.checkoutMessage,
        regionalOffers: meta.regionalOffers,
      }

      const upsertRegional = await upsertMethod(regionalMethod, {
        name: regionalMethod?.name || 'Ofertas de Frete por Região',
        type: 'TABELA_FIXA',
        free_shipping: false,
        free_shipping_min_value_cents: 0,
        active: hasRegionalOffers,
        reverse_code_status: false,
        settings: regionalSettings,
        priority: regionalMethod?.priority ?? -90,
      })

      if (!upsertRegional.success) return { success: false, error: upsertRegional.error }
    }

    if (correiosMethod || hasCorreiosConfiguration(meta.correios)) {
      const correiosOriginCep = meta.correios.originCep || meta.defaultOriginCep || ''
      const correiosSettings = {
        integration: 'CORREIOS',
        enabled: meta.correios.enabled,
        originCep: correiosOriginCep,
        checkoutMessage: meta.checkoutMessage,
        correios: {
          ...meta.correios,
          originCep: correiosOriginCep,
        },
      }

      const upsertCorreios = await upsertMethod(correiosMethod, {
        name: correiosMethod?.name || 'Correios',
        type: 'CORREIOS',
        free_shipping: false,
        free_shipping_min_value_cents: 0,
        active: meta.correios.enabled,
        reverse_code_status: false,
        settings: correiosSettings,
        priority: correiosMethod?.priority ?? 10,
      })

      if (!upsertCorreios.success) return { success: false, error: upsertCorreios.error }
    }

    const customMethodsWithName = (meta.customMethods || [])
      .filter((method) => String(method.name || '').trim().length > 0)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)

    if (customMethodsWithName.length > 0) {
      const fixedTableResponse = await fetch(new URL('/shipping/fixed-table', base), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          store_id: storeId,
          method_name: customMethodsWithName.length === 1
            ? customMethodsWithName[0].name.trim()
            : 'Métodos de Envio Personalizados',
          method_settings: {
            integration: 'CUSTOM_TABLE',
            checkoutMessage: meta.checkoutMessage,
            customMethods: customMethodsWithName,
          },
          options: customMethodsWithName.map((method, index) => ({
            name: method.name.trim(),
            estimated_days: Math.max(0, Math.trunc(method.maxDays || method.minDays || 0)),
            min_delivery_days: Math.max(0, Math.trunc(method.minDays || method.maxDays || 0)),
            max_delivery_days: Math.max(0, Math.trunc(method.maxDays || method.minDays || 0)),
            price_cents: method.pricingType === 'FREE' || method.pricingType === 'NEGOTIATED'
              ? 0
              : toCents(typeof method.fixedPrice === 'number' ? method.fixedPrice : 0),
            priority: typeof method.sortOrder === 'number' ? method.sortOrder : index,
            active: method.isActive !== false,
          })),
        }),
      })

      if (!fixedTableResponse.ok) {
        const fallback = 'Erro ao salvar métodos personalizados de frete'
        const errorText = await getBackendErrorMessage(fixedTableResponse, fallback)
        return { success: false, error: errorText }
      }
    } else if (customFixedMethod) {
      const deactivateCustom = await upsertMethod(customFixedMethod, {
        name: customFixedMethod.name || 'Métodos de Envio Personalizados',
        type: 'TABELA_FIXA',
        free_shipping: false,
        free_shipping_min_value_cents: 0,
        active: false,
        reverse_code_status: false,
        settings: {
          integration: 'CUSTOM_TABLE',
          checkoutMessage: meta.checkoutMessage,
        },
        priority: customFixedMethod.priority ?? 0,
      })

      if (!deactivateCustom.success) return { success: false, error: deactivateCustom.error }
    }

    return { success: true, data: normalizeTransportValue(meta) as Record<string, unknown> }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao salvar configuração de frete'),
    }
  }
}

async function saveThemeSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: ThemeSettingsMeta,
  actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const actorIdParsed = Number(actorUserId)
  const actorId = Number.isInteger(actorIdParsed) ? actorIdParsed : null

  try {
    const response = await fetch(new URL('/settings/upsert', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        code: 'theme',
        title: 'Theme Settings',
        meta,
        updated_by: actorId,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configuração de tema'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord
    const savedMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}
    return { success: true, data: savedMeta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao salvar configuração de tema'),
    }
  }
}

async function saveProductSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: ProductSettingsMeta,
  actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const actorIdParsed = Number(actorUserId)
  const actorId = Number.isInteger(actorIdParsed) ? actorIdParsed : null

  try {
    const response = await fetch(new URL('/settings/upsert', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        code: 'product',
        title: 'Product Settings',
        meta,
        updated_by: actorId,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configuração de produto'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord
    const savedMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}
    return { success: true, data: savedMeta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao salvar configuração de produto'),
    }
  }
}

async function savePaymentSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: PaymentSettingsMeta,
  actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  void actorUserId

  const toBackendConditions = (conditions: PaymentSettings['pixConditions']) => ({
    ...conditions,
    discountFixed: conditions.discountFixed === null ? null : currencyToCents(conditions.discountFixed),
    minOrderValue: conditions.minOrderValue === null ? null : currencyToCents(conditions.minOrderValue),
    maxOrderValue: conditions.maxOrderValue === null ? null : currencyToCents(conditions.maxOrderValue),
    minInstallmentAmount: conditions.minInstallmentAmount === null ? null : currencyToCents(conditions.minInstallmentAmount),
    allowDiscountCombination: conditions.allowDiscountCombination ?? true,
  })

  const backendPayload = {
    ...meta,
    faturadoMinOrderValue:
      meta.faturadoMinOrderValue === null ? null : currencyToCents(meta.faturadoMinOrderValue),
    pixConditions: toBackendConditions(meta.pixConditions),
    boletoConditions: toBackendConditions(meta.boletoConditions),
    creditCardConditions: toBackendConditions(meta.creditCardConditions),
    faturadoConditions: toBackendConditions(meta.faturadoConditions),
    customMethods: Array.isArray(meta.customMethods)
      ? meta.customMethods.map((method) => ({
          ...method,
          conditions: toBackendConditions(method.conditions),
        }))
      : [],
  }

  try {
    const response = await fetch(new URL('/payment-config', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        ...backendPayload,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configuração de pagamento'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    const savedMeta = payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : {}
    return { success: true, data: savedMeta }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao salvar configuração de pagamento'),
    }
  }
}

async function saveDomainSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: SiteSettings['domainSettings'],
  actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const actorIdParsed = Number(actorUserId)
  const actorId = Number.isInteger(actorIdParsed) ? actorIdParsed : null

  try {
    const response = await fetch(new URL('/settings/upsert', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        code: 'domain',
        title: 'Domain Settings',
        meta,
        updated_by: actorId,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configuração de domínio'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord
    const savedMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}
    return { success: true, data: savedMeta as Record<string, unknown> }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao salvar configuração de domínio'),
    }
  }
}

async function saveErpSettingsMetaToBackend(
  base: string,
  cookieHeader: string,
  meta: ErpSettings,
  actorUserId?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const actorIdParsed = Number(actorUserId)
  const actorId = Number.isInteger(actorIdParsed) ? actorIdParsed : null

  try {
    const response = await fetch(new URL('/settings/upsert', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        code: 'erp',
        title: 'ERP',
        meta,
        updated_by: actorId,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configuração de ERP'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as BackendSettingRecord
    const savedMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}
    return { success: true, data: savedMeta as Record<string, unknown> }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao salvar configuração de ERP'),
    }
  }
}

function mapFixedShippingOptionToLocal(option: FixedShippingOptionBackend): ShippingOption {
  return {
    id: String(option.id),
    name: String(option.name ?? ''),
    estimatedDays: Number(option.estimated_days ?? 0),
    price: Number(option.price_cents ?? 0) / 100,
  }
}

function mapBackendPaymentMethodToLocal(item: PaymentMethodBackend): PaymentMethodConfig {
  return {
    id: String(item.id),
    name: String(item.name ?? ''),
    type: String(item.type ?? ''),
    storeId: Number(item.store_id ?? 0),
    meta: item.meta && typeof item.meta === 'object' ? item.meta : {},
  }
}

function mapBackendStoreToProfile(item: Record<string, unknown>): StoreProfileConfig {
  const metaRaw = (item.meta && typeof item.meta === 'object' ? item.meta : {}) as Record<string, unknown>
  const socialLinks = normalizeStoreSocialLinks(metaRaw)
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    cnpj: String(item.cnpj ?? ''),
    description: String(item.description ?? ''),
    email: String(item.email ?? ''),
    phone: String(item.phone ?? ''),
    whatsapp: String(item.whatsapp ?? ''),
    // Nunca devolver hash da senha master para o front.
    b2bMasterPassword: '',
    address: {
      zip_code: String(item.address_zip ?? ''),
      street_name: String(item.address_street ?? ''),
      house_number: String(item.address_number ?? ''),
      address_complement: String(item.address_complement ?? ''),
      neighborhood: String(item.address_neighborhood ?? ''),
      city: String(item.address_city ?? ''),
      state: String(item.address_state ?? ''),
    },
    meta: {
      title: String(metaRaw.title ?? ''),
      description: String(metaRaw.description ?? ''),
      headCode: String(metaRaw.headCode ?? metaRaw.head_code ?? ''),
      maintenanceMode: Boolean(metaRaw.maintenanceMode ?? metaRaw.maintenance_mode ?? false),
      socialLinks: {
        ...DEFAULT_STORE_SOCIAL_LINKS,
        ...socialLinks,
      },
    },
  }
}

function extractStorefrontApiKeyFromStorePayload(item: Record<string, unknown>): string {
  const candidates = [
    item.storefront_api_key,
    item.storefrontApiKey,
    item.api_key,
    item.apiKey,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  const meta = item.meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return extractStorefrontApiKeyFromStorePayload(meta as Record<string, unknown>)
  }

  return ''
}

export async function getStoreProfileAction(): Promise<ApiResponse<StoreProfileConfig>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const response = await fetch(new URL(`/stores/${storeId}`, base), {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao buscar dados da loja')
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as Record<string, unknown>
    return { success: true, data: mapBackendStoreToProfile(payload) }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao buscar dados da loja') }
  }
}

export async function getStorefrontStoreProfileAction(
  storeId?: number | string | null,
): Promise<ApiResponse<StoreProfileConfig>> {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const resolvedStoreId = await getStoreIdFromBackend(base, undefined, storeId)
  if (!resolvedStoreId) {
    return { success: false, error: 'STORE_ID não configurado' }
  }

  try {
    const response = await fetch(new URL(`/stores/${resolvedStoreId}`, base), {
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao buscar dados da loja')
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as Record<string, unknown>
    return { success: true, data: mapBackendStoreToProfile(payload) }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao buscar dados da loja') }
  }
}

export async function updateStoreProfileAction(formData: FormData): Promise<ApiResponse<StoreProfileConfig>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const name = String(formData.get('storeName') || '').trim()
  const cnpj = String(formData.get('storeCnpj') || '').trim()
  const description = String(formData.get('storeDescription') || '').trim()
  const email = String(formData.get('storeEmail') || '').trim()
  const phone = String(formData.get('storePhone') || '').trim()
  const whatsapp = String(formData.get('storeWhatsapp') || '').trim()
  const b2bMasterPassword = String(formData.get('storeB2bMasterPassword') || '').trim()
  const addressRaw = formData.get('storeAddress')
  const addressObj = addressRaw ? JSON.parse(String(addressRaw)) : {}
  const metaRaw = formData.get('storeMeta')
  const meta = metaRaw ? JSON.parse(String(metaRaw)) : {}

  if (!name) {
    return { success: false, error: 'Nome da loja é obrigatório' }
  }

  try {
    const response = await fetch(new URL(`/stores/${storeId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        name,
        cnpj: cnpj || null,
        description: description || null,
        email: email || null,
        phone,
        whatsapp: whatsapp || null,
        ...(b2bMasterPassword ? { b2b_master_password: b2bMasterPassword } : {}),
        address_zip: addressObj.zip_code || null,
        address_street: addressObj.street_name || null,
        address_number: addressObj.house_number || null,
        address_complement: addressObj.address_complement || null,
        address_neighborhood: addressObj.neighborhood || null,
        address_city: addressObj.city || null,
        address_state: addressObj.state || null,
        meta,
      }),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao atualizar dados da loja')
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as Record<string, unknown>

    revalidatePath('/settings')

    return { success: true, data: mapBackendStoreToProfile(payload) }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao atualizar dados da loja') }
  }
}

async function getFixedShippingOptionsFromBackend(
  base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
): Promise<ApiResponse<ShippingOption[]>> {
  const storeId = await getStoreIdFromBackend(base, cookieHeader, preferredStoreId)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/shipping/fixed-table', base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const fallback = 'Erro ao buscar transportadoras'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as FixedShippingTableBackend
    const options = Array.isArray(payload?.options)
      ? payload.options
          .filter((option) => option?.active !== false)
          .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
          .map(mapFixedShippingOptionToLocal)
      : []

    return { success: true, data: options }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao buscar transportadoras'),
    }
  }
}

// Site Settings
type SiteSettingsMetaInclude = {
  shippingFixed: boolean
  b2b: boolean
  stock: boolean
  shipping: boolean
  theme: boolean
  product: boolean
  payment: boolean
  marketing: boolean
  domain: boolean
  erp: boolean
}

type GetSiteSettingsActionOptions = {
  include?: Partial<SiteSettingsMetaInclude>
}

const DEFAULT_SITE_SETTINGS_META_INCLUDE: SiteSettingsMetaInclude = {
  shippingFixed: true,
  b2b: true,
  stock: true,
  shipping: true,
  theme: true,
  product: true,
  payment: true,
  marketing: true,
  domain: true,
  erp: false,
}

const EMPTY_SITE_SETTINGS_META_INCLUDE: SiteSettingsMetaInclude = {
  shippingFixed: false,
  b2b: false,
  stock: false,
  shipping: false,
  theme: false,
  product: false,
  payment: false,
  marketing: false,
  domain: false,
  erp: false,
}

export async function getSiteSettingsAction(
  storeId?: number | string | null,
  options?: GetSiteSettingsActionOptions,
): Promise<ApiResponse<SiteSettings>> {
  try {
    const settings = await getSiteSettings()
    settings.domainSettings = normalizeDomainSettingsMeta(settings.domainSettings)
    settings.erpSettings = normalizeErpSettingsMeta(settings.erpSettings)
    const include: SiteSettingsMetaInclude = options?.include
      ? {
          ...EMPTY_SITE_SETTINGS_META_INCLUDE,
          ...options.include,
        }
      : DEFAULT_SITE_SETTINGS_META_INCLUDE

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: true, data: settings }
    }

    const cookieHeader = await buildAdminCookieHeader()

    const [
      shippingResult,
      b2bResult,
      stockResult,
      shippingResult2,
      themeResult,
      productResult,
      paymentResult,
      marketingResult,
      domainResult,
      erpResult,
    ] = await Promise.all([
      include.shippingFixed
        ? getFixedShippingOptionsFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as ShippingOption[] | null }),
      include.b2b
        ? getB2BSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.stock
        ? getStockSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.shipping
        ? getShippingSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.theme
        ? getThemeSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.product
        ? getProductSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.payment
        ? getPaymentSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.marketing
        ? getMarketingSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.domain
        ? getDomainSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
      include.erp
        ? getErpSettingsMetaFromBackend(base, cookieHeader, storeId)
        : Promise.resolve({ success: true, data: null as Record<string, unknown> | null }),
    ])

    if (include.shippingFixed && shippingResult.success && shippingResult.data) {
      settings.shippingOptions = shippingResult.data
    }

    if (include.b2b && b2bResult.success && b2bResult.data) {
      const b2bMeta = normalizeB2BMeta(b2bResult.data, settings)
      settings.requireCnpj = b2bMeta.requireCnpj
      settings.defaultMinPieces = b2bMeta.defaultMinPieces
      settings.minOrderValue = b2bMeta.minOrderValue
      settings.maxInstallmentsText = b2bMeta.maxInstallmentsText
      settings.stockMode = b2bMeta.stockMode
      settings.variantMaxQty = b2bMeta.variantMaxQty
      settings.pendingCustomerMessage = b2bMeta.pendingCustomerMessage
      settings.priceVisibilityMode = b2bMeta.priceVisibilityMode
      settings.userLinksPriceVisibilityMode = b2bMeta.userLinksPriceVisibilityMode
      settings.sellerCanApproveCustomers = b2bMeta.sellerCanApproveCustomers
      settings.sellerCanEditPriceTable = b2bMeta.sellerCanEditPriceTable
      settings.sellerCanCreateOrders = b2bMeta.sellerCanCreateOrders
      settings.b2bPaymentTerms = b2bMeta.paymentTerms
      settings.sign_wholesale = b2bMeta.sign_wholesale
    }

    // Stock section overrides b2b values for stockMode/variantMaxQty when present.
    if (include.stock && stockResult.success && stockResult.data && Object.keys(stockResult.data).length > 0) {
      const sm = stockResult.data
      if (sm.stockMode === 'BINARY' || sm.stockMode === 'REAL' || sm.stockMode === 'FANTASY' || sm.stockMode === 'INFINITO' || sm.stockMode === 'WMS') {
        settings.stockMode = sm.stockMode as SiteSettings['stockMode']
      }
      if (typeof sm.variantMaxQty === 'number' && Number.isFinite(sm.variantMaxQty)) {
        settings.variantMaxQty = sm.variantMaxQty
      }
    }

    if (include.shipping) {
      if (shippingResult2.success && shippingResult2.data && Object.keys(shippingResult2.data).length > 0) {
        settings.shippingSettings = normalizeShippingSettingsMeta(shippingResult2.data, settings)
      } else {
        settings.shippingSettings = getDefaultShippingSettings(settings)
      }
    }

    if (include.theme && themeResult.success && themeResult.data) {
      settings.customization = normalizeThemeMeta(themeResult.data, settings.customization)
    }

    if (include.product) {
      settings.productCustomFields = normalizeProductCustomFieldsMeta(
        productResult.success && productResult.data ? productResult.data : settings.productCustomFields,
        settings.productCustomFields,
      )
    }

    if (include.payment && paymentResult.success && paymentResult.data) {
      settings.paymentSettings = normalizePaymentSettingsMeta(
        paymentResult.data as Record<string, unknown>,
        settings.paymentSettings,
      )
    }

    if (include.marketing && marketingResult.success && marketingResult.data && Object.keys(marketingResult.data).length > 0) {
      settings.marketingSettings = marketingResult.data as unknown as MarketingSettings
    }

    if (include.domain) {
      settings.domainSettings = domainResult.success && domainResult.data
        ? normalizeDomainSettingsMeta(domainResult.data)
        : normalizeDomainSettingsMeta(settings.domainSettings)
    }

    if (include.erp) {
      settings.erpSettings = erpResult.success && erpResult.data
        ? normalizeErpSettingsMeta(erpResult.data)
        : normalizeErpSettingsMeta(settings.erpSettings)
    }

    const normalizedSettings = normalizeTransportValue(settings) as SiteSettings
    return { success: true, data: normalizedSettings }
  } catch (error) {
    console.error('Error in getSiteSettingsAction:', error)
    return { success: false, error: 'Erro ao carregar configurações' }
  }
}

export async function getStorefrontDisplayModeAction(
  storeId?: number | string | null,
): Promise<ApiResponse<'products' | 'imageLevels'>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: true, data: 'products' }
    }

    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
    const url = new URL('/settings', base)
    if (storeId !== undefined && storeId !== null && String(storeId).trim() !== '') {
      url.searchParams.set('store_id', String(storeId))
    }
    url.searchParams.set('code', 'theme')
    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId })

    const response = await fetch(url, {
      headers: withStorefrontScopeHeaders({}, storefrontApiKey),
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: true, data: 'products' }
    }

    const payload = (await response.json()) as Record<string, unknown>
    const metaRaw = payload?.meta
    const meta = metaRaw && typeof metaRaw === 'object' ? (metaRaw as Record<string, unknown>) : null
    const raw = String(meta?.storefrontDisplayMode || '').trim()
    const mode: 'products' | 'imageLevels' = raw === 'imageLevels' ? 'imageLevels' : 'products'

    return { success: true, data: mode }
  } catch {
    return { success: true, data: 'products' }
  }
}

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  mode: 'MANUAL',
  integratedFlow: 'AUTO_CHARGE',
  provider: 'NONE',
  gatewayEnvironment: 'PRODUCTION',
  manualInstructions: '',
  apiKey: null,
  secretKey: null,
  webhookSecret: null,
  webhookToken: null,
  providerWebhookUrl: null,
  providerCronUrl: null,
  getnetWebhookEvent: null,
  getnetWebhookSubscriptionId: null,
  getnetWebhookAuthenticationType: null,
  enablePix: true,
  enableBoleto: true,
  enableCreditCard: true,
  maxInstallments: 12,
  enableFaturado: true,
  faturadoMinOrderValue: null,
  faturadoMaxDays: 30,
}

const STRICT_PAYMENT_METHODS_FALLBACK: PaymentSettings = {
  ...DEFAULT_PAYMENT_SETTINGS,
  enablePix: false,
  enableBoleto: false,
  enableCreditCard: false,
  enableFaturado: false,
}

export async function getSellerPermissionsAction(): Promise<{ canCreateOrders: boolean }> {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) return { canCreateOrders: true }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const result = await getB2BSettingsMetaFromBackend(base, cookieHeader)
    if (result.success && result.data) {
      const canCreateOrders = typeof result.data.sellerCanCreateOrders === 'boolean'
        ? result.data.sellerCanCreateOrders
        : true
      return { canCreateOrders }
    }
  } catch {
    // ignore
  }
  return { canCreateOrders: true }
}

export async function getCorePaymentMethodsAction(): Promise<ApiResponse<PaymentMethodOption[]>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return {
        success: true,
        data: [],
      }
    }

    const cookieHeader = await buildAdminCookieHeader()
    const paymentResult = await getPaymentSettingsMetaFromBackend(base, cookieHeader)

    if (!paymentResult.success || !paymentResult.data) {
      return {
        success: true,
        data: [],
        error: paymentResult.error || 'Erro ao buscar métodos de pagamento em Configurações',
      }
    }

    const paymentSettings = normalizePaymentSettingsMeta(paymentResult.data, STRICT_PAYMENT_METHODS_FALLBACK)
    const enabledMethods = buildPaymentMethodOptionsFromSettings(paymentSettings)
    const hasActiveCustomMethods = (paymentSettings.customMethods || []).some(
      (method) =>
        method?.isActive !== false
        && (String(method.title || '').trim().length > 0 || String(method.id || '').trim().length > 0),
    )

    if (enabledMethods.length === 0 && !hasActiveCustomMethods) {
      return {
        success: true,
        data: [],
      }
    }

    const storeId = await getStoreIdFromBackend(base, cookieHeader)
    if (!storeId) {
      return {
        success: true,
        data: [],
        error: 'Erro ao obter loja atual para validar métodos de pagamento',
      }
    }

    const methodsUrl = new URL('/payment-methods', base)
    methodsUrl.searchParams.set('store_id', String(storeId))

    const methodsResponse = await fetch(methodsUrl, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!methodsResponse.ok) {
      const methodsError = await getBackendErrorMessage(methodsResponse, 'Erro ao buscar métodos de pagamento cadastrados')
      return {
        success: true,
        data: [],
        error: methodsError,
      }
    }

    const normalizePaymentKey = (value: string): string =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase()

    const methodsPayload = await methodsResponse.json()
    const registeredMethods = (Array.isArray(methodsPayload) ? methodsPayload : [])
      .map((rawMethod) => {
        const method = rawMethod as Record<string, unknown>
        const id = Number(method.id)
        const type = String(method.type || '').trim().toUpperCase()
        const name = String(method.name || '').trim()

        return {
          id,
          type,
          name,
          normalizedName: name.toLowerCase(),
          normalizedTypeKey: normalizePaymentKey(type),
          normalizedNameKey: normalizePaymentKey(name),
        }
      })
      .filter((method) => Number.isFinite(method.id) && method.id > 0 && (method.type.length > 0 || method.name.length > 0))

    const activeCustomMethods = (paymentSettings.customMethods || [])
      .filter((method) => method?.isActive !== false)
      .map((method) => {
        const configuredId = String(method.id || '').trim()
        const configuredTitle = String(method.title || '').trim()
        if (!configuredId && !configuredTitle) return null

        const typeBase = normalizePaymentKey(configuredId || configuredTitle)
        if (!typeBase) return null

        const normalizedType = `MANUAL_${typeBase}`.toUpperCase()
        return {
          configuredId,
          configuredTitle,
          normalizedType,
          normalizedTypeKey: normalizePaymentKey(normalizedType),
          normalizedTitleKey: normalizePaymentKey(configuredTitle),
          normalizedTitle: configuredTitle.toLowerCase(),
        }
      })
      .filter((method): method is {
        configuredId: string
        configuredTitle: string
        normalizedType: string
        normalizedTypeKey: string
        normalizedTitleKey: string
        normalizedTitle: string
      } => Boolean(method))

    const missingCustomForRegistry = activeCustomMethods.filter((customMethod) => {
      const matched = registeredMethods.some((registeredMethod) => {
        if (registeredMethod.type === customMethod.normalizedType) return true
        if (registeredMethod.normalizedTypeKey === customMethod.normalizedTypeKey) return true
        if (customMethod.normalizedTitle && registeredMethod.normalizedName === customMethod.normalizedTitle) return true
        if (customMethod.normalizedTitleKey && registeredMethod.normalizedNameKey === customMethod.normalizedTitleKey) return true
        return false
      })
      return !matched
    })

    if (missingCustomForRegistry.length > 0) {
      for (const customMethod of missingCustomForRegistry) {
        const methodName = customMethod.configuredTitle || customMethod.configuredId || customMethod.normalizedType
        await fetch(new URL('/payment-methods', base), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            name: methodName,
            type: customMethod.normalizedType,
            store_id: storeId,
            meta: {
              source: 'custom_manual_payment',
              custom_method_id: customMethod.configuredId,
            },
          }),
        }).catch(() => null)
      }

      const refreshedMethodsResponse = await fetch(methodsUrl, {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (refreshedMethodsResponse.ok) {
        const refreshedPayload = await refreshedMethodsResponse.json()
        const refreshedMethods = (Array.isArray(refreshedPayload) ? refreshedPayload : [])
          .map((rawMethod) => {
            const method = rawMethod as Record<string, unknown>
            const id = Number(method.id)
            const type = String(method.type || '').trim().toUpperCase()
            const name = String(method.name || '').trim()

            return {
              id,
              type,
              name,
              normalizedName: name.toLowerCase(),
              normalizedTypeKey: normalizePaymentKey(type),
              normalizedNameKey: normalizePaymentKey(name),
            }
          })
          .filter((method) => Number.isFinite(method.id) && method.id > 0 && (method.type.length > 0 || method.name.length > 0))

        registeredMethods.splice(0, registeredMethods.length, ...refreshedMethods)
      }
    }

    const registeredTypes = new Set(
      registeredMethods
        .map((method) => method.type)
        .filter((value) => value.length > 0),
    )

    const filteredCoreMethods = enabledMethods
      .filter((method) => registeredTypes.has(String(method.value).toUpperCase()))
      .map((method) => {
        const matchedMethod = registeredMethods.find((registeredMethod) => registeredMethod.type === String(method.value).toUpperCase())

        if (!matchedMethod) return method

        return {
          ...method,
          id: matchedMethod.id,
        }
      })

    const filteredCustomMethods = activeCustomMethods
      .map((customMethod) => {
        const matchedMethod = registeredMethods.find((registeredMethod) => {
          if (registeredMethod.type === customMethod.normalizedType) return true
          if (registeredMethod.normalizedTypeKey === customMethod.normalizedTypeKey) return true
          if (customMethod.normalizedTitle && registeredMethod.normalizedName === customMethod.normalizedTitle) return true
          if (customMethod.normalizedTitleKey && registeredMethod.normalizedNameKey === customMethod.normalizedTitleKey) return true
          return false
        })

        if (!matchedMethod) return null

        const value = matchedMethod.type || matchedMethod.name
        if (!value) return null

        return {
          id: matchedMethod.id,
          value,
          label: customMethod.configuredTitle || matchedMethod.name || value,
        }
      })
      .filter((method): method is PaymentMethodOption => Boolean(method))

    const seen = new Set<string>()
    const filteredMethods = [...filteredCoreMethods, ...filteredCustomMethods].filter((method) => {
      const key = String(method.value).trim().toUpperCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      success: true,
      data: filteredMethods,
    }
  } catch (error) {
    return {
      success: true,
      data: [],
      error: getThrownErrorMessage(error, 'Erro ao buscar métodos de pagamento'),
    }
  }
}

function buildPaymentMethodOptionsFromSettings(paymentSettings: PaymentSettings): PaymentMethodOption[] {
  const methods: PaymentMethodOption[] = []

  if (paymentSettings.enablePix) {
    methods.push({ value: 'PIX', label: 'PIX' })
  }

  if (paymentSettings.enableBoleto) {
    methods.push({ value: 'BOLETO', label: 'Boleto' })
  }

  if (paymentSettings.enableFaturado) {
    methods.push({ value: 'FATURADO', label: 'Faturado' })
  }

  if (paymentSettings.mode === 'INTEGRATED' && paymentSettings.enableCreditCard) {
    methods.push({ value: 'CARTAO_EXTERNO', label: 'Cartão' })
  }

  return methods
}

export async function updateSiteSettingsAction(formData: FormData): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  const actorUserId = session?.id || 'store-session'

  const currentSettings = await getSiteSettings()
  const data: Record<string, unknown> = {}

  // Parse form data
  if (formData.has('requireCnpj')) data.requireCnpj = formData.get('requireCnpj') === 'true'
  if (formData.has('defaultMinPieces')) data.defaultMinPieces = parseInt(formData.get('defaultMinPieces') as string)
  if (formData.has('minOrderValue')) {
    const val = formData.get('minOrderValue') as string
    data.minOrderValue = val === '' ? null : parseFloat(val)
  }
  if (formData.has('maxInstallmentsText')) data.maxInstallmentsText = formData.get('maxInstallmentsText') as string
  if (formData.has('stockMode')) data.stockMode = formData.get('stockMode') as string
  if (formData.has('variantMaxQty')) data.variantMaxQty = parseInt(formData.get('variantMaxQty') as string)
  if (formData.has('pendingCustomerMessage')) data.pendingCustomerMessage = formData.get('pendingCustomerMessage') as string
  if (formData.has('priceVisibilityMode')) data.priceVisibilityMode = formData.get('priceVisibilityMode') as string
  if (formData.has('userLinksPriceVisibilityMode')) data.userLinksPriceVisibilityMode = formData.get('userLinksPriceVisibilityMode') as string
  if (formData.has('sellerCanApproveCustomers')) data.sellerCanApproveCustomers = formData.get('sellerCanApproveCustomers') === 'true'
  if (formData.has('sellerCanEditPriceTable')) data.sellerCanEditPriceTable = formData.get('sellerCanEditPriceTable') === 'true'
  if (formData.has('sellerCanCreateOrders')) data.sellerCanCreateOrders = formData.get('sellerCanCreateOrders') === 'true'
  if (formData.has('sign_wholesale')) data.sign_wholesale = JSON.parse(formData.get('sign_wholesale') as string)
  if (formData.has('paymentTerms')) {
    data.paymentTerms = JSON.parse(formData.get('paymentTerms') as string)
  }
  const hasStockFields = ['stockMode', 'variantMaxQty'].some((field) => formData.has(field))

  const hasB2BFields = [
    'requireCnpj',
    'defaultMinPieces',
    'minOrderValue',
    'maxInstallmentsText',
    'pendingCustomerMessage',
    'priceVisibilityMode',
    'userLinksPriceVisibilityMode',
    'sellerCanApproveCustomers',
    'sellerCanEditPriceTable',
    'sellerCanCreateOrders',
    'sign_wholesale',
    'paymentTerms',
  ].some((field) => formData.has(field))

  if (hasB2BFields) {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    const cookieHeader = await buildAdminCookieHeader()

    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }
    if (!cookieHeader) {
      return { success: false, error: 'Não autenticado' }
    }

    const b2bPayload: B2BSettingsMeta = {
      requireCnpj: typeof data.requireCnpj === 'boolean' ? data.requireCnpj : currentSettings.requireCnpj,
      defaultMinPieces: typeof data.defaultMinPieces === 'number' ? data.defaultMinPieces : currentSettings.defaultMinPieces,
      minOrderValue: data.minOrderValue === null
        ? null
        : typeof data.minOrderValue === 'number'
          ? data.minOrderValue
          : currentSettings.minOrderValue,
      maxInstallmentsText: typeof data.maxInstallmentsText === 'string' ? data.maxInstallmentsText : currentSettings.maxInstallmentsText,
      stockMode: currentSettings.stockMode || 'FANTASY',
      variantMaxQty: currentSettings.variantMaxQty || 999,
      pendingCustomerMessage: typeof data.pendingCustomerMessage === 'string' ? data.pendingCustomerMessage : currentSettings.pendingCustomerMessage,
      priceVisibilityMode: data.priceVisibilityMode === 'PUBLIC' ? 'PUBLIC' : (data.priceVisibilityMode === 'LOGIN_REQUIRED' ? 'LOGIN_REQUIRED' : currentSettings.priceVisibilityMode),
      userLinksPriceVisibilityMode: data.userLinksPriceVisibilityMode === 'PUBLIC'
        ? 'PUBLIC'
        : (data.userLinksPriceVisibilityMode === 'LOGIN_REQUIRED'
          ? 'LOGIN_REQUIRED'
          : (currentSettings.userLinksPriceVisibilityMode || currentSettings.priceVisibilityMode)),
      sellerCanApproveCustomers: typeof data.sellerCanApproveCustomers === 'boolean' ? data.sellerCanApproveCustomers : currentSettings.sellerCanApproveCustomers,
      sellerCanEditPriceTable: typeof data.sellerCanEditPriceTable === 'boolean' ? data.sellerCanEditPriceTable : currentSettings.sellerCanEditPriceTable,
      sellerCanCreateOrders: typeof data.sellerCanCreateOrders === 'boolean' ? data.sellerCanCreateOrders : currentSettings.sellerCanCreateOrders,
      paymentTerms: Array.isArray(data.paymentTerms)
        ? data.paymentTerms.filter(
            (term): term is PaymentMethod =>
              term === 'PIX' || term === 'BOLETO' || term === 'FATURADO' || term === 'CARTAO_EXTERNO',
          )
        : (currentSettings.b2bPaymentTerms ?? []),
      sign_wholesale: normalizeSignWholesaleSettings(data.sign_wholesale, currentSettings.sign_wholesale),
    }

    const saveB2BResult = await saveB2BSettingsMetaToBackend(base, cookieHeader, b2bPayload, actorUserId)
    if (!saveB2BResult.success) {
      return { success: false, error: saveB2BResult.error || 'Erro ao salvar configuração b2b' }
    }
  }

  if (hasStockFields) {
    const permissionResult = await checkUserPermission('inventory.edit')
    if (permissionResult?.has_permission !== true) {
      return { success: false, error: 'Você não tem permissão para editar estoque' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    const cookieHeader = await buildAdminCookieHeader()

    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    if (!cookieHeader) return { success: false, error: 'Não autenticado' }

    const stockPayload = {
      stockMode: data.stockMode === 'BINARY' || data.stockMode === 'REAL' || data.stockMode === 'FANTASY' || data.stockMode === 'INFINITO' || data.stockMode === 'WMS'
        ? (data.stockMode as string)
        : (currentSettings.stockMode || 'FANTASY'),
      variantMaxQty: typeof data.variantMaxQty === 'number' && Number.isFinite(data.variantMaxQty)
        ? Math.max(1, data.variantMaxQty)
        : (currentSettings.variantMaxQty || 999),
    }

    const saveStockResult = await saveStockSettingsMetaToBackend(base, cookieHeader, stockPayload, actorUserId)
    if (!saveStockResult.success) {
      return { success: false, error: saveStockResult.error || 'Erro ao salvar configuração de estoque' }
    }
  }

  const shippingSettingsRaw = getFormString(formData, 'shippingSettings')
  if (shippingSettingsRaw) {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    const cookieHeader = await buildAdminCookieHeader()

    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }
    if (!cookieHeader) {
      return { success: false, error: 'Não autenticado' }
    }

    let parsedShippingSettings: unknown
    try {
      parsedShippingSettings = JSON.parse(shippingSettingsRaw)
    } catch {
      return { success: false, error: 'Payload de frete inválido' }
    }

    const shippingPayload = normalizeShippingSettingsMeta(
      parsedShippingSettings,
      currentSettings,
    )
    const saveShippingResult = await saveShippingSettingsMetaToBackend(base, cookieHeader, shippingPayload, actorUserId)
    if (!saveShippingResult.success) {
      return { success: false, error: saveShippingResult.error || 'Erro ao salvar configuração de frete' }
    }
  }

  const homeConfigRaw = getFormString(formData, 'homeConfig')
  if (homeConfigRaw) {
    try {
      data.homeConfig = JSON.parse(homeConfigRaw)
    } catch {
      return { success: false, error: 'Payload de homeConfig inválido' }
    }
  }

  const customizationRaw = getFormString(formData, 'customization')
  if (customizationRaw) {
    try {
      data.customization = JSON.parse(customizationRaw)
    } catch {
      return { success: false, error: 'Payload de customization inválido' }
    }
  }

  const paymentSettingsRaw = getFormString(formData, 'paymentSettings')
  if (paymentSettingsRaw) {
    try {
      data.paymentSettings = JSON.parse(paymentSettingsRaw)
    } catch {
      return { success: false, error: 'Payload de paymentSettings inválido' }
    }
  }

  const updated = await updateSiteSettings(data as Partial<SiteSettings>)

  await createAuditLog({
    actorUserId,
    action: 'SETTINGS_UPDATED',
    entityType: 'SiteSettings',
    entityId: 'settings_main',
    beforeJson: currentSettings as unknown as Record<string, unknown>,
    afterJson: updated as unknown as Record<string, unknown>,
  })

  revalidatePath('/settings')
  revalidatePath('/')

  return { success: true, data: updated }
}

export async function updateStockSettingsAction(formData: FormData): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  const permissionResult = await checkUserPermission('inventory.edit')
  if (permissionResult?.has_permission !== true) {
    return { success: false, error: 'Você não tem permissão para editar estoque' }
  }
  const actorUserId = session?.id || 'store-session'

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieHeader = await buildAdminCookieHeader()
  if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  if (!cookieHeader) return { success: false, error: 'Não autenticado' }

  const currentSettings = await getSiteSettings()

  const rawStockMode = formData.get('stockMode') as string
  const stockPayload = {
    stockMode: rawStockMode === 'BINARY' || rawStockMode === 'REAL' || rawStockMode === 'FANTASY' || rawStockMode === 'INFINITO' || rawStockMode === 'WMS'
      ? rawStockMode
      : (currentSettings.stockMode || 'FANTASY'),
    variantMaxQty: formData.has('variantMaxQty')
      ? Math.max(1, parseInt(formData.get('variantMaxQty') as string) || 999)
      : (currentSettings.variantMaxQty || 999),
  }

  const result = await saveStockSettingsMetaToBackend(base, cookieHeader, stockPayload, actorUserId)
  if (!result.success) {
    return { success: false, error: result.error || 'Erro ao salvar configuração de estoque' }
  }

  revalidatePath('/settings/stock')
  const updated = await getSiteSettings()
  return { success: true, data: updated }
}

export async function updateCustomizationAction(formData: FormData): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  const actorUserId = session?.id || 'store-session'

  const currentSettings = await getSiteSettings()

  const rawCategoryBannerMode = getFormString(formData, 'categoryBannerMode')
  const categoryBannerMode: SiteCustomization['categoryBannerMode'] =
    rawCategoryBannerMode === 'auto' || rawCategoryBannerMode === 'disabled' || rawCategoryBannerMode === 'custom'
      ? rawCategoryBannerMode
      : currentSettings.customization.categoryBannerMode
  const rawFontFamily = getFormString(formData, 'fontFamily')
  const fontFamily: SiteCustomization['fontFamily'] =
    rawFontFamily === 'SYSTEM'
    || rawFontFamily === 'INTER'
    || rawFontFamily === 'POPPINS'
    || rawFontFamily === 'MONTSERRAT'
    || rawFontFamily === 'ZEN_KAKU_GOTHIC_NEW'
      ? rawFontFamily
      : (currentSettings.customization.fontFamily || 'SYSTEM')

  const rawStorefrontNavigationMode = getFormString(formData, 'storefrontNavigationMode')
  const storefrontNavigationMode: SiteCustomization['storefrontNavigationMode'] =
    rawStorefrontNavigationMode === 'pagination' || rawStorefrontNavigationMode === 'infiniteScroll'
      ? rawStorefrontNavigationMode
      : (currentSettings.customization.storefrontNavigationMode || 'pagination')

  const rawStorefrontDisplayMode = getFormString(formData, 'storefrontDisplayMode')
  const storefrontDisplayMode: SiteCustomization['storefrontDisplayMode'] =
    rawStorefrontDisplayMode === 'products' || rawStorefrontDisplayMode === 'imageLevels'
      ? rawStorefrontDisplayMode
      : (currentSettings.customization.storefrontDisplayMode || 'products')

  const accentColor = getFormString(formData, 'accentColor')
  const backgroundColor = getFormString(formData, 'backgroundColor')
  const textColor = getFormString(formData, 'textColor')
  const buttonColor = getFormString(formData, 'buttonColor')
  const buttonTextColor = getFormString(formData, 'buttonTextColor')
  const logoUrl = getFormString(formData, 'logoUrl')
  const logoLightUrl = getFormString(formData, 'logoLightUrl')
  const logoDarkUrl = getFormString(formData, 'logoDarkUrl')
  const faviconUrl = getFormString(formData, 'faviconUrl')

  const announcementBarRaw = getFormString(formData, 'announcementBar')
  const popupCouponRaw = getFormString(formData, 'popupCoupon')
  const mainBannersRaw = getFormString(formData, 'mainBanners')
  const miniBannersRaw = getFormString(formData, 'miniBanners')
  const mainBannerRaw = getFormString(formData, 'mainBanner')
  const categoryBannersRaw = getFormString(formData, 'categoryBanners')
  const infoBannersRaw = getFormString(formData, 'infoBanners')
  const homeCategoriesRaw = getFormString(formData, 'homeCategories')

  const rawStorefrontDefaultSort = getFormString(formData, 'storefrontDefaultSort')
  const storefrontDefaultSort: SiteCustomization['storefrontDefaultSort'] =
    rawStorefrontDefaultSort === 'relevance'
    || rawStorefrontDefaultSort === 'price_asc'
    || rawStorefrontDefaultSort === 'price_desc'
    || rawStorefrontDefaultSort === 'newest'
    || rawStorefrontDefaultSort === 'sku'
      ? (rawStorefrontDefaultSort as SiteCustomization['storefrontDefaultSort'])
      : (currentSettings.customization.storefrontDefaultSort || 'relevance')

  const parseOptionalPositiveNumber = (field: string, fallbackValue: number | null | undefined): number | null => {
    if (!hasFormField(formData, field)) return fallbackValue ?? null
    const raw = getFormString(formData, field)
    if (!raw || !raw.trim()) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
  }
  const mediaAspectWidth = parseOptionalPositiveNumber('mediaAspectWidth', currentSettings.customization.mediaAspectWidth)
  const mediaAspectHeight = parseOptionalPositiveNumber('mediaAspectHeight', currentSettings.customization.mediaAspectHeight)
  const showPixDiscount = hasFormField(formData, 'showPixDiscount')
    ? getFormString(formData, 'showPixDiscount') === 'true'
    : (currentSettings.customization.showPixDiscount ?? true)
  const showInstallments = hasFormField(formData, 'showInstallments')
    ? getFormString(formData, 'showInstallments') === 'true'
    : (currentSettings.customization.showInstallments ?? true)
  const loginSideImageUrl = getFormString(formData, 'loginSideImageUrl')

  const customization: SiteCustomization = {
    primaryColor: currentSettings.customization.primaryColor,
    secondaryColor: currentSettings.customization.secondaryColor,
    accentColor: accentColor || currentSettings.customization.accentColor,
    backgroundColor: backgroundColor || currentSettings.customization.backgroundColor,
    textColor: textColor || currentSettings.customization.textColor,
    buttonColor: buttonColor || currentSettings.customization.buttonColor,
    buttonTextColor: buttonTextColor || currentSettings.customization.buttonTextColor,
    fontFamily,
    forceUppercaseText: hasFormField(formData, 'forceUppercaseText')
      ? getFormString(formData, 'forceUppercaseText') === 'true'
      : currentSettings.customization.forceUppercaseText,
    menuTransparent: hasFormField(formData, 'menuTransparent')
      ? getFormString(formData, 'menuTransparent') === 'true'
      : currentSettings.customization.menuTransparent,
    announcementBar: announcementBarRaw ? JSON.parse(announcementBarRaw) : currentSettings.customization.announcementBar,
    popupCoupon: popupCouponRaw
      ? JSON.parse(popupCouponRaw)
      : (currentSettings.customization.popupCoupon || { enabled: false, imageUrl: null, couponCode: '', applyButtonText: 'Aplicar cupom' }),
    mainBanners: mainBannersRaw
      ? JSON.parse(mainBannersRaw)
      : (currentSettings.customization.mainBanners?.length
          ? currentSettings.customization.mainBanners
          : (currentSettings.customization.mainBanner ? [currentSettings.customization.mainBanner] : [])),
    miniBanners: miniBannersRaw
      ? JSON.parse(miniBannersRaw)
      : (Array.isArray(currentSettings.customization.miniBanners)
          ? currentSettings.customization.miniBanners
          : []),
    mainBanner: mainBannerRaw
      ? JSON.parse(mainBannerRaw)
      : (currentSettings.customization.mainBanners?.[0] || currentSettings.customization.mainBanner),
    categoryBannerMode,
    categoryBanners: categoryBannersRaw ? JSON.parse(categoryBannersRaw) : currentSettings.customization.categoryBanners,
    infoBanners: infoBannersRaw ? JSON.parse(infoBannersRaw) : currentSettings.customization.infoBanners,
    homeCategories: homeCategoriesRaw ? JSON.parse(homeCategoriesRaw) : (currentSettings.customization.homeCategories || []),
    storefrontDisplayMode,
    storefrontNavigationMode,
    storefrontDefaultSort,
    showPixDiscount,
    showInstallments,
    mediaAspectWidth,
    mediaAspectHeight,
    loginSideImageUrl: hasFormField(formData, 'loginSideImageUrl') ? loginSideImageUrl : (currentSettings.customization.loginSideImageUrl ?? null),
    logoUrl: hasFormField(formData, 'logoUrl') ? logoUrl : currentSettings.customization.logoUrl,
    logoLightUrl: hasFormField(formData, 'logoLightUrl') ? logoLightUrl : currentSettings.customization.logoLightUrl,
    logoDarkUrl: hasFormField(formData, 'logoDarkUrl') ? logoDarkUrl : currentSettings.customization.logoDarkUrl,
    faviconUrl: hasFormField(formData, 'faviconUrl') ? faviconUrl : currentSettings.customization.faviconUrl,
  }

  let productCustomFields: NonNullable<SiteSettings['productCustomFields']> = normalizeProductCustomFieldsMeta(
    currentSettings.productCustomFields,
    currentSettings.productCustomFields,
  )

  if (hasFormField(formData, 'productCustomFields')) {
    const rawProductCustomFields = getFormString(formData, 'productCustomFields')
    if (rawProductCustomFields) {
      try {
        const parsed = JSON.parse(rawProductCustomFields)
        productCustomFields = normalizeProductCustomFieldsMeta(parsed, currentSettings.productCustomFields)
      } catch {
        return { success: false, error: 'Payload de campos customizados de produto inválido' }
      }
    }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieHeader = await buildAdminCookieHeader()

  if (base && cookieHeader) {
    const saveThemeResult = await saveThemeSettingsMetaToBackend(base, cookieHeader, customization, actorUserId)
    if (!saveThemeResult.success) {
      return { success: false, error: saveThemeResult.error || 'Erro ao salvar configuração de tema' }
    }

    const saveProductResult = await saveProductSettingsMetaToBackend(
      base,
      cookieHeader,
      { fields: productCustomFields },
      actorUserId,
    )
    if (!saveProductResult.success) {
      return { success: false, error: saveProductResult.error || 'Erro ao salvar configuração de produto' }
    }
  }

  const updated = await updateSiteSettings({ customization, productCustomFields })

  await createAuditLog({
    actorUserId,
    action: 'CUSTOMIZATION_UPDATED',
    entityType: 'SiteSettings',
    entityId: 'settings_main',
    beforeJson: currentSettings.customization as unknown as Record<string, unknown>,
    afterJson: customization as unknown as Record<string, unknown>,
  })

  revalidatePath('/settings')
  revalidatePath('/')

  return { success: true, data: updated }
}

export async function updatePaymentSettingsAction(formData: FormData): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  const actorUserId = session?.id || 'store-session'

  const currentSettings = await getSiteSettings()

  const modeValue = getFormString(formData, 'mode')
  const integratedFlowValue = getFormString(formData, 'integratedFlow')
  const providerValue = getFormString(formData, 'provider')
  const gatewayEnvironmentValue = getFormString(formData, 'gatewayEnvironment')
  const manualInstructionsValue = getFormString(formData, 'manualInstructions')
  const apiKeyValue = getFormString(formData, 'apiKey')
  const secretKeyValue = getFormString(formData, 'secretKey')
  const webhookSecretValue = getFormString(formData, 'webhookSecret')
  const webhookTokenValue = getFormString(formData, 'webhookToken')
  const enablePixValue = getFormString(formData, 'enablePix')
  const enableBoletoValue = getFormString(formData, 'enableBoleto')
  const enableCreditCardValue = getFormString(formData, 'enableCreditCard')
  const maxInstallmentsRaw = getFormString(formData, 'maxInstallments')
  const enableFaturadoValue = getFormString(formData, 'enableFaturado')
  const faturadoMinOrderValueRaw = getFormString(formData, 'faturadoMinOrderValue')
  const faturadoMaxDaysRaw = getFormString(formData, 'faturadoMaxDays')
  const pixConditionsRaw = getFormString(formData, 'pixConditions')
  const boletoConditionsRaw = getFormString(formData, 'boletoConditions')
  const creditCardConditionsRaw = getFormString(formData, 'creditCardConditions')
  const faturadoConditionsRaw = getFormString(formData, 'faturadoConditions')
  const customMethodsRaw = getFormString(formData, 'customMethods')

  const resolvedMode = (modeValue as 'MANUAL' | 'INTEGRATED') || currentSettings.paymentSettings.mode

  const paymentSettings = {
    mode: resolvedMode,
    integratedFlow: (integratedFlowValue === 'LINK_AFTER_VALIDATION'
      ? 'LINK_AFTER_VALIDATION'
      : (integratedFlowValue === 'AUTO_CHARGE' ? 'AUTO_CHARGE' : currentSettings.paymentSettings.integratedFlow)),
    provider: ((providerValue || '').toUpperCase() === 'PAGSEGURO'
      ? 'PAGBANK'
      : providerValue) as 'STRIPE' | 'MERCADO_PAGO' | 'PAGBANK' | 'ASAAS' | 'GETNET' | 'PAGARME' | 'REDE' | 'NONE' || currentSettings.paymentSettings.provider,
    gatewayEnvironment: gatewayEnvironmentValue === 'SANDBOX'
      ? 'SANDBOX'
      : 'PRODUCTION',
    manualInstructions: manualInstructionsValue || currentSettings.paymentSettings.manualInstructions,
    apiKey: apiKeyValue || currentSettings.paymentSettings.apiKey,
    secretKey: secretKeyValue || currentSettings.paymentSettings.secretKey,
    webhookSecret: webhookSecretValue || currentSettings.paymentSettings.webhookSecret,
    webhookToken: webhookTokenValue || currentSettings.paymentSettings.webhookToken,
    providerWebhookUrl: currentSettings.paymentSettings.providerWebhookUrl,
    providerCronUrl: currentSettings.paymentSettings.providerCronUrl,
    getnetWebhookEvent: currentSettings.paymentSettings.getnetWebhookEvent ?? null,
    getnetWebhookSubscriptionId: currentSettings.paymentSettings.getnetWebhookSubscriptionId ?? null,
    getnetWebhookAuthenticationType: currentSettings.paymentSettings.getnetWebhookAuthenticationType ?? null,
    enablePix: hasFormField(formData, 'enablePix') ? enablePixValue === 'true' : currentSettings.paymentSettings.enablePix,
    enableBoleto: hasFormField(formData, 'enableBoleto') ? enableBoletoValue === 'true' : currentSettings.paymentSettings.enableBoleto,
    enableCreditCard: hasFormField(formData, 'enableCreditCard')
      ? enableCreditCardValue === 'true'
      : currentSettings.paymentSettings.enableCreditCard,
    maxInstallments: Math.min(12, Math.max(1, maxInstallmentsRaw ? parseInt(maxInstallmentsRaw, 10) || 1 : currentSettings.paymentSettings.maxInstallments)),
    enableFaturado: hasFormField(formData, 'enableFaturado') ? enableFaturadoValue === 'true' : currentSettings.paymentSettings.enableFaturado,
    faturadoMinOrderValue: faturadoMinOrderValueRaw ? parseFloat(faturadoMinOrderValueRaw) : currentSettings.paymentSettings.faturadoMinOrderValue,
    faturadoMaxDays: faturadoMaxDaysRaw ? parseInt(faturadoMaxDaysRaw) : currentSettings.paymentSettings.faturadoMaxDays,
    pixConditions: pixConditionsRaw ? JSON.parse(pixConditionsRaw) : currentSettings.paymentSettings.pixConditions,
    boletoConditions: boletoConditionsRaw ? JSON.parse(boletoConditionsRaw) : currentSettings.paymentSettings.boletoConditions,
    creditCardConditions: creditCardConditionsRaw ? JSON.parse(creditCardConditionsRaw) : currentSettings.paymentSettings.creditCardConditions,
    faturadoConditions: faturadoConditionsRaw ? JSON.parse(faturadoConditionsRaw) : currentSettings.paymentSettings.faturadoConditions,
    customMethods: customMethodsRaw ? JSON.parse(customMethodsRaw) : currentSettings.paymentSettings.customMethods,
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieHeader = await buildAdminCookieHeader()

  if (base && cookieHeader) {
    const savePaymentResult = await savePaymentSettingsMetaToBackend(base, cookieHeader, paymentSettings, actorUserId)
    if (!savePaymentResult.success) {
      return { success: false, error: savePaymentResult.error || 'Erro ao salvar configuração de pagamento' }
    }
  }

  const updated = await updateSiteSettings({ paymentSettings })

  await createAuditLog({
    actorUserId,
    action: 'PAYMENT_SETTINGS_UPDATED',
    entityType: 'SiteSettings',
    entityId: 'settings_main',
    beforeJson: currentSettings.paymentSettings as unknown as Record<string, unknown>,
    afterJson: paymentSettings as unknown as Record<string, unknown>,
  })

  revalidatePath('/settings')

  return { success: true, data: updated }
}

export type GetnetWebhookSubscriptionOperation = 'register' | 'consult' | 'remove'

export async function manageGetnetWebhookSubscriptionAction(
  operation: GetnetWebhookSubscriptionOperation,
  eventName?: string | null,
): Promise<ApiResponse<PaymentSettings>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const currentSettings = await getSiteSettings()
  const fallbackEvent = currentSettings.paymentSettings.getnetWebhookEvent || 'APPROVED_TRANSACTIONS'
  const normalizedEvent = String(eventName || fallbackEvent).trim().toUpperCase()

  const method = operation === 'register' ? 'POST' : operation === 'remove' ? 'DELETE' : 'GET'

  try {
    const url = new URL('/payment-config/getnet/subscription', base)
    url.searchParams.set('store_id', String(storeId))
    if (normalizedEvent) {
      url.searchParams.set('event_name', normalizedEvent)
    }

    const response = await fetch(url, {
      method,
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST'
        ? JSON.stringify({
            event_name: normalizedEvent,
            authentication_type: 'oauth',
          })
        : undefined,
      cache: 'no-store',
    })

    if (!response.ok) {
      const fallback = operation === 'register'
        ? 'Erro ao registrar webhook da Getnet'
        : operation === 'remove'
          ? 'Erro ao remover webhook da Getnet'
          : 'Erro ao consultar webhook da Getnet'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const refreshed = await getPaymentSettingsMetaFromBackend(base, cookieHeader, storeId)
    if (!refreshed.success || !refreshed.data) {
      return { success: false, error: refreshed.error || 'Erro ao atualizar estado de pagamento' }
    }

    const normalized = normalizePaymentSettingsMeta(refreshed.data, DEFAULT_PAYMENT_SETTINGS)
    await updateSiteSettings({ paymentSettings: normalized })
    revalidatePath('/settings')

    return { success: true, data: normalized }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao gerenciar webhook da Getnet'),
    }
  }
}

export type CorreiosConnectionTestResult = {
  success: boolean
  tokenOk: boolean
  quoteOk: boolean | null
  message: string
}

export async function testCorreiosConnectionAction(input: {
  idCorreios?: string | null
  apiKey?: string | null
  postcardNumber?: string | null
  originCep?: string | null
}): Promise<ApiResponse<CorreiosConnectionTestResult>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const response = await fetch(new URL('/shipping/correios/test-connection', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        id_correios: input.idCorreios?.trim() || null,
        api_key: input.apiKey?.trim() || null,
        postcard_number: input.postcardNumber?.trim() || null,
        origin_cep: input.originCep?.trim() || null,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Falha ao testar integração Correios')
      return { success: false, error: errorText }
    }

    const payload = (await response.json()) as {
      success?: boolean
      token_ok?: boolean
      quote_ok?: boolean | null
      message?: string
    }

    return {
      success: true,
      data: {
        success: payload.success ?? true,
        tokenOk: payload.token_ok ?? true,
        quoteOk: payload.quote_ok ?? null,
        message: payload.message || 'Integração Correios OK.',
      },
    }
  } catch (error) {
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao testar integração Correios'),
    }
  }
}

export async function getPaymentMethodsAction(): Promise<ApiResponse<PaymentMethodConfig[]>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/payment-methods', base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao buscar métodos de pagamento')
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    const methods = (Array.isArray(payload) ? payload : []).map(mapBackendPaymentMethodToLocal)
    return { success: true, data: methods }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao buscar métodos de pagamento') }
  }
}

export async function getStorefrontPaymentMethodsAction(
  storeId?: number | string | null,
): Promise<ApiResponse<PaymentMethodConfig[]>> {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)

  try {
    const url = new URL('/payment-methods', base)
    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId })

    const response = await fetch(url, {
      headers: withStorefrontScopeHeaders({}, storefrontApiKey),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao buscar métodos de pagamento')
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    const methods = (Array.isArray(payload) ? payload : []).map(mapBackendPaymentMethodToLocal)
    return { success: true, data: methods }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao buscar métodos de pagamento') }
  }
}

export async function getStorefrontPaymentConfigAction(
  storeId?: number | string | null,
): Promise<ApiResponse<PaymentSettings>> {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)

  try {
    const url = new URL('/v1/payment-config', base)
    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId })

    const response = await fetch(url, {
      headers: withStorefrontScopeHeaders({}, storefrontApiKey),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao buscar configuração de pagamento')
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    if (!payload || typeof payload !== 'object') {
      return { success: true, data: DEFAULT_PAYMENT_SETTINGS }
    }

    const normalizedMeta = normalizeTransportValue(payload)
    const normalizedObject = normalizedMeta && typeof normalizedMeta === 'object'
      ? normalizedMeta as Record<string, unknown>
      : {}

    return {
      success: true,
      data: normalizePaymentSettingsMeta(normalizedObject, DEFAULT_PAYMENT_SETTINGS),
    }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao buscar configuração de pagamento') }
  }
}

export async function createPaymentMethodAction(formData: FormData): Promise<ApiResponse<PaymentMethodConfig>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const name = String(formData.get('name') || '').trim()
  const type = String(formData.get('type') || '').trim()
  const metaRaw = String(formData.get('meta') || '{}').trim() || '{}'

  if (!name) return { success: false, error: 'Nome é obrigatório' }
  if (!type) return { success: false, error: 'Tipo é obrigatório' }

  let meta: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(metaRaw)
    meta = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return { success: false, error: 'Meta JSON inválido' }
  }

  try {
    const response = await fetch(new URL('/payment-methods', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        name,
        type,
        store_id: storeId,
        meta,
      }),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao criar método de pagamento')
      return { success: false, error: errorText }
    }

    const created = mapBackendPaymentMethodToLocal(await response.json())
    revalidatePath('/settings')
    return { success: true, data: created }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao criar método de pagamento') }
  }
}

export async function updatePaymentMethodAction(id: string, formData: FormData): Promise<ApiResponse<PaymentMethodConfig>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'ID inválido' }
  }

  const name = String(formData.get('name') || '').trim()
  const type = String(formData.get('type') || '').trim()
  const metaRaw = String(formData.get('meta') || '{}').trim() || '{}'

  if (!name) return { success: false, error: 'Nome é obrigatório' }
  if (!type) return { success: false, error: 'Tipo é obrigatório' }

  let meta: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(metaRaw)
    meta = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return { success: false, error: 'Meta JSON inválido' }
  }

  try {
    const response = await fetch(new URL(`/payment-methods/${numericId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({ name, type, meta }),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao atualizar método de pagamento')
      return { success: false, error: errorText }
    }

    const updated = mapBackendPaymentMethodToLocal(await response.json())
    revalidatePath('/settings')
    return { success: true, data: updated }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao atualizar método de pagamento') }
  }
}

export async function deletePaymentMethodAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'ID inválido' }
  }

  try {
    const response = await fetch(new URL(`/payment-methods/${numericId}`, base), {
      method: 'DELETE',
      headers: { cookie: cookieHeader },
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao excluir método de pagamento')
      return { success: false, error: errorText }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao excluir método de pagamento') }
  }
}

// Domain Settings
export async function updateDomainSettingsAction(formData: FormData): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  const actorUserId = session?.id || 'store-session'

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieHeader = await buildAdminCookieHeader()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const currentSettingsResult = await getSiteSettingsAction()
  const currentSettings = currentSettingsResult.success && currentSettingsResult.data
    ? currentSettingsResult.data
    : await getSiteSettings()
  const currentDomainSettings = normalizeDomainSettingsMeta(currentSettings.domainSettings)

  const customDomain = formData.get('customDomain') as string || null

  // Generate verification token if new domain
  let domainVerificationToken = currentDomainSettings.domainVerificationToken
  if (customDomain && customDomain !== currentDomainSettings.customDomain) {
    domainVerificationToken = `v0-verify-${Math.random().toString(36).substring(2, 15)}`
  }

  const domainSettings: SiteSettings['domainSettings'] = {
    customDomain: customDomain || null,
    domainStatus: customDomain ? 'VERIFYING' as const : 'PENDING' as const,
    domainVerificationToken,
    sslEnabled: formData.get('sslEnabled') === 'true',
    wwwRedirect: formData.get('wwwRedirect') === 'true',
  }

  const saveDomainResult = await saveDomainSettingsMetaToBackend(base, cookieHeader, domainSettings, actorUserId)
  if (!saveDomainResult.success) {
    return { success: false, error: saveDomainResult.error || 'Erro ao salvar configuração de domínio' }
  }

  const updated = await updateSiteSettings({ domainSettings })

  await createAuditLog({
    actorUserId,
    action: 'DOMAIN_SETTINGS_UPDATED',
    entityType: 'SiteSettings',
    entityId: 'settings_main',
    beforeJson: currentSettings.domainSettings as unknown as Record<string, unknown>,
    afterJson: domainSettings as unknown as Record<string, unknown>,
  })

  revalidatePath('/settings')
  revalidatePath('/settings/domain')

  return { success: true, data: updated }
}

export async function updateErpSettingsAction(
  erpSettings: ErpSettings,
): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  const actorUserId = session?.id || 'store-session'

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieHeader = await buildAdminCookieHeader()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const normalizedErpSettings = normalizeErpSettingsMeta(erpSettings)
  const saveResult = await saveErpSettingsMetaToBackend(base, cookieHeader, normalizedErpSettings, actorUserId)
  if (!saveResult.success) {
    return { success: false, error: saveResult.error || 'Erro ao salvar configuração de ERP' }
  }

  const updated = await updateSiteSettings({ erpSettings: normalizedErpSettings })

  await createAuditLog({
    actorUserId,
    action: 'ERP_SETTINGS_UPDATED',
    entityType: 'SiteSettings',
    entityId: 'settings_main',
    beforeJson: null,
    afterJson: normalizedErpSettings as unknown as Record<string, unknown>,
  })

  revalidatePath('/settings')
  revalidatePath('/settings/integrations')
  revalidatePath('/settings/erp')

  return { success: true, data: updated }
}

// Marketing Settings
export async function updateMarketingSettingsAction(marketingSettings: MarketingSettings): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }
  const actorUserId = session?.id || 'store-session'

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) return { success: false, error: 'URL do backend não configurada' }

  const storeId = await getStoreIdFromBackend(base, authCookieHeader)
  if (!storeId) return { success: false, error: 'Loja do admin não resolvida' }

  const actorId = Number.isInteger(Number(actorUserId)) ? Number(actorUserId) : null

  try {
    const response = await fetch(new URL('/settings/upsert', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authCookieHeader ? { cookie: authCookieHeader } : {}),
      },
      body: JSON.stringify({
        store_id: storeId,
        code: 'marketing',
        title: 'Marketing Settings',
        meta: marketingSettings,
        updated_by: actorId,
      }),
    })

    if (!response.ok) {
      const fallback = 'Erro ao salvar configurações de marketing'
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao salvar configurações de marketing') }
  }

  await createAuditLog({
    actorUserId,
    action: 'MARKETING_SETTINGS_UPDATED',
    entityType: 'SiteSettings',
    entityId: 'settings_main',
    beforeJson: {},
    afterJson: marketingSettings as unknown as Record<string, unknown>,
  })

  revalidatePath('/settings')
  revalidatePath('/')

  const updated = await getSiteSettings()
  return { success: true, data: updated }
}

// Price Tables
function mapBackendPriceTableToLocal(table: any): PriceTable {
  const tableType = table?.table_type === 'fixed_prices_per_product' ? 'OVERRIDE' : 'PERCENTAGE'
  const percentageBps = typeof table?.percentage_bps === 'number' ? table.percentage_bps : null

  return {
    id: String(table.id),
    name: String(table.name ?? ''),
    type: tableType,
    percentage: tableType === 'PERCENTAGE' && percentageBps !== null ? percentageBps / 100 : null,
    isDefault: Boolean(table.is_default),
    isActive: Boolean(table.is_active),
    createdAt: new Date(table.created_at || new Date()),
  }
}

function mapBackendPriceTableItemToLocal(item: any): PriceTableItem {
  return {
    id: String(item.id),
    priceTableId: String(item.price_table_id),
    productId: String(item.product_id),
    overridePrice: Number(item.fixed_price_cents) / 100,
  }
}

function mapLocalTypeToBackendType(type: PriceTable['type']) {
  return type === 'OVERRIDE' ? 'fixed_prices_per_product' : 'percentage_over_base'
}

function pricePercentToBps(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null
  return Math.round(Math.abs(value) * 100)
}

export async function getPriceTablesAction(): Promise<ApiResponse<PriceTable[]>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/price-tables', base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao buscar tabelas de preço')
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    const tables = (Array.isArray(payload) ? payload : []).map(mapBackendPriceTableToLocal)
    return { success: true, data: tables }
  } catch (error) {
    console.error('Erro ao buscar price tables:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao buscar tabelas de preço') }
  }
}

export async function createPriceTableAction(formData: FormData): Promise<ApiResponse<PriceTable>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }
  const actorUserId = session?.id || 'store-session'

  const data = {
    name: formData.get('name') as string,
    type: formData.get('type') as 'PERCENTAGE' | 'OVERRIDE',
    percentage: formData.get('percentage') ? Math.abs(parseFloat(formData.get('percentage') as string)) : null,
    isDefault: formData.get('isDefault') === 'true',
    isActive: formData.get('isActive') !== 'false',
  }

  const validation = priceTableSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: getValidationErrorMessage(validation.error) }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const payload = {
    store_id: storeId,
    name: validation.data.name,
    table_type: mapLocalTypeToBackendType(validation.data.type),
    percentage_bps: validation.data.type === 'PERCENTAGE'
      ? pricePercentToBps(validation.data.percentage ?? 0)
      : null,
    is_default: validation.data.isDefault,
    is_active: validation.data.isActive,
  }

  try {
    const response = await fetch(new URL('/price-tables', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao criar tabela de preço')
      return { success: false, error: errorText }
    }

    const created = await response.json()
    const table = mapBackendPriceTableToLocal(created)

    await createAuditLog({
      actorUserId,
      action: 'PRICE_TABLE_CREATED',
      entityType: 'PriceTable',
      entityId: table.id,
      beforeJson: null,
      afterJson: table as unknown as Record<string, unknown>,
    })

    revalidatePath('/price-tables')

    return { success: true, data: table }
  } catch (error) {
    console.error('Erro ao criar price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao criar tabela de preço') }
  }
}

export async function updatePriceTableAction(id: string, formData: FormData): Promise<ApiResponse<PriceTable>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }
  const actorUserId = session?.id || 'store-session'

  const existing = await getPriceTableById(id)
  if (!existing.success || !existing.data) {
    return { success: false, error: existing.error || 'Tabela não encontrada' }
  }

  const data = {
    name: formData.get('name') as string,
    type: formData.get('type') as 'PERCENTAGE' | 'OVERRIDE',
    percentage: formData.get('percentage') ? Math.abs(parseFloat(formData.get('percentage') as string)) : null,
    isDefault: formData.get('isDefault') === 'true',
    isActive: formData.get('isActive') !== 'false',
  }

  const validation = priceTableSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: getValidationErrorMessage(validation.error) }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const payload = {
    name: validation.data.name,
    table_type: mapLocalTypeToBackendType(validation.data.type),
    percentage_bps: validation.data.type === 'PERCENTAGE'
      ? pricePercentToBps(validation.data.percentage ?? 0)
      : null,
    is_default: validation.data.isDefault,
    is_active: validation.data.isActive,
  }

  try {
    const response = await fetch(new URL(`/price-tables/${id}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao atualizar tabela de preço')
      return { success: false, error: errorText }
    }

    const updated = await response.json()
    const table = mapBackendPriceTableToLocal(updated)

    await createAuditLog({
      actorUserId,
      action: 'PRICE_TABLE_UPDATED',
      entityType: 'PriceTable',
      entityId: id,
      beforeJson: existing.data as unknown as Record<string, unknown>,
      afterJson: table as unknown as Record<string, unknown>,
    })

    revalidatePath('/price-tables')

    return { success: true, data: table }
  } catch (error) {
    console.error('Erro ao atualizar price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao atualizar tabela de preço') }
  }
}

export async function deletePriceTableAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }
  const actorUserId = session?.id || 'store-session'

  const existing = await getPriceTableById(id)
  if (!existing.success || !existing.data) {
    return { success: false, error: existing.error || 'Tabela não encontrada' }
  }

  if (existing.data.isDefault) {
    return { success: false, error: 'Não é possível excluir a tabela padrão' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  try {
    const response = await fetch(new URL(`/price-tables/${id}`, base), {
      method: 'DELETE',
      headers: {
        cookie: cookieHeader,
      },
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao excluir tabela de preço')
      return { success: false, error: errorText }
    }

    await createAuditLog({
      actorUserId,
      action: 'PRICE_TABLE_DELETED',
      entityType: 'PriceTable',
      entityId: id,
      beforeJson: existing.data as unknown as Record<string, unknown>,
      afterJson: null,
    })

    revalidatePath('/price-tables')

    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao excluir tabela de preço') }
  }
}

// Price Table Items
export async function getPriceTableItemsAction(priceTableId: string): Promise<ApiResponse<PriceTableItem[]>> {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cookieHeader = await buildAdminCookieHeader()
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  try {
    const url = new URL('/price-table-items', base)
    url.searchParams.set('price_table_id', priceTableId)

    const response = await fetch(url, {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao buscar itens da tabela')
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    const items = (Array.isArray(payload) ? payload : []).map(mapBackendPriceTableItemToLocal)
    return { success: true, data: items }
  } catch (error) {
    console.error('Erro ao buscar itens da price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao buscar itens da tabela') }
  }
}

export async function createPriceTableItemAction(formData: FormData): Promise<ApiResponse<PriceTableItem>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const data = {
    priceTableId: formData.get('priceTableId') as string,
    productId: formData.get('productId') as string,
    overridePrice: parseFloat(formData.get('overridePrice') as string),
  }

  const validation = priceTableItemSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: getValidationErrorMessage(validation.error) }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const fixedPriceCents = Math.round(validation.data.overridePrice * 100)

  try {
    const response = await fetch(new URL('/price-table-items', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        price_table_id: validation.data.priceTableId,
        product_id: Number(validation.data.productId),
        fixed_price_cents: fixedPriceCents,
      }),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao criar item da tabela')
      return { success: false, error: errorText }
    }

    const created = await response.json()
    const item = mapBackendPriceTableItemToLocal(created)

    revalidatePath('/price-tables')

    return { success: true, data: item }
  } catch (error) {
    console.error('Erro ao criar item da price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao criar item da tabela') }
  }
}

export async function deletePriceTableItemAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  try {
    const response = await fetch(new URL(`/price-table-items/${id}`, base), {
      method: 'DELETE',
      headers: {
        cookie: cookieHeader,
      },
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao excluir item da tabela')
      return { success: false, error: errorText }
    }

    revalidatePath('/price-tables')

    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir item da price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao excluir item da tabela') }
  }
}

// Tier Discounts
function getActionFormValue(formData: FormData, key: string): string | null {
  const direct = formData.get(key)
  if (typeof direct === 'string') return direct

  for (const [formKey, value] of formData.entries()) {
    if (formKey.endsWith(`_${key}`) && typeof value === 'string') {
      return value
    }
  }

  return null
}

function hasActionFormField(formData: FormData, key: string): boolean {
  if (formData.has(key)) return true

  for (const formKey of formData.keys()) {
    if (formKey.endsWith(`_${key}`)) {
      return true
    }
  }

  return false
}

async function getBackendErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text()
    if (!text) return fallback

    try {
      const parsed = JSON.parse(text)
      if (typeof parsed === 'string' && parsed.trim()) return parsed
      if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error
      if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message
    } catch {
      // ignore json parse error, fallback to raw text
    }

    return text
  } catch {
    return fallback
  }
}

function getThrownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return `${fallback}: ${error.message}`
  }
  if (typeof error === 'string' && error.trim()) {
    return `${fallback}: ${error}`
  }
  return fallback
}

function isSettingsAuthorized(session: Awaited<ReturnType<typeof getSession>>, cookieHeader?: string): boolean {
  if (session && canManageSettings(session.role)) {
    return true
  }

  if (!cookieHeader) {
    return false
  }

  return cookieHeader.includes('adminAuthToken=')
}

async function hasPagePermission(permissionCode: string): Promise<boolean> {
  try {
    const result = await checkUserPermission(permissionCode)
    return result?.has_permission === true
  } catch {
    return false
  }
}

async function hasSettingsEditPermission(): Promise<boolean> {
  return hasPagePermission('settings.edit')
}

async function hasSettingsTeamPermission(): Promise<boolean> {
  return hasPagePermission('settings.manage_team')
}

async function hasUsersPermission(
  permissionCode: 'users.view' | 'users.create' | 'users.edit' | 'users.delete',
): Promise<boolean> {
  if (await hasSettingsTeamPermission()) {
    return true
  }

  return hasPagePermission(permissionCode)
}

export async function getTierDiscountsAction(): Promise<ApiResponse<TierDiscount[]>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL('/volume-pricing-tiers', base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar descontos por quantidade' }
    }

    const rustTiers = await response.json()
    const tiers: TierDiscount[] = rustTiers
      .filter((t: any) => Number(t.store_id) === storeId)
      .map((t: any) => ({
      id: String(t.id),
      minPieces: Number(t.min_quantity),
      discountPct: Number(t.percentage),
      isActive: t.status ?? true,
      createdAt: new Date(t.created_at || new Date()),
      }))

    return { success: true, data: tiers }
  } catch (error) {
    console.error('Erro ao buscar tier discounts:', error)
    return { success: false, error: 'Erro ao buscar descontos por quantidade' }
  }
}

export async function createTierDiscountAction(formData: FormData): Promise<ApiResponse<TierDiscount>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const minPiecesRaw = getActionFormValue(formData, 'minPieces')
  const discountPctRaw = getActionFormValue(formData, 'discountPct')
  const isActiveRaw = getActionFormValue(formData, 'isActive')

  const data = {
    minPieces: parseInt(minPiecesRaw ?? ''),
    discountPct: parseFloat(discountPctRaw ?? ''),
    isActive: isActiveRaw === 'true',
  }

  const validation = tierDiscountSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: getValidationErrorMessage(validation.error) }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const response = await fetch(new URL('/volume-pricing-tiers', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        min_quantity: validation.data.minPieces,
        max_quantity: null,
        percentage: validation.data.discountPct,
        status: validation.data.isActive,
      }),
    })

    if (!response.ok) {
      const fallback = `Erro ao criar desconto por quantidade (HTTP ${response.status} ${response.statusText})`
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const createdTier = await response.json()
    const tier: TierDiscount = {
      id: String(createdTier.id),
      minPieces: Number(createdTier.min_quantity),
      discountPct: Number(createdTier.percentage),
      isActive: createdTier.status ?? true,
      createdAt: new Date(createdTier.created_at || new Date()),
    }

    revalidatePath('/tier-discounts')

    return { success: true, data: tier }
  } catch (error) {
    console.error('Erro ao criar tier discount:', error)
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao criar desconto por quantidade'),
    }
  }
}

export async function updateTierDiscountAction(id: string, formData: FormData): Promise<ApiResponse<TierDiscount>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const data: Partial<TierDiscount> = {}
  if (hasActionFormField(formData, 'minPieces')) {
    const minPiecesRaw = getActionFormValue(formData, 'minPieces')
    if (minPiecesRaw !== null) data.minPieces = parseInt(minPiecesRaw)
  }
  if (hasActionFormField(formData, 'discountPct')) {
    const discountPctRaw = getActionFormValue(formData, 'discountPct')
    if (discountPctRaw !== null) data.discountPct = parseFloat(discountPctRaw)
  }
  if (hasActionFormField(formData, 'isActive')) {
    const isActiveRaw = getActionFormValue(formData, 'isActive')
    data.isActive = isActiveRaw === 'true'
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  const payload: Record<string, unknown> = {}
  if (data.minPieces !== undefined) payload.min_quantity = data.minPieces
  if (data.discountPct !== undefined) payload.percentage = data.discountPct
  if (data.isActive !== undefined) payload.status = data.isActive

  try {
    const url = new URL(`/volume-pricing-tiers/${id}`, base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const fallback = `Desconto não encontrado (HTTP ${response.status} ${response.statusText})`
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    const updatedTier = await response.json()
    const tier: TierDiscount = {
      id: String(updatedTier.id),
      minPieces: Number(updatedTier.min_quantity),
      discountPct: Number(updatedTier.percentage),
      isActive: updatedTier.status ?? true,
      createdAt: new Date(updatedTier.created_at || new Date()),
    }

    revalidatePath('/tier-discounts')

    return { success: true, data: tier }
  } catch (error) {
    console.error('Erro ao atualizar tier discount:', error)
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao atualizar desconto por quantidade'),
    }
  }
}

export async function deleteTierDiscountAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  if (!storeId) {
    return { success: false, error: 'Erro ao obter loja atual' }
  }

  try {
    const url = new URL(`/volume-pricing-tiers/${id}`, base)
    url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        cookie: cookieHeader,
      },
    })

    if (!response.ok) {
      const fallback = `Erro ao deletar desconto por quantidade (HTTP ${response.status} ${response.statusText})`
      const errorText = await getBackendErrorMessage(response, fallback)
      return { success: false, error: errorText }
    }

    revalidatePath('/tier-discounts')

    return { success: true }
  } catch (error) {
    console.error('Erro ao deletar tier discount:', error)
    return {
      success: false,
      error: getThrownErrorMessage(error, 'Erro ao deletar desconto por quantidade'),
    }
  }
}

// Users

function isUsersAuthorized(session: Awaited<ReturnType<typeof getSession>>, cookieHeader?: string): boolean {
  if (session?.role === 'ADMIN') {
    return true
  }

  if (!cookieHeader) {
    return false
  }

  return cookieHeader.includes('adminAuthToken=')
}

async function buildAdminCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const cookieValues = [
    adminToken ? `adminAuthToken=${adminToken}` : null,
  ].filter(Boolean)

  if (cookieValues.length === 0) return undefined
  return cookieValues.join('; ')
}

function normalizeStoreIdInput(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number(value.trim())
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function getStoreIdFromBackend(
  _base: string,
  cookieHeader?: string,
  preferredStoreId?: number | string | null,
) {
  const explicitStoreId = normalizeStoreIdInput(preferredStoreId)
  if (explicitStoreId) return explicitStoreId

  const adminStoreId = await getAdminStoreIdFromToken()
  if (adminStoreId) return adminStoreId

  if (cookieHeader?.includes('adminAuthToken=')) {
    return null
  }

  const rawStoreId = process.env.STORE_ID
  if (!rawStoreId) return null

  const parsed = Number(rawStoreId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function mapAdminToUser(admin: any): User {
  const platforms = Array.isArray(admin?.device_platforms)
    ? admin.device_platforms
        .map((entry: unknown) => String(entry || '').trim().toLowerCase())
        .filter((entry: string) => entry.length > 0)
    : []

  return {
    id: String(admin.id),
    name: admin.name,
    email: admin.email,
    phone: admin.phone ?? null,
    sellerSlug: admin.seller_slug ?? null,
    passwordHash: '',
    role: 'ADMIN',
    roleId: admin.role_id != null ? String(admin.role_id) : null,
    isActive: Boolean(admin.active),
    deviceCount: Number(admin?.device_count || 0),
    hasDevices: Boolean(admin?.has_devices),
    devicePlatforms: platforms,
    lastDeviceSeenAt: admin?.last_device_seen_at ? new Date(admin.last_device_seen_at) : null,
    createdAt: new Date(admin.created_at),
    updatedAt: new Date(admin.updated_at),
  }
}

export async function sendTestPushToAdminAction(adminId: string): Promise<ApiResponse<{ message: string; count?: number }>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasUsersPermission('users.edit'))) {
    return { success: false, error: 'Você não tem permissão para editar usuários' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const numericAdminId = Number(adminId)
  if (!Number.isInteger(numericAdminId) || numericAdminId <= 0) {
    return { success: false, error: 'Administrador inválido' }
  }

  const response = await fetch(new URL('/admin/notify', base), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({
      title: 'Teste de push',
      body: 'Este é um push de teste enviado pelo painel de usuários.',
      admin_ids: [numericAdminId],
    }),
  })

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>

  if (!response.ok) {
    const firstFailure = Array.isArray(payload?.failures) && payload.failures.length > 0
      ? payload.failures[0] as Record<string, unknown>
      : null
    const failureMessage = firstFailure && typeof firstFailure.error === 'string'
      ? firstFailure.error
      : null

    return {
      success: false,
      error: failureMessage
        ? `${String(payload?.message || payload?.error || 'Erro ao disparar push de teste')}: ${failureMessage}`
        : String(payload?.message || payload?.error || 'Erro ao disparar push de teste'),
    }
  }

  const cleanedCount = typeof payload?.cleaned === 'number' ? payload.cleaned : 0
  const messageBase = String(payload?.message || 'Push de teste enfileirado')
  const message = cleanedCount > 0
    ? `${messageBase}. ${cleanedCount} token(s) inválido(s) removido(s).`
    : messageBase

  return {
    success: true,
    data: {
      message,
      count: typeof payload?.count === 'number' ? payload.count : undefined,
    },
  }
}

export async function createUserAction(formData: FormData): Promise<ApiResponse<User>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasUsersPermission('users.create'))) {
    return { success: false, error: 'Você não tem permissão para criar usuários' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const name = getActionFormValue(formData, 'name') || ''
  const email = getActionFormValue(formData, 'email') || ''
  const phone = getActionFormValue(formData, 'phone') || ''
  const password = getActionFormValue(formData, 'password') || ''
  const sellerSlugRaw = getActionFormValue(formData, 'sellerSlug') || ''
  const roleIdRaw = getActionFormValue(formData, 'roleId')
  const roleId = roleIdRaw && roleIdRaw.trim().length > 0 ? Number(roleIdRaw) : null

  if (!name || !email || !phone || !password) {
    return { success: false, error: 'Dados incompletos' }
  }

  if (roleId !== null) {
    if (!Number.isInteger(roleId) || roleId <= 0) {
      return { success: false, error: 'Perfil inválido' }
    }

    const roleGroupsResponse = await fetch(new URL('/permissions/groups', base), {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!roleGroupsResponse.ok) {
      return { success: false, error: 'Não foi possível validar o perfil selecionado' }
    }

    const roleGroups = await roleGroupsResponse.json() as Array<{ id: number; is_system: boolean }>
    const selectedRole = roleGroups.find((group) => Number(group.id) === roleId)

    if (!selectedRole) {
      return { success: false, error: 'Perfil não encontrado' }
    }

    if (selectedRole.is_system) {
      return { success: false, error: 'Não é permitido atribuir perfil de sistema' }
    }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)

  const payload = {
    name,
    email,
    phone,
    password,
    ...(sellerSlugRaw.trim().length > 0 ? { seller_slug: sellerSlugRaw.trim() } : {}),
    role_id: roleId,
    active: true,
    store_id: storeId,
  }

  const response = await fetch(new URL('/admins', base), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return { success: false, error: errorText || 'Erro ao criar usuário no backend' }
  }

  const createdAdmin = await response.json()

  revalidatePath('/users')

  return { success: true, data: mapAdminToUser(createdAdmin) }
}

export async function updateUserAction(id: string, formData: FormData): Promise<ApiResponse<User>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasUsersPermission('users.edit'))) {
    return { success: false, error: 'Você não tem permissão para editar usuários' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const name = getActionFormValue(formData, 'name') || ''
  const email = getActionFormValue(formData, 'email') || ''
  const phone = getActionFormValue(formData, 'phone') || undefined
  const roleIdRaw = getActionFormValue(formData, 'roleId')
  const roleId = roleIdRaw && roleIdRaw.trim().length > 0 ? Number(roleIdRaw) : null
  const password = getActionFormValue(formData, 'password')
  const sellerSlugRaw = getActionFormValue(formData, 'sellerSlug')

  if (roleId !== null) {
    if (!Number.isInteger(roleId) || roleId <= 0) {
      return { success: false, error: 'Perfil inválido' }
    }

    const roleGroupsResponse = await fetch(new URL('/permissions/groups', base), {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!roleGroupsResponse.ok) {
      return { success: false, error: 'Não foi possível validar o perfil selecionado' }
    }

    const roleGroups = await roleGroupsResponse.json() as Array<{ id: number; is_system: boolean }>
    const selectedRole = roleGroups.find((group) => Number(group.id) === roleId)

    if (!selectedRole) {
      return { success: false, error: 'Perfil não encontrado' }
    }

    if (selectedRole.is_system) {
      return { success: false, error: 'Não é permitido atribuir perfil de sistema' }
    }
  }

  const payload: Record<string, unknown> = {
    name,
    email,
    ...(phone ? { phone } : {}),
    ...(typeof sellerSlugRaw === 'string' && sellerSlugRaw.trim().length > 0
      ? { seller_slug: sellerSlugRaw.trim() }
      : {}),
    role_id: roleId,
    active: getActionFormValue(formData, 'isActive') === 'true',
  }

  if (password && password.trim().length > 0) {
    payload.password = password
  }

  const response = await fetch(new URL(`/admins/${id}`, base), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return { success: false, error: errorText || 'Usuário não encontrado' }
  }

  const updatedAdmin = await response.json()

  revalidatePath('/users')

  return { success: true, data: mapAdminToUser(updatedAdmin) }
}

export interface UsersPageData {
  items: User[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export async function getUsersPageAction(input?: {
  page?: number
  perPage?: number
  query?: string
  isActive?: boolean
}): Promise<ApiResponse<UsersPageData>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasUsersPermission('users.view'))) {
    return { success: false, error: 'Você não tem permissão para visualizar usuários' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const usersUrl = new URL('/admin/users', base)
  const page = Number.isInteger(input?.page) && Number(input?.page) > 0 ? Number(input?.page) : 1
  const perPage = Number.isInteger(input?.perPage) && Number(input?.perPage) > 0
    ? Math.min(Number(input?.perPage), 200)
    : 20
  const query = String(input?.query || '').trim()

  usersUrl.searchParams.set('page', String(page))
  usersUrl.searchParams.set('perPage', String(perPage))

  if (query) {
    usersUrl.searchParams.set('q', query)
  }

  if (typeof input?.isActive === 'boolean') {
    usersUrl.searchParams.set('active', String(input.isActive))
  }

  const response = await fetch(usersUrl, {
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    return { success: false, error: errorText || 'Erro ao carregar usuários' }
  }

  const payload = await response.json()

  return {
    success: true,
    data: {
      items: Array.isArray(payload?.items) ? payload.items.map(mapAdminToUser) : [],
      total: typeof payload?.total === 'number' ? payload.total : 0,
      page: typeof payload?.page === 'number' ? payload.page : page,
      perPage: typeof payload?.perPage === 'number' ? payload.perPage : perPage,
      totalPages: typeof payload?.totalPages === 'number' ? payload.totalPages : 0,
    },
  }
}

export async function getUsersAction(filters?: { role?: string; isActive?: boolean }): Promise<ApiResponse<User[]>> {
  const pagedResult = await getUsersPageAction({
    page: 1,
    perPage: 200,
    isActive: filters?.isActive,
  })

  if (!pagedResult.success || !pagedResult.data) {
    return { success: false, error: pagedResult.error || 'Erro ao carregar usuários' }
  }

  let users = pagedResult.data.items

  if (filters?.role) {
    users = users.filter((user) => user.role === filters.role)
  }

  return { success: true, data: users }
}

type PermissionSummaryPayload = {
  permissions_from_role?: Array<{ code?: string }>
  permission_overrides?: Array<unknown>
}

function hasCustomersSupportPermission(payload: PermissionSummaryPayload | null | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false

  const overrides = Array.isArray(payload.permission_overrides)
    ? payload.permission_overrides
    : []

  const overrideTuple = overrides.find((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return false
    const permission = entry[0]
    return Boolean(permission && typeof permission === 'object' && (permission as Record<string, unknown>).code === 'customers.support')
  }) as [Record<string, unknown>, boolean] | undefined

  if (overrideTuple && typeof overrideTuple[1] === 'boolean') {
    return overrideTuple[1]
  }

  const rolePermissions = Array.isArray(payload.permissions_from_role)
    ? payload.permissions_from_role
    : []

  return rolePermissions.some((permission) => permission?.code === 'customers.support')
}

export async function getCustomerSupportAdminsAction(): Promise<ApiResponse<User[]>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasUsersPermission('users.view'))) {
    return { success: false, error: 'Você não tem permissão para visualizar usuários' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const usersResult = await getUsersAction({ isActive: true })
  if (!usersResult.success || !usersResult.data) {
    return { success: false, error: usersResult.error || 'Erro ao carregar usuários' }
  }

  const checks = await Promise.all(
    usersResult.data.map(async (user) => {
      try {
        const response = await fetch(new URL(`/permissions/user/${user.id}/permissions`, base), {
          headers: {
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          cache: 'no-store',
        })

        if (!response.ok) {
          return null
        }

        const payload = (await response.json()) as PermissionSummaryPayload
        return hasCustomersSupportPermission(payload) ? user : null
      } catch {
        return null
      }
    }),
  )

  return {
    success: true,
    data: checks.filter((entry): entry is User => Boolean(entry)),
  }
}

export async function toggleUserActiveAction(id: string): Promise<ApiResponse<User>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasUsersPermission('users.edit'))) {
    return { success: false, error: 'Você não tem permissão para editar usuários' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const currentResponse = await fetch(new URL(`/admins/${id}`, base), {
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: 'no-store',
  })

  if (!currentResponse.ok) {
    const errorText = await currentResponse.text()
    return { success: false, error: errorText || 'Usuário não encontrado' }
  }

  const currentAdmin = await currentResponse.json()

  const updateResponse = await fetch(new URL(`/admins/${id}`, base), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ active: !currentAdmin.active }),
  })

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text()
    return { success: false, error: errorText || 'Erro ao atualizar usuário' }
  }

  const updatedAdmin = await updateResponse.json()

  revalidatePath('/users')

  return { success: true, data: mapAdminToUser(updatedAdmin) }
}

export async function getPriceTableById(id: string): Promise<ApiResponse<PriceTable>> {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cookieHeader = await buildAdminCookieHeader()
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  try {
    const response = await fetch(new URL(`/price-tables/${id}`, base), {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Tabela não encontrada')
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    return { success: true, data: mapBackendPriceTableToLocal(payload) }
  } catch (error) {
    console.error('Erro ao obter price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao obter tabela de preço') }
  }
}

export async function getPriceTableItems(priceTableId: string): Promise<ApiResponse<PriceTableItem[]>> {
  return getPriceTableItemsAction(priceTableId)
}

export const setPriceTableItem = async (priceTableId: string, productId: string, overridePrice: number) => {
  const session = await getSession()
  if (!session || !canManagePriceTables(session.role)) {
    return { success: false, error: 'Não autorizado' }
  }

  const data = {
    priceTableId,
    productId,
    overridePrice,
  }

  const validation = priceTableItemSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: getValidationErrorMessage(validation.error) }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cookieHeader = await buildAdminCookieHeader()
  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado' }
  }

  try {
    const response = await fetch(new URL('/price-table-items', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        price_table_id: validation.data.priceTableId,
        product_id: Number(validation.data.productId),
        fixed_price_cents: Math.round(validation.data.overridePrice * 100),
      }),
    })

    if (!response.ok) {
      const errorText = await getBackendErrorMessage(response, 'Erro ao salvar item da tabela')
      return { success: false, error: errorText }
    }

    const payload = await response.json()
    revalidatePath('/price-tables')
    return { success: true, data: mapBackendPriceTableItemToLocal(payload) }
  } catch (error) {
    console.error('Erro ao salvar item da price table:', error)
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao salvar item da tabela') }
  }
}

export const removePriceTableItem = async (priceTableId: string, productId: string) => {
  const session = await getSession()
  if (!session || !canManagePriceTables(session.role)) {
    return { success: false, error: 'Não autorizado' }
  }

  const items = await getPriceTableItemsAction(priceTableId)
  if (!items.success || !items.data) {
    return { success: false, error: items.error || 'Erro ao buscar itens da tabela' }
  }

  const item = items.data.find((entry) => entry.productId === productId)
  if (!item) {
    return { success: true }
  }

  return deletePriceTableItemAction(item.id)
}

export const setPriceTableItemFromFormData = async (formData: FormData) => {
  const data = {
    priceTableId: formData.get('priceTableId') as string,
    productId: formData.get('productId') as string,
    overridePrice: parseFloat(formData.get('overridePrice') as string),
  }

  return setPriceTableItem(data.priceTableId, data.productId, data.overridePrice)
}

// Additional required exports
export async function getSellerProfiles() {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SALES_MANAGER')) {
    return { success: false, error: 'Não autorizado', data: [] }
  }
  return { success: false, error: 'Perfis de vendedor locais foram removidos. Use backend administrativo.', data: [] }
}

export async function createSellerProfile(formData: FormData) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'Não autorizado' }
  }

  return { success: false, error: 'Criação de perfil local removida. Use backend administrativo.' }
}

export async function updateSellerProfile(id: string, formData: FormData) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'Não autorizado' }
  }

  return { success: false, error: 'Atualização de perfil local removida. Use backend administrativo.' }
}

export async function updateMenuItemsAction(menuItems: import('@/lib/types').MenuItem[]): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasPagePermission('pages.edit'))) {
    return { success: false, error: 'Você não tem permissão para editar páginas' }
  }
  try {
    const updated = await updateSiteSettings({ menuItems } as Partial<SiteSettings>)
    revalidatePath('/', 'layout')
    return { success: true, data: updated as SiteSettings }
  } catch (error) {
    console.error('Error in updateMenuItemsAction:', error)
    return { success: false, error: 'Erro ao salvar menu' }
  }
}

export async function createInstitutionalPageAction(formData: FormData): Promise<ApiResponse<import('@/lib/types').InstitutionalPage>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasPagePermission('pages.create'))) {
    return { success: false, error: 'Você não tem permissão para criar páginas' }
  }
  try {
    const settings = await getSiteSettings()
    const pages: import('@/lib/types').InstitutionalPage[] = settings.institutionalPages || []
    const storeId = pages[0]?.store_id ?? 0
    const newPage: import('@/lib/types').InstitutionalPage = {
      id: Date.now(),
      store_id: storeId,
      title: formData.get('title') as string,
      slug: formData.get('slug') as string,
      meta: {
        content: formData.get('content') as string,
      },
      is_active: formData.get('isActive') !== 'false',
    }
    await updateSiteSettings({ institutionalPages: [...pages, newPage] } as Partial<SiteSettings>)
    revalidatePath('/', 'layout')
    return { success: true, data: newPage }
  } catch (error) {
    console.error('Error in createInstitutionalPageAction:', error)
    return { success: false, error: 'Erro ao criar página' }
  }
}

export async function updateInstitutionalPageAction(id: string, formData: FormData): Promise<ApiResponse<import('@/lib/types').InstitutionalPage>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasPagePermission('pages.edit'))) {
    return { success: false, error: 'Você não tem permissão para editar páginas' }
  }
  try {
    const settings = await getSiteSettings()
    const pages: import('@/lib/types').InstitutionalPage[] = settings.institutionalPages || []
    const numericId = Number(id)
    const existing = pages.find((page) => page.id === numericId)
    const updated: import('@/lib/types').InstitutionalPage = {
      id: Number.isFinite(numericId) ? numericId : Date.now(),
      store_id: existing?.store_id ?? 0,
      title: formData.get('title') as string,
      slug: formData.get('slug') as string,
      meta: {
        content: formData.get('content') as string,
      },
      is_active: formData.get('isActive') !== 'false',
    }
    await updateSiteSettings({ institutionalPages: pages.map(p => p.id === numericId ? updated : p) } as Partial<SiteSettings>)
    revalidatePath('/', 'layout')
    return { success: true, data: updated }
  } catch (error) {
    console.error('Error in updateInstitutionalPageAction:', error)
    return { success: false, error: 'Erro ao atualizar página' }
  }
}

export async function deleteInstitutionalPageAction(id: string): Promise<ApiResponse<null>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasPagePermission('pages.delete'))) {
    return { success: false, error: 'Você não tem permissão para excluir páginas' }
  }
  try {
    const settings = await getSiteSettings()
    const pages: import('@/lib/types').InstitutionalPage[] = settings.institutionalPages || []
    const numericId = Number(id)
    await updateSiteSettings({ institutionalPages: pages.filter(p => p.id !== numericId) } as Partial<SiteSettings>)
    revalidatePath('/', 'layout')
    return { success: true, data: null }
  } catch (error) {
    console.error('Error in deleteInstitutionalPageAction:', error)
    return { success: false, error: 'Erro ao excluir página' }
  }
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export type WebhookRecord = {
  id: string
  url: string
  events: string[]
  secret: string | null
  is_active: boolean
  created_at: string
}

export async function listWebhooksAction(): Promise<ApiResponse<WebhookRecord[]>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

  try {
    const response = await fetch(new URL('/admin/webhooks', base), {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })
    if (!response.ok) {
      return { success: false, error: await getBackendErrorMessage(response, 'Erro ao listar webhooks') }
    }
    const payload = (await response.json()) as { data: WebhookRecord[] }
    return { success: true, data: Array.isArray(payload.data) ? payload.data : [] }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao listar webhooks') }
  }
}

export async function createWebhookAction(
  url: string,
  events: string[],
  secret?: string,
): Promise<ApiResponse<WebhookRecord>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

  try {
    const response = await fetch(new URL('/admin/webhooks', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ url, events, secret: secret || undefined, is_active: true }),
    })
    if (!response.ok) {
      return { success: false, error: await getBackendErrorMessage(response, 'Erro ao criar webhook') }
    }
    const webhook = (await response.json()) as WebhookRecord
    return { success: true, data: webhook }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao criar webhook') }
  }
}

export async function updateWebhookAction(
  webhookId: string,
  fields: { url?: string; events?: string[]; secret?: string; is_active?: boolean },
): Promise<ApiResponse<WebhookRecord>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

  try {
    const response = await fetch(new URL(`/admin/webhooks/${webhookId}`, base), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(fields),
    })
    if (!response.ok) {
      return { success: false, error: await getBackendErrorMessage(response, 'Erro ao atualizar webhook') }
    }
    const webhook = (await response.json()) as WebhookRecord
    return { success: true, data: webhook }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao atualizar webhook') }
  }
}

export async function deleteWebhookAction(webhookId: string): Promise<ApiResponse<null>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }
  if (!(await hasSettingsEditPermission())) {
    return { success: false, error: 'Você não tem permissão para editar configurações' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

  try {
    const response = await fetch(new URL(`/admin/webhooks/${webhookId}`, base), {
      method: 'DELETE',
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })
    if (!response.ok) {
      return { success: false, error: await getBackendErrorMessage(response, 'Erro ao remover webhook') }
    }
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao remover webhook') }
  }
}

// ─── Webhook Logs ─────────────────────────────────────────────────────────────

export type WebhookLogRecord = {
  id: string
  webhook_id: string
  event: string
  url: string
  response_status: number | null
  response_body: string | null
  duration_ms: number | null
  success: boolean
  error_message: string | null
  created_at: string
}

export async function listWebhookLogsAction(
  webhookId?: string,
  limit?: number,
  event?: string,
): Promise<ApiResponse<WebhookLogRecord[]>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

  try {
    const url = new URL('/admin/webhooks/logs', base)
    if (webhookId) url.searchParams.set('webhook_id', webhookId)
    if (limit) url.searchParams.set('limit', String(limit))
    if (event) url.searchParams.set('event', event)

    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })
    if (!response.ok) {
      return { success: false, error: await getBackendErrorMessage(response, 'Erro ao listar logs') }
    }
    const payload = (await response.json()) as { data: WebhookLogRecord[] }
    return { success: true, data: Array.isArray(payload.data) ? payload.data : [] }
  } catch (error) {
    return { success: false, error: getThrownErrorMessage(error, 'Erro ao listar logs') }
  }
}
