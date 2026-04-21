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
  User,
} from '@/lib/types'
import {
  appendStoreScopeParam,
  resolveStorefrontApiKeyFromRequest,
  withStorefrontScopeHeaders,
} from '@/lib/actions/storefront-scope'

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
  stockMode: 'FANTASY' | 'BINARY' | 'REAL' | 'INFINITO'
  variantMaxQty: number
  pendingCustomerMessage: string
  priceVisibilityMode: 'LOGIN_REQUIRED' | 'PUBLIC'
  sellerCanApproveCustomers: boolean
  sellerCanEditPriceTable: boolean
  sellerCanCreateOrders: boolean
  paymentTerms: PaymentMethod[]
  sign_wholesale: SiteSettings['sign_wholesale']
}

type ThemeSettingsMeta = SiteCustomization
type PaymentSettingsMeta = PaymentSettings

type PaymentMethodOption = {
  value: PaymentMethod
  label: string
}

const DEFAULT_PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'FATURADO', label: 'Faturado' },
  { value: 'CARTAO_EXTERNO', label: 'Cartão (externo)' },
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

const PAYMENT_METHOD_CODES: PaymentMethod[] = ['PIX', 'BOLETO', 'FATURADO', 'CARTAO_EXTERNO']

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
  return {
    fields: [
      { id: 'name', label: 'Nome Completo', type: 'TEXT', enabled: true, required: true, order: 1, isDefault: true },
      { id: 'email', label: 'E-mail', type: 'EMAIL', enabled: true, required: true, order: 2, isDefault: true },
      { id: 'phone', label: 'Telefone / WhatsApp', type: 'PHONE', enabled: true, required: true, order: 3, isDefault: true },
      { id: 'cnpj', label: 'CNPJ', type: 'CNPJ', enabled: true, required: true, order: 4, isDefault: true },
      { id: 'companyName', label: 'Razao Social', type: 'TEXT', enabled: true, required: true, order: 5, isDefault: true },
      { id: 'stateRegistration', label: 'Inscricao Estadual', type: 'TEXT', enabled: true, required: false, order: 6, isDefault: true },
      { id: 'segment', label: 'Segmento de Atuacao', type: 'TEXT', enabled: true, required: false, order: 7, isDefault: true },
      { id: 'address', label: 'Endereco Completo', type: 'LONG_TEXT', enabled: true, required: true, order: 8, isDefault: true },
    ],
    autoApproval: {
      enabled: true,
      mode: 'CNAE',
      validateCnpjOnReceita: true,
      allowedCnaes: [],
    },
    sellerAssignment: {
      enabled: true,
      mode: 'ROUND_ROBIN',
      sellerIds: [],
      fallbackSellerId: null,
    },
  }
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
            type === 'LONG_TEXT' || type === 'URL' || type === 'SELECT' || type === 'UPLOAD'
              ? type
              : null

          const id = typeof field.id === 'string' ? field.id : null
          const label = typeof field.label === 'string' ? field.label : null
          if (!id || !label || !normalizedType) return null

          return {
            id,
            label,
            type: normalizedType,
            enabled: typeof field.enabled === 'boolean' ? field.enabled : true,
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
    fields: fields.length > 0 ? fields.sort((left, right) => left.order - right.order) : fallbackFields,
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
    showEstimatedDelivery: true,
    freeShippingEnabled: false,
    freeShippingMinValue: 0,
    freeShippingRegions: ['ALL'],
    regionalOffers: [],
    correios: {
      enabled: false,
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
  const stockMode = meta.stockMode === 'BINARY' || meta.stockMode === 'REAL' || meta.stockMode === 'FANTASY' || meta.stockMode === 'INFINITO'
    ? meta.stockMode
    : ((fallback as SiteSettings).stockMode || 'FANTASY')
  const variantMaxQty = toOptionalNumber(meta.variantMaxQty)
    ?? ((fallback as SiteSettings).variantMaxQty || 999)
  const pendingCustomerMessage = typeof meta.pendingCustomerMessage === 'string'
    ? meta.pendingCustomerMessage
    : fallback.pendingCustomerMessage
  const priceVisibilityMode = meta.priceVisibilityMode === 'PUBLIC' ? 'PUBLIC' : (meta.priceVisibilityMode === 'LOGIN_REQUIRED' ? 'LOGIN_REQUIRED' : fallback.priceVisibilityMode)
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
  const mainBannerRaw = meta.mainBanner
  const mainBannersRaw = meta.mainBanners
  const miniBannersRaw = meta.miniBanners
  const categoryBannerModeRaw = meta.categoryBannerMode
  const storefrontDisplayModeRaw =
    meta.storefrontDisplayMode
    ?? meta.storefront_display_mode
    ?? meta.vitrineDisplayMode
    ?? meta.vitrine_display_mode
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
    announcementBar,
    mainBanners,
    miniBanners,
    mainBanner,
    categoryBannerMode,
    categoryBanners,
    infoBanners,
    homeCategories,
    storefrontDisplayMode,
    logoUrl: typeof meta.logoUrl === 'string' ? meta.logoUrl : fallback.logoUrl,
    logoLightUrl: typeof meta.logoLightUrl === 'string' ? meta.logoLightUrl : fallback.logoLightUrl,
    logoDarkUrl: typeof meta.logoDarkUrl === 'string' ? meta.logoDarkUrl : fallback.logoDarkUrl,
    faviconUrl: typeof meta.faviconUrl === 'string' ? meta.faviconUrl : fallback.faviconUrl,
  }
}

