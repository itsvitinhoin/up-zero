// ==================== ENUMS ====================

export type UserRole = 'ADMIN' | 'SALES_MANAGER' | 'SELLER' | 'B2B_CUSTOMER' | 'PENDING'

export type CustomerStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type CustomerType = 'RETAIL' | 'WHOLESALE'

export type PriceTableType = 'PERCENTAGE' | 'OVERRIDE'

export type CouponType = 'percentage' | 'fixed'
export type DiscountRuleType = 'coupon' | 'automatic' | 'payment_method'
export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping'
export type DiscountPriority = 'low' | 'medium' | 'high'
export type DiscountTargetType = 'product' | 'category' | 'collection' | 'brand' | 'tag'

export interface DiscountTarget {
  type: DiscountTargetType
  id: string
  name: string
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'INVOICED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export type PaymentMethod = 'PIX' | 'BOLETO' | 'FATURADO' | 'CARTAO_EXTERNO'

export type PriceVisibilityMode = 'LOGIN_REQUIRED' | 'PUBLIC'

export type StockMode = 'FANTASY' | 'BINARY' | 'REAL' | 'INFINITO'

export type SignWholesaleFieldType = 'TEXT' | 'EMAIL' | 'PHONE' | 'CNPJ' | 'LONG_TEXT' | 'URL' | 'SELECT' | 'UPLOAD'

export interface SignWholesaleField {
  id: string
  label: string
  type: SignWholesaleFieldType
  enabled: boolean
  required: boolean
  order: number
  isDefault: boolean
  helpText?: string
}

export interface SignWholesaleAutoApproval {
  enabled: boolean
  mode: 'CNAE' | 'MANUAL'
  validateCnpjOnReceita: boolean
  allowedCnaes: string[]
}

export interface SignWholesaleSellerAssignment {
  enabled: boolean
  mode: 'ROUND_ROBIN' | 'MANUAL'
  sellerIds: string[]
  fallbackSellerId: string | null
}

export interface SignWholesaleSettings {
  fields: SignWholesaleField[]
  autoApproval: SignWholesaleAutoApproval
  sellerAssignment?: SignWholesaleSellerAssignment
}

export interface CustomerCustomField {
  id: string
  label: string
  type?: SignWholesaleFieldType | string
  value: unknown
}

// ==================== MODELS ====================

export interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  passwordHash: string
  role: UserRole
  roleId?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SellerProfile {
  id: string
  userId: string
  phone: string
  createdAt: Date
}

export interface Customer {
  id: string
  userId: string
  customerType?: CustomerType
  companyName: string
  tradeName: string
  cnpj: string
  stateRegistration: string | null
  contactName: string
  phone: string
  email: string
  // Address
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  // Business
  segment: string | null
  status: CustomerStatus
  priceTableId: string | null
  minPiecesOverride: number | null
  extraDiscountPct: number | null
  paymentTerms: PaymentMethod[]
  assignedSellerId: string | null
  assignedSellerName?: string | null
  // Classification
  cnae?: string | null
  cnaeDescription?: string | null
  registrationOrigin?: string | null
  // Branch data binding — storefront where this customer registered
  branchId?: string | null
  branchSlug?: string | null
  // ReceitaWS integration
  receitawsMeta?: {
    consultedAt: string
    data: Record<string, unknown>
  } | null
  customFields?: CustomerCustomField[]
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parentId?: string | null
  imageUrl?: string | null
  isActive?: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt: Date | string
  updatedAt?: Date | string
}

export interface Product {
  id: string
  name: string
  slug: string
  sku: string
  description: string | null
  materials: string | null
  measures: string | null
  basePrice: number
  cost: number | null
  isActive: boolean
  isFeatured: boolean
  categoryId: string
  categoryIds?: string[]
  tags: string[]
  images: string[]
  sizes: string[]
  sizeSortOrders?: Record<string, number>
  colors: ProductColor[]
  variants?: ProductVariant[]
  createdAt: Date
  updatedAt: Date
}

export interface ProductColor {
  id?: string
  variantId?: string
  name: string
  hex: string
  images?: string[]
  swatchImageUrl?: string
  attributeValueId?: number
  price?: number
  variantSku?: string
  sortOrder?: number
}

export interface ProductVariant {
  id: string
  productId: string
  color: string
  size: string
  variantSku: string
  isHighlighted?: boolean
  attribute_value_hexa?: string | null
  stock: number
  priceOverride: number | null
  createdAt: Date
}

export interface AssetSkuGroup {
  sku: string
  productVariantId?: number | null
  combinationKey: string | null
  attributeValueIds: number[]
  images: string[]
}

export interface AssetMeta {
  disabledVariantGroups?: string[]
  highlightedVariantGroups?: string[]
}

export interface AssetImageGroupingRule {
  type: 'product' | 'attributes' | 'full_sku'
  attribute_ids?: number[]
}

export interface Asset {
  id: string
  productId: string
  slug?: string
  productName?: string
  code: string
  title: string | null
  categoryIds?: string[]
  meta?: AssetMeta
  imageGroupingRule?: AssetImageGroupingRule
  skuGroups: AssetSkuGroup[]
  createdAt: Date | string
}

export interface PriceTable {
  id: string
  name: string
  type: PriceTableType
  percentage: number | null
  isDefault: boolean
  isActive: boolean
  createdAt: Date
}

export interface PriceTableItem {
  id: string
  priceTableId: string
  productId: string
  overridePrice: number
}

export interface Coupon {
  id: string
  name?: string
  code: string
  type: CouponType
  ruleType?: DiscountRuleType
  discountType?: DiscountType
  valueCents: number
  startsAt: Date
  endsAt: Date
  maxUses: number | null
  currentUses: number
  minOrderValueCents: number | null
  minItemsQuantity?: number | null
  firstPurchaseOnly?: boolean
  firstPurchaseMinOrderValueCents?: number | null
  firstPurchaseMinItemsQuantity?: number | null
  maxUsesPerCustomer?: number | null
  canStack?: boolean
  priority?: DiscountPriority
  paymentMethod?: string | null
  applyToAllProducts?: boolean
  includeTargets?: DiscountTarget[]
  excludeTargets?: DiscountTarget[]
  excludePromotionalProducts?: boolean
  excludeDiscountedProducts?: boolean
  scope: CouponScope
  isActive: boolean
  createdAt: Date
  updatedAt?: Date
}

export interface CouponScope {
  type: 'ALL' | 'CATEGORY' | 'PRODUCTS'
  categoryIds?: string[]
  productIds?: string[]
}

export interface TierDiscount {
  id: string
  minPieces: number
  discountPct: number
  isActive: boolean
  createdAt: Date
}

export interface CartItem {
  id: string
  productId: string
  variantId: string
  quantity: number
  product?: Product
  variant?: ProductVariant
}

export interface Cart {
  items: CartItem[]
  couponCode: string | null
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED'

export interface Order {
  id: string
  customerId: string
  createdByUserId: string
  createdBySellerId: string | null
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotal: number
  couponDiscount?: number
  tierDiscount?: number
  discountTotal: number
  manualDiscount: number
  total: number
  fulfilledTotal: number
  totalItems?: number
  fulfilledItems?: number
  shippingName: string | null
  shippingPrice: number
  paymentMethod: PaymentMethod | null
  notes: string | null
  internalNotes: string | null
  trackingCode: string | null
  trackingUrl: string | null
  // Shipping address snapshot
  shippingStreet: string
  shippingNumber: string
  shippingComplement: string | null
  shippingNeighborhood: string
  shippingCity: string
  shippingState: string
  shippingZipCode: string
  // Branch data binding — origin storefront of this order
  branchId?: string | null
  branchSlug?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  variantId: string | null
  assetId?: string | null
  assetName?: string | null
  assetImageUrl?: string | null
  imageUrl?: string | null
  nameSnapshot: string
  skuSnapshot: string
  variantCombinationKey?: string | null
  colorSnapshot: string | null
  sizeSnapshot: string | null
  qty: number
  originalQty?: number
  unitPrice: number
  total: number
  fulfilled: boolean
  variantStockQty?: number
  variantReservedQty?: number
  variantAvailableQty?: number
  status?: 'active' | 'attended' | 'removed'
  origin?: 'customer' | 'manager_added' | 'replacement' | 'gift'
}

export type OrderInvoiceStatus = 'PENDING' | 'PROCESSING' | 'AUTHORIZED' | 'REJECTED' | 'CANCELLED' | 'ERROR'

export interface OrderInvoice {
  id: string
  storeId: string
  orderId: string
  status: OrderInvoiceStatus
  payload: Record<string, unknown>
  meta: Record<string, unknown>
  nfNumber: string | null
  pdfUrl: string | null
  xmlUrl: string | null
  accessKey: string | null
  integrationName: string | null
  integrationReferenceId: string | null
  errorMessage: string | null
  issuedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type OrderLabelStatus = 'ISSUED' | 'ERROR'

export interface OrderLabel {
  id: string
  storeId: string
  orderId: string
  status: OrderLabelStatus
  trackingCode: string | null
  carrier: string | null
  pdfUrl: string | null
  integrationName: string | null
  integrationReferenceId: string | null
  errorMessage: string | null
  issuedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ShippingOption {
  id: string
  name: string
  estimatedDays: number
  price: number
}

export type RegionalOfferType = 'FREE' | 'FIXED' | 'DISCOUNT_PERCENT'
export type RegionalScopeType = 'STATE' | 'CITY' | 'CEP_RANGE'
export type CorreiosService = 'SEDEX' | 'SEDEX_10' | 'SEDEX_12' | 'SEDEX_HOJE' | 'PAC' | 'PAC_MINI'

export interface RegionalShippingOffer {
  id: string
  name: string
  isActive: boolean
  deliveryDays?: number
  offerType: RegionalOfferType
  fixedPrice: number
  discountPercent: number
  minOrderValue: number | null
  scopeType: RegionalScopeType
  states: string[]
  cities: string[]
  cepStart: string | null
  cepEnd: string | null
  applyToMethodIds: string[] | null
  sortOrder: number
}

export interface PickupScheduleConfig {
  enabled: boolean
  prepMinHours: number
  slotDurationMinutes: number
  maxDaysAhead: number
  availableDays: number[]
  openTime: string
  closeTime: string
  lunchBreakStart: string | null
  lunchBreakEnd: string | null
  maxSimultaneous: number | null
}

export interface CustomShippingMethod {
  id: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  isPickup: boolean
  pickupAddress: string | null
  pickupSchedule: PickupScheduleConfig | null
  pricingType: 'FIXED' | 'BY_WEIGHT' | 'BY_VALUE' | 'BY_REGION' | 'FREE'
  fixedPrice: number | null
  freeAboveValue: number | null
  minDays: number
  maxDays: number
  minOrderValue: number | null
  maxOrderValue: number | null
  maxWeight: number | null
  regions: string[]
}

export interface DefaultPackageConfig {
  weight: number
  lengthCm: number
  widthCm: number
  heightCm: number
  largeItemThresholdGrams: number
  largeItemWeight: number
  largeItemLengthCm: number
  largeItemWidthCm: number
  largeItemHeightCm: number
}

export interface CorreiosConfig {
  enabled: boolean
  contractCode: string | null
  contractPassword: string | null
  originCep: string
  enabledServices: CorreiosService[]
  markupPercent: number
  markupFixed: number
  additionalDays: number
  declareValue: boolean
}

export interface ShippingSettings {
  defaultPackage: DefaultPackageConfig
  defaultOriginCep: string
  defaultPackageWeight: number
  showEstimatedDelivery: boolean
  freeShippingEnabled: boolean
  freeShippingMinValue: number
  freeShippingRegions: string[]
  regionalOffers: RegionalShippingOffer[]
  correios: CorreiosConfig
  customMethods: CustomShippingMethod[]
}

export type StoreFontFamily = 'SYSTEM' | 'INTER' | 'POPPINS' | 'MONTSERRAT' | 'ZEN_KAKU_GOTHIC_NEW'

export interface SiteCustomization {
  // Colors
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  // Typography
  fontFamily: StoreFontFamily
  forceUppercaseText: boolean
  storefrontDisplayMode?: 'products' | 'imageLevels'
  // Announcement bar
  announcementBar: AnnouncementBarConfig
  // Banners
  mainBanners: BannerConfig[]
  miniBanners?: BannerConfig[]
  mainBanner: BannerConfig | null
  categoryBannerMode: 'auto' | 'custom' | 'disabled'
  categoryBanners: CategoryBannerConfig[]
  infoBanners: InfoBannersConfig
  homeCategories: HomeCategoryConfig[]
  // Logo
  logoUrl: string | null
  logoLightUrl: string | null
  logoDarkUrl: string | null
  faviconUrl: string | null
}

export interface AnnouncementBarConfig {
  enabled: boolean
  items: string[]
  separator: string
  backgroundColor: string
  textColor: string
  isAnimated: boolean
  animationSpeed: 'SLOW' | 'NORMAL' | 'FAST'
}

export interface BannerConfig {
  imageUrl: string
  mobileImageUrl: string | null
  altText: string
  linkUrl: string | null
  isActive: boolean
  useMobileImage: boolean
}

export interface CategoryBannerConfig {
  categoryId: string
  imageUrl: string
  altText: string
  isActive: boolean
  mode: 'auto' | 'custom'
}

export interface HomeCategoryConfig {
  categoryId: string
  title?: string
  isActive: boolean
}

export interface InfoBannerConfig {
  isActive: boolean
  icon: 'package' | 'truck' | 'credit-card' | 'users' | 'clock' | 'shield' | 'star' | 'heart'
  title: string
  description: string
}

export interface InfoBannersConfig {
  pedidoMinimo: InfoBannerConfig
  entrega: InfoBannerConfig
  pagamento: InfoBannerConfig
  atendimento: InfoBannerConfig
}

export type PaymentMode = 'MANUAL' | 'INTEGRATED'

export type PaymentProvider = 'STRIPE' | 'MERCADO_PAGO' | 'PAGSEGURO' | 'ASAAS' | 'NONE'

export interface PaymentMethodConditions {
  discountPercent?: number
  discountFixed?: number
  feePercent?: number
  minOrderValue?: number | null
  maxOrderValue?: number | null
  label?: string | null
}

export interface CustomPaymentMethod {
  id: string
  title: string
  description: string
  icon: string | null
  isActive: boolean
  sortOrder: number
  conditions: PaymentMethodConditions
}

export interface PaymentSettings {
  mode: PaymentMode
  provider: PaymentProvider
  // For manual mode
  manualInstructions: string
  // API Keys (only provider-specific)
  apiKey: string | null
  secretKey: string | null
  webhookSecret: string | null
  // Enabled methods
  enablePix: boolean
  enableBoleto: boolean
  enableCreditCard: boolean
  maxInstallments: number
  enableFaturado: boolean
  // Faturado specific
  faturadoMinOrderValue: number | null
  faturadoMaxDays: number
  // Advanced conditions
  pixConditions?: PaymentMethodConditions
  boletoConditions?: PaymentMethodConditions
  creditCardConditions?: PaymentMethodConditions
  faturadoConditions?: PaymentMethodConditions
  customMethods?: CustomPaymentMethod[]
}

export interface MarketingIntegration {
  enabled: boolean
  id: string | null
}

export interface MarketingSettings {
  // Meta (Facebook/Instagram)
  metaPixel: MarketingIntegration & {
    accessToken: string | null
    testEventCode: string | null
  }
  // Google
  googleAnalytics: MarketingIntegration & {
    measurementId: string | null
  }
  googleAds: MarketingIntegration & {
    conversionId: string | null
    conversionLabel: string | null
  }
  googleMerchant: MarketingIntegration & {
    merchantId: string | null
  }
  googleTagManager: MarketingIntegration
  // Other platforms
  pinterestTag: MarketingIntegration
  tiktokPixel: MarketingIntegration & {
    accessToken: string | null
  }
  snapchatPixel: MarketingIntegration
  // Hotjar/Clarity
  hotjar: MarketingIntegration
  microsoftClarity: MarketingIntegration
}

export type DomainStatus = 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'ERROR'

export interface DomainSettings {
  customDomain: string | null
  domainStatus: DomainStatus
  domainVerificationToken: string | null
  sslEnabled: boolean
  wwwRedirect: boolean
}

export interface MenuItem {
  id: string
  parentId?: string | null
  label: string
  type: 'category' | 'page' | 'external'
  href: string
  categoryId?: string
  pageId?: string
  order: number
  isActive: boolean
}

export interface InstitutionalPage {
  id: number
  store_id: number
  title: string
  slug: string
  meta: any
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// ─── Billing / Plans ────────────────────────────────────────────────────────

export type BillingPlanId = 'plan_starter' | 'plan_profissional' | 'plan_avancado' | 'plan_multiloja'
export type BillingCycle = 'MONTHLY' | 'YEARLY'
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'TRIAL' | 'PAST_DUE'
export type InvoiceStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED'
export type BillingPaymentMethodType = 'CREDIT_CARD' | 'PIX' | 'BOLETO'

export interface BillingPlanLimits {
  products: number
  users: number
  orders: number
  storage: number
}

export interface BillingPlan {
  id: BillingPlanId
  name: string
  priceMonthly: number
  priceYearly: number
  features: string[]
  limits: BillingPlanLimits
}

export interface BillingSubscription {
  id: string
  plan: BillingPlan
  status: SubscriptionStatus
  billingCycle: BillingCycle
  startDate: string
  nextBillingDate: string
  cancelledAt?: string | null
}

export interface BillingPaymentMethod {
  id: string
  type: BillingPaymentMethodType
  isDefault: boolean
  last4?: string | null
  brand?: string | null
  expiresAt?: string | null
}

export interface BillingInvoice {
  id: string
  description: string
  amount: number
  status: InvoiceStatus
  dueDate: string
  paidAt?: string | null
  downloadUrl?: string | null
}

export interface BillingSettings {
  subscription: BillingSubscription | null
  paymentMethods: BillingPaymentMethod[]
  invoices: BillingInvoice[]
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SiteSettings {
  id: string
  // B2B Rules
  requireCnpj: boolean
  defaultMinPieces: number
  minOrderValue: number | null
  maxInstallmentsText: string
  stockMode: StockMode
  variantMaxQty: number
  pendingCustomerMessage: string
  // Price visibility
  priceVisibilityMode: PriceVisibilityMode
  // Seller permissions
  sellerCanApproveCustomers: boolean
  sellerCanEditPriceTable: boolean
  sellerCanCreateOrders: boolean
  b2bPaymentTerms?: PaymentMethod[]
  // Shipping
  shippingOptions: ShippingOption[]
  shippingSettings: ShippingSettings
  // Home config
  homeConfig: HomeConfig
  // Customization
  customization: SiteCustomization
  // Payment settings
  paymentSettings: PaymentSettings
  // Marketing settings
  marketingSettings: MarketingSettings
  // Domain settings
  domainSettings: DomainSettings
  // Menu
  menuItems: MenuItem[]
  // Institutional pages
  institutionalPages: InstitutionalPage[]
  // Signup wholesale form and approval
  sign_wholesale: SignWholesaleSettings
  updatedAt: Date
  // Billing / Plans
  billing?: BillingSettings
}

export interface HomeConfig {
  heroTitle: string
  heroSubtitle: string
  heroImage: string
  featuredCategoryIds: string[]
  featuredProductIds: string[]
}

export interface AuditLog {
  id: string
  actorUserId: string
  action: string
  entityType: string
  entityId: string
  beforeJson: Record<string, unknown> | null
  afterJson: Record<string, unknown> | null
  createdAt: Date
}

// ==================== VIEW TYPES ====================

export interface ProductWithVariants extends Product {
  variants: ProductVariant[]
  category?: Category
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
  customer?: Customer
}

export interface CustomerWithUser extends Customer {
  user?: User
  seller?: User
  priceTable?: PriceTable
}

// ==================== STOREFRONT PRODUCT IMAGES ====================

export interface StorefrontProductImageFile {
  id: string | number
  imageUrl: string
  storagePath: string
  displayOrder: number
  isPrimary: boolean
}

export interface StorefrontProductImageVariantAttribute {
  attributeId: number
  attributeCode: string
  attributeName: string
  attributeValueId: number
  valueCode: string
  valueName: string
  valueMeta?: Record<string, unknown>
}

export interface StorefrontProductImageVariant {
  id: number
  sku?: string
  imageKey?: string
  stockQty?: number
  priceCents?: number
  promoCents?: number
  attributeValues: StorefrontProductImageVariantAttribute[]
}

export interface StorefrontProductImageGroup {
  productId: string | number
  storeId: number
  productName: string
  productSlug?: string
  imageKey: string
  primaryImageUrl?: string
  totalImages: number
  images: StorefrontProductImageFile[]
  variants?: StorefrontProductImageVariant[]
}

export interface StorefrontProductImagesResponse {
  items: StorefrontProductImageGroup[]
  total: number
  page: number
  limit: number
}

export interface StorefrontFilterAttributeValue {
  id: number
  code: string
  name: string
  sort_order: number
  meta?: {
    rgb?: string
    hex?: string
    imageUrl?: string
    image_url?: string
    swatchImageUrl?: string
    swatch_image_url?: string
    [key: string]: unknown
  }
}

export interface StorefrontFilterAttribute {
  id: number
  store_id: number | null
  code: string
  name: string
  sort_order: number
  values: StorefrontFilterAttributeValue[]
}

// ==================== SESSION ====================

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  customerId?: string
  sellerId?: string
  storeId?: number
}

// ==================== API TYPES ====================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CustomLink {
  id: string
  storeId: number
  name: string
  slug: string
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomLinkSummary {
  id: string
  name: string
  slug: string
  isActive: boolean
  productCount: number
  clicks: number
  orders: number
  createdAt: string
}

export interface CustomLinkDetail {
  link: CustomLink
  productIds: string[]
}

// ==================== PRICE CALCULATION ====================

export interface PriceCalculation {
  basePrice: number
  tablePrice: number
  extraDiscount: number
  tierDiscount: number
  couponDiscount: number
  finalPrice: number
  totalPieces: number
  subtotal: number
  discountTotal: number
  total: number
}

// ==================== MESSAGING ====================

export type WhatsAppProvider = 'META_CLOUD'

export type MessageTriggerType =
  | 'CUSTOMER_REGISTERED'
  | 'CUSTOMER_APPROVED'
  | 'CUSTOMER_REJECTED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'CART_ABANDONED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'

export type MessageChannel = 'WHATSAPP' | 'EMAIL' | 'SMS'

export interface WhatsAppConfig {
  isEnabled: boolean
  provider: WhatsAppProvider
  phoneNumberId: string
  accessToken: string
  businessAccountId: string
  webhookVerifyToken: string
  isConnected: boolean
  connectedAt: Date | null
}

export interface MessageTemplate {
  id: string
  name: string
  trigger: MessageTriggerType
  isActive: boolean
  channel: MessageChannel
  content: string
  variables: string[]
  delayMinutes: number
  createdAt: Date
  updatedAt: Date
}

export type FlowConditionType =
  | 'CUSTOMER_STATUS'
  | 'ORDER_STATUS'
  | 'ORDER_VALUE'
  | 'CUSTOMER_SEGMENT'
  | 'PAYMENT_METHOD'
  | 'TIME_DELAY'
  | 'SELLER_ASSIGNED'

export type FlowConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'CONTAINS'
  | 'IN'

export type FlowActionType =
  | 'SEND_WHATSAPP'
  | 'SEND_EMAIL'
  | 'SEND_SMS'
  | 'WAIT'
  | 'ASSIGN_SELLER'
  | 'ADD_TAG'
  | 'UPDATE_STATUS'

export interface FlowCondition {
  id: string
  type: FlowConditionType
  operator: FlowConditionOperator
  value: string | number | boolean | null
}

export interface FlowAction {
  id: string
  type: FlowActionType
  config: {
    message?: string
    delayMinutes?: number
    tag?: string
    status?: string
    sellerId?: string
  }
}

export interface FlowStep {
  id: string
  name: string
  conditions: FlowCondition[]
  conditionLogic: 'AND' | 'OR'
  actions: FlowAction[]
  nextStepId: string | null
}

export interface MessageFlow {
  id: string
  name: string
  description: string | null
  trigger: MessageTriggerType
  isActive: boolean
  steps: FlowStep[]
  createdAt: Date
  updatedAt: Date
}

// ==================== BRANCHES ====================

export type BranchStatus = 'active' | 'inactive'

/**
 * A Branch (Filial) represents a segmented storefront URL for a single brand.
 * Example: brand.com/saopaulo, brand.com/riodejaneiro
 *
 * Branches are first-class entities — not just URL aliases.
 * All key business data (orders, customers, leads) is bound to a branch_id.
 */
export interface Branch {
  id: string
  storeId: number
  name: string
  slug: string
  status: BranchStatus
  isDefault: boolean
  city: string | null
  state: string | null
  description: string | null
  responsibleName: string | null
  contactWhatsapp: string | null
  contactEmail: string | null
  // Future-proofing: stored as JSON in backend, enables per-branch customization
  themeConfig: Record<string, unknown> | null
  seoConfig: Record<string, unknown> | null
  trackingConfig: Record<string, unknown> | null
  catalogConfig: Record<string, unknown> | null
  // Future-proofing: per-branch pricing and inventory scope
  pricingTableId: string | null
  salesChannelCode: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface CreateBranchInput {
  name: string
  slug: string
  status: BranchStatus
  isDefault?: boolean
  city?: string | null
  state?: string | null
  description?: string | null
  responsibleName?: string | null
  contactWhatsapp?: string | null
  contactEmail?: string | null
  themeConfig?: Record<string, unknown> | null
  seoConfig?: Record<string, unknown> | null
  trackingConfig?: Record<string, unknown> | null
  catalogConfig?: Record<string, unknown> | null
  pricingTableId?: string | null
  salesChannelCode?: string | null
}

export type UpdateBranchInput = Partial<CreateBranchInput>
