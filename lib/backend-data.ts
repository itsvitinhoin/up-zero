import type {
  AuditLog,
  Cart,
  Coupon,
  Customer,
  Order,
  OrderItem,
  PriceTable,
  PriceTableItem,
  Product,
  ProductVariant,
  SiteSettings,
  TierDiscount,
  User,
} from '@/lib/types'

function now() {
  return new Date()
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export async function getOrders(_filters?: {
  customerId?: string
  status?: string
  assignedSellerId?: string
}): Promise<Order[]> {
  return []
}

export async function getOrderById(_id: string): Promise<Order | undefined> {
  return undefined
}

export async function createOrder(_data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
  throw new Error('Fluxo local removido: criação de pedido deve ocorrer via backend')
}

export async function updateOrder(_id: string, _data: Partial<Order>): Promise<Order | undefined> {
  return undefined
}

export async function getOrderItems(_orderId: string): Promise<OrderItem[]> {
  return []
}

export async function createOrderItem(_data: Omit<OrderItem, 'id'>): Promise<OrderItem> {
  throw new Error('Fluxo local removido: criação de item de pedido deve ocorrer via backend')
}

export async function getCart(userId: string): Promise<Cart> {
  return {
    userId,
    items: [],
    couponCode: null,
    notes: null,
    updatedAt: now(),
  } as Cart
}

export async function clearCart(_userId: string): Promise<void> {
  return
}

export async function getProductById(_id: string): Promise<Product | undefined> {
  return undefined
}

export async function getVariantById(_id: string): Promise<ProductVariant | undefined> {
  return undefined
}

export async function updateVariant(_id: string, _data: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
  return undefined
}

export async function getCustomerById(_id: string): Promise<Customer | undefined> {
  return undefined
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return {
    id: 'settings',
    siteName: 'UPZERO',
    logoUrl: '/logo-upzero.png',
    faviconUrl: null,
    primaryColor: '#6B46C1',
    secondaryColor: '#F3F4F6',
    supportPhone: '',
    supportEmail: '',
    socialLinks: {
      instagram: '',
      facebook: '',
      whatsapp: '',
    },
    menuItems: [],
    paymentSettings: {
      methods: ['PIX'],
      maxInstallments: 1,
      interestFreeInstallments: 1,
      pixDiscount: 0,
      cardInterest: 0,
      boletoEnabled: false,
      pixEnabled: true,
      cardEnabled: false,
    },
    customization: {
      logoUrl: '/logo-upzero.png',
      logoLightUrl: '/logo-upzero.png',
      logoDarkUrl: null,
      faviconUrl: null,
      heroTitle: '',
      heroSubtitle: '',
      showFeaturedProducts: true,
      showCategories: true,
      customCss: '',
    },
    createdAt: now(),
    updatedAt: now(),
  } as unknown as SiteSettings
}

export async function updateSiteSettings(data: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSiteSettings()
  return {
    ...current,
    ...data,
    updatedAt: now(),
  } as SiteSettings
}

export async function getCouponByCode(_code: string): Promise<Coupon | undefined> {
  return undefined
}

export async function updateCoupon(_id: string, _data: Partial<Coupon>): Promise<Coupon | undefined> {
  return undefined
}

export async function getPriceTableById(_id: string): Promise<PriceTable | undefined> {
  return undefined
}

export async function getPriceTableItemForProduct(_priceTableId: string, _productId: string): Promise<PriceTableItem | undefined> {
  return undefined
}

export async function getTierDiscounts(): Promise<TierDiscount[]> {
  return []
}

export async function getUsers(_filters?: { role?: string; isActive?: boolean }): Promise<User[]> {
  return []
}

export async function updateUser(_id: string, _data: Partial<User>): Promise<User | undefined> {
  return undefined
}

export async function createUser(_data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  throw new Error('Fluxo local removido: criação de usuário deve ocorrer via backend')
}

export async function createAuditLog(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
  return {
    id: randomId('audit'),
    ...data,
    createdAt: now(),
  } as AuditLog
}