function normalizePaymentSettingsMeta(meta: Record<string, unknown>, fallback: PaymentSettings): PaymentSettingsMeta {
  const mode = meta.mode === 'INTEGRATED' ? 'INTEGRATED' : (meta.mode === 'MANUAL' ? 'MANUAL' : fallback.mode)
  const provider = ['STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'NONE'].includes(String(meta.provider || ''))
    ? (meta.provider as PaymentSettings['provider'])
    : fallback.provider

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
      label: null,
    }

    return {
      discountPercent: toOptionalNumber(source.discountPercent) ?? fallbackValue.discountPercent,
      discountFixed: toOptionalNumber(source.discountFixed) ?? fallbackValue.discountFixed,
      feePercent: toOptionalNumber(source.feePercent) ?? fallbackValue.feePercent,
      minOrderValue: source.minOrderValue === null
        ? null
        : toOptionalNumber(source.minOrderValue) ?? fallbackValue.minOrderValue,
      maxOrderValue: source.maxOrderValue === null
        ? null
        : toOptionalNumber(source.maxOrderValue) ?? fallbackValue.maxOrderValue,
      label: typeof source.label === 'string' ? source.label : (source.label === null ? null : fallbackValue.label),
    }
  }

  const normalizeCustomMethods = (raw: unknown, fallbackMethods: PaymentSettings['customMethods']) => {
    const sourceList = Array.isArray(raw) ? raw : (Array.isArray(fallbackMethods) ? fallbackMethods : [])

    return sourceList
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry, index) => ({
        id: typeof entry.id === 'string' ? entry.id : `custom_${index}`,
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
          label: null,
        }),
      }))
  }

  return {
    mode,
    provider,
    manualInstructions: typeof meta.manualInstructions === 'string' ? meta.manualInstructions : fallback.manualInstructions,
    apiKey: typeof meta.apiKey === 'string' ? meta.apiKey : (meta.apiKey === null ? null : fallback.apiKey),
    secretKey: typeof meta.secretKey === 'string' ? meta.secretKey : (meta.secretKey === null ? null : fallback.secretKey),
    webhookSecret: typeof meta.webhookSecret === 'string' ? meta.webhookSecret : (meta.webhookSecret === null ? null : fallback.webhookSecret),
    enablePix: typeof meta.enablePix === 'boolean' ? meta.enablePix : fallback.enablePix,
    enableBoleto: typeof meta.enableBoleto === 'boolean' ? meta.enableBoleto : fallback.enableBoleto,
    enableCreditCard: typeof meta.enableCreditCard === 'boolean' ? meta.enableCreditCard : fallback.enableCreditCard,
    maxInstallments: Math.min(12, Math.max(1, Math.trunc(toOptionalNumber(meta.maxInstallments) ?? fallback.maxInstallments))),
    enableFaturado: typeof meta.enableFaturado === 'boolean' ? meta.enableFaturado : fallback.enableFaturado,
    faturadoMinOrderValue: meta.faturadoMinOrderValue === null
      ? null
      : toOptionalNumber(meta.faturadoMinOrderValue) ?? fallback.faturadoMinOrderValue,
    faturadoMaxDays: toOptionalNumber(meta.faturadoMaxDays) ?? fallback.faturadoMaxDays,
    pixConditions: normalizeConditions(meta.pixConditions, fallback.pixConditions),
    boletoConditions: normalizeConditions(meta.boletoConditions, fallback.boletoConditions),
    creditCardConditions: normalizeConditions(meta.creditCardConditions, fallback.creditCardConditions),
    faturadoConditions: normalizeConditions(meta.faturadoConditions, fallback.faturadoConditions),
    customMethods: normalizeCustomMethods(meta.customMethods, fallback.customMethods),
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
            customMethods: customMethodsWithName,
          },
          options: customMethodsWithName.map((method, index) => ({
            name: method.name.trim(),
            estimated_days: Math.max(0, Math.trunc(method.maxDays || method.minDays || 0)),
            price_cents: method.pricingType === 'FREE'
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

  try {
    const response = await fetch(new URL('/payment-config', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        store_id: storeId,
        ...meta,
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
      socialLinks: {
        ...DEFAULT_STORE_SOCIAL_LINKS,
        ...socialLinks,
      },
    },
  }
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
        phone: phone || null,
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
export async function getSiteSettingsAction(storeId?: number | string | null): Promise<ApiResponse<SiteSettings>> {
  try {
    const settings = await getSiteSettings()

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
      paymentResult,
      marketingResult,
    ] = await Promise.all([
      getFixedShippingOptionsFromBackend(base, cookieHeader, storeId),
      getB2BSettingsMetaFromBackend(base, cookieHeader, storeId),
      getStockSettingsMetaFromBackend(base, cookieHeader, storeId),
      getShippingSettingsMetaFromBackend(base, cookieHeader, storeId),
      getThemeSettingsMetaFromBackend(base, cookieHeader, storeId),
      getPaymentSettingsMetaFromBackend(base, cookieHeader, storeId),
      getMarketingSettingsMetaFromBackend(base, cookieHeader, storeId),
    ])

    if (shippingResult.success && shippingResult.data) {
      settings.shippingOptions = shippingResult.data
    }

    if (b2bResult.success && b2bResult.data) {
      const b2bMeta = normalizeB2BMeta(b2bResult.data, settings)
      settings.requireCnpj = b2bMeta.requireCnpj
      settings.defaultMinPieces = b2bMeta.defaultMinPieces
      settings.minOrderValue = b2bMeta.minOrderValue
      settings.maxInstallmentsText = b2bMeta.maxInstallmentsText
      settings.stockMode = b2bMeta.stockMode
      settings.variantMaxQty = b2bMeta.variantMaxQty
      settings.pendingCustomerMessage = b2bMeta.pendingCustomerMessage
      settings.priceVisibilityMode = b2bMeta.priceVisibilityMode
      settings.sellerCanApproveCustomers = b2bMeta.sellerCanApproveCustomers
      settings.sellerCanEditPriceTable = b2bMeta.sellerCanEditPriceTable
      settings.sellerCanCreateOrders = b2bMeta.sellerCanCreateOrders
      settings.b2bPaymentTerms = b2bMeta.paymentTerms
      settings.sign_wholesale = b2bMeta.sign_wholesale
    }

    // Stock section overrides b2b values for stockMode/variantMaxQty when present.
    if (stockResult.success && stockResult.data && Object.keys(stockResult.data).length > 0) {
      const sm = stockResult.data
      if (sm.stockMode === 'BINARY' || sm.stockMode === 'REAL' || sm.stockMode === 'FANTASY' || sm.stockMode === 'INFINITO') {
        settings.stockMode = sm.stockMode as SiteSettings['stockMode']
      }
      if (typeof sm.variantMaxQty === 'number' && Number.isFinite(sm.variantMaxQty)) {
        settings.variantMaxQty = sm.variantMaxQty
      }
    }

    if (shippingResult2.success && shippingResult2.data && Object.keys(shippingResult2.data).length > 0) {
      settings.shippingSettings = normalizeShippingSettingsMeta(shippingResult2.data, settings)
    } else {
      settings.shippingSettings = getDefaultShippingSettings(settings)
    }

    if (themeResult.success && themeResult.data) {
      settings.customization = normalizeThemeMeta(themeResult.data, settings.customization)
    }

    if (paymentResult.success && paymentResult.data) {
      settings.paymentSettings = normalizePaymentSettingsMeta(paymentResult.data, settings.paymentSettings)
    }

    if (marketingResult.success && marketingResult.data && Object.keys(marketingResult.data).length > 0) {
      settings.marketingSettings = marketingResult.data as unknown as MarketingSettings
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
  provider: 'NONE',
  manualInstructions: '',
  apiKey: null,
  secretKey: null,
  webhookSecret: null,
  enablePix: true,
  enableBoleto: true,
  enableCreditCard: true,
  maxInstallments: 12,
  enableFaturado: true,
  faturadoMinOrderValue: null,
  faturadoMaxDays: 30,
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
        data: buildPaymentMethodOptionsFromSettings(DEFAULT_PAYMENT_SETTINGS),
      }
    }

    const cookieHeader = await buildAdminCookieHeader()
    const paymentResult = await getPaymentSettingsMetaFromBackend(base, cookieHeader)

    const paymentSettings = paymentResult.success && paymentResult.data
      ? normalizePaymentSettingsMeta(paymentResult.data, DEFAULT_PAYMENT_SETTINGS)
      : DEFAULT_PAYMENT_SETTINGS

    return {
      success: true,
      data: buildPaymentMethodOptionsFromSettings(paymentSettings),
    }
  } catch (error) {
    return {
      success: true,
      data: DEFAULT_PAYMENT_METHOD_OPTIONS,
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

  if (paymentSettings.enableCreditCard) {
    methods.push({ value: 'CARTAO_EXTERNO', label: 'Cartão (externo)' })
  }

  return methods.length > 0 ? methods : DEFAULT_PAYMENT_METHOD_OPTIONS
}

export async function updateSiteSettingsAction(formData: FormData): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
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
    const base = process.env.NEXT_PUBLIC_RUST_URL
    const cookieHeader = await buildAdminCookieHeader()

    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    if (!cookieHeader) return { success: false, error: 'Não autenticado' }

    const stockPayload = {
      stockMode: data.stockMode === 'BINARY' || data.stockMode === 'REAL' || data.stockMode === 'FANTASY' || data.stockMode === 'INFINITO'
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
  const actorUserId = session?.id || 'store-session'

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieHeader = await buildAdminCookieHeader()
  if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  if (!cookieHeader) return { success: false, error: 'Não autenticado' }

  const currentSettings = await getSiteSettings()

  const rawStockMode = formData.get('stockMode') as string
  const stockPayload = {
    stockMode: rawStockMode === 'BINARY' || rawStockMode === 'REAL' || rawStockMode === 'FANTASY' || rawStockMode === 'INFINITO'
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
  const actorUserId = session?.id || 'store-session'

  const currentSettings = await getSiteSettings()
  
  const rawCategoryBannerMode = formData.get('categoryBannerMode')
  const categoryBannerMode: SiteCustomization['categoryBannerMode'] =
    rawCategoryBannerMode === 'auto' || rawCategoryBannerMode === 'disabled' || rawCategoryBannerMode === 'custom'
      ? rawCategoryBannerMode
      : currentSettings.customization.categoryBannerMode
  const rawFontFamily = formData.get('fontFamily')
  const fontFamily: SiteCustomization['fontFamily'] =
    rawFontFamily === 'SYSTEM'
    || rawFontFamily === 'INTER'
    || rawFontFamily === 'POPPINS'
    || rawFontFamily === 'MONTSERRAT'
    || rawFontFamily === 'ZEN_KAKU_GOTHIC_NEW'
      ? rawFontFamily
      : (currentSettings.customization.fontFamily || 'SYSTEM')

  const customization: SiteCustomization = {
    primaryColor: currentSettings.customization.primaryColor,
    secondaryColor: currentSettings.customization.secondaryColor,
    accentColor: formData.get('accentColor') as string || currentSettings.customization.accentColor,
    backgroundColor: formData.get('backgroundColor') as string || currentSettings.customization.backgroundColor,
    textColor: formData.get('textColor') as string || currentSettings.customization.textColor,
    buttonColor: formData.get('buttonColor') as string || currentSettings.customization.buttonColor,
    buttonTextColor: formData.get('buttonTextColor') as string || currentSettings.customization.buttonTextColor,
    fontFamily,
    forceUppercaseText: formData.has('forceUppercaseText')
      ? formData.get('forceUppercaseText') === 'true'
      : currentSettings.customization.forceUppercaseText,
    announcementBar: formData.has('announcementBar') ? JSON.parse(formData.get('announcementBar') as string) : currentSettings.customization.announcementBar,
    mainBanners: formData.has('mainBanners')
      ? JSON.parse(formData.get('mainBanners') as string)
      : (currentSettings.customization.mainBanners?.length
          ? currentSettings.customization.mainBanners
          : (currentSettings.customization.mainBanner ? [currentSettings.customization.mainBanner] : [])),
    miniBanners: formData.has('miniBanners')
      ? JSON.parse(formData.get('miniBanners') as string)
      : (Array.isArray(currentSettings.customization.miniBanners)
          ? currentSettings.customization.miniBanners
          : []),
    mainBanner: formData.has('mainBanner')
      ? JSON.parse(formData.get('mainBanner') as string)
      : (currentSettings.customization.mainBanners?.[0] || currentSettings.customization.mainBanner),
    categoryBannerMode,
    categoryBanners: formData.has('categoryBanners') ? JSON.parse(formData.get('categoryBanners') as string) : currentSettings.customization.categoryBanners,
    infoBanners: formData.has('infoBanners') ? JSON.parse(formData.get('infoBanners') as string) : currentSettings.customization.infoBanners,
    homeCategories: formData.has('homeCategories') ? JSON.parse(formData.get('homeCategories') as string) : (currentSettings.customization.homeCategories || []),
    storefrontDisplayMode: (formData.get('storefrontDisplayMode') as "products" | "imageLevels") || currentSettings.customization.storefrontDisplayMode,
    logoUrl: formData.get('logoUrl') as string || currentSettings.customization.logoUrl,
    logoLightUrl: formData.get('logoLightUrl') as string || currentSettings.customization.logoLightUrl,
    logoDarkUrl: formData.get('logoDarkUrl') as string || currentSettings.customization.logoDarkUrl,
    faviconUrl: formData.get('faviconUrl') as string || currentSettings.customization.faviconUrl,
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieHeader = await buildAdminCookieHeader()

  if (base && cookieHeader) {
    const saveThemeResult = await saveThemeSettingsMetaToBackend(base, cookieHeader, customization, actorUserId)
    if (!saveThemeResult.success) {
      return { success: false, error: saveThemeResult.error || 'Erro ao salvar configuração de tema' }
    }
  }

  const updated = await updateSiteSettings({ customization })

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
  const actorUserId = session?.id || 'store-session'

  const currentSettings = await getSiteSettings()

  const modeValue = getFormString(formData, 'mode')
  const providerValue = getFormString(formData, 'provider')
  const manualInstructionsValue = getFormString(formData, 'manualInstructions')
  const apiKeyValue = getFormString(formData, 'apiKey')
  const secretKeyValue = getFormString(formData, 'secretKey')
  const webhookSecretValue = getFormString(formData, 'webhookSecret')
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
  
  const paymentSettings = {
    mode: modeValue as 'MANUAL' | 'INTEGRATED' || currentSettings.paymentSettings.mode,
    provider: providerValue as 'STRIPE' | 'MERCADO_PAGO' | 'PAGSEGURO' | 'ASAAS' | 'NONE' || currentSettings.paymentSettings.provider,
    manualInstructions: manualInstructionsValue || currentSettings.paymentSettings.manualInstructions,
    apiKey: apiKeyValue || currentSettings.paymentSettings.apiKey,
    secretKey: secretKeyValue || currentSettings.paymentSettings.secretKey,
    webhookSecret: webhookSecretValue || currentSettings.paymentSettings.webhookSecret,
    enablePix: hasFormField(formData, 'enablePix') ? enablePixValue === 'true' : currentSettings.paymentSettings.enablePix,
    enableBoleto: hasFormField(formData, 'enableBoleto') ? enableBoletoValue === 'true' : currentSettings.paymentSettings.enableBoleto,
    enableCreditCard: hasFormField(formData, 'enableCreditCard') ? enableCreditCardValue === 'true' : currentSettings.paymentSettings.enableCreditCard,
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
  const actorUserId = session?.id || 'store-session'

  const currentSettings = await getSiteSettings()
  
  const customDomain = formData.get('customDomain') as string || null
  
  // Generate verification token if new domain
  let domainVerificationToken = currentSettings.domainSettings?.domainVerificationToken
  if (customDomain && customDomain !== currentSettings.domainSettings?.customDomain) {
    domainVerificationToken = `v0-verify-${Math.random().toString(36).substring(2, 15)}`
  }
  
  const domainSettings = {
    customDomain: customDomain || null,
    domainStatus: customDomain ? 'VERIFYING' as const : 'PENDING' as const,
    domainVerificationToken,
    sslEnabled: formData.get('sslEnabled') === 'true',
    wwwRedirect: formData.get('wwwRedirect') === 'true',
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
  
  return { success: true, data: updated }
}

// Marketing Settings
export async function updateMarketingSettingsAction(marketingSettings: MarketingSettings): Promise<ApiResponse<SiteSettings>> {
  const session = await getSession()
  const authCookieHeader = await buildAdminCookieHeader()
  if (!isSettingsAuthorized(session, authCookieHeader)) {
    return { success: false, error: 'Não autorizado' }
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
    return { success: false, error: validation.error.errors[0].message }
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
    return { success: false, error: validation.error.errors[0].message }
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
    return { success: false, error: validation.error.errors[0].message }
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
    return { success: false, error: validation.error.errors[0].message }
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
  return {
    id: String(admin.id),
    name: admin.name,
    email: admin.email,
    phone: admin.phone ?? null,
    passwordHash: '',
    role: 'ADMIN',
    roleId: admin.role_id != null ? String(admin.role_id) : null,
    isActive: Boolean(admin.active),
    createdAt: new Date(admin.created_at),
    updatedAt: new Date(admin.updated_at),
  }
}

export async function createUserAction(formData: FormData): Promise<ApiResponse<User>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const name = getActionFormValue(formData, 'name') || ''
  const email = getActionFormValue(formData, 'email') || ''
  const phone = getActionFormValue(formData, 'phone') || ''
  const password = getActionFormValue(formData, 'password') || ''
  const roleIdRaw = getActionFormValue(formData, 'roleId')

  if (!name || !email || !phone || !password) {
    return { success: false, error: 'Dados incompletos' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)

  const payload = {
    name,
    email,
    phone,
    password,
    role_id: roleIdRaw && roleIdRaw.trim().length > 0 ? Number(roleIdRaw) : null,
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

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const name = getActionFormValue(formData, 'name') || ''
  const email = getActionFormValue(formData, 'email') || ''
  const phone = getActionFormValue(formData, 'phone') || undefined
  const roleIdRaw = getActionFormValue(formData, 'roleId')
  const password = getActionFormValue(formData, 'password')

  const payload: Record<string, unknown> = {
    name,
    email,
    ...(phone ? { phone } : {}),
    role_id: roleIdRaw && roleIdRaw.trim().length > 0 ? Number(roleIdRaw) : null,
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

export async function getUsersAction(filters?: { role?: string; isActive?: boolean }): Promise<ApiResponse<User[]>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)
  const usersUrl = new URL('/admin/users', base)
  usersUrl.searchParams.set('perPage', '200')
  if (storeId) {
    usersUrl.searchParams.set('store_id', String(storeId))
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
  let users: User[] = Array.isArray(payload?.items) ? payload.items.map(mapAdminToUser) : []

  if (filters?.role) {
    users = users.filter((user) => user.role === filters.role)
  }
  if (filters?.isActive !== undefined) {
    users = users.filter((user) => user.isActive === filters.isActive)
  }

  return { success: true, data: users }
}

export async function toggleUserActiveAction(id: string): Promise<ApiResponse<User>> {
  const session = await getSession()
  const cookieHeader = await buildAdminCookieHeader()
  if (!isUsersAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
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
    return { success: false, error: validation.error.errors[0].message }
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
