import type {
  Product,
  ProductVariant,
  Customer,
  PriceTable,
  Coupon,
  TierDiscount,
  CartItem,
  PriceCalculation,
} from './types'
import {
  getProductById,
  getVariantById,
  getPriceTableById,
  getPriceTableItemForProduct,
  getTierDiscounts,
  getCouponByCode,
} from './backend-data'

// Get the price for a product based on price table
export async function getProductPrice(
  product: Product,
  priceTable: PriceTable | null,
): Promise<number> {
  if (!priceTable) {
    return product.basePrice
  }

  if (priceTable.type === 'OVERRIDE') {
    // Check for specific override
    const item = await getPriceTableItemForProduct(priceTable.id, product.id)
    if (item) {
      return item.overridePrice
    }
  }

  if (priceTable.type === 'PERCENTAGE' && priceTable.percentage) {
    const discount = product.basePrice * (priceTable.percentage / 100)
    return Math.max(0, product.basePrice + discount) // percentage can be negative for discount
  }

  return product.basePrice
}

// Get tier discount based on quantity
export async function getTierDiscount(totalPieces: number): Promise<number> {
  const tiers = await getTierDiscounts()
  
  // Find the highest applicable tier
  let applicableDiscount = 0
  for (const tier of tiers) {
    if (totalPieces >= tier.minPieces) {
      applicableDiscount = tier.discountPct
    }
  }
  
  return applicableDiscount
}

// Validate and get coupon
export async function validateCoupon(
  code: string,
  subtotal: number,
  items: { productId: string; categoryId: string }[],
): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
  const coupon = await getCouponByCode(code)
  
  if (!coupon) {
    return { valid: false, error: 'Cupom não encontrado' }
  }
  
  if (!coupon.isActive) {
    return { valid: false, error: 'Cupom inativo' }
  }
  
  const now = new Date()
  if (now < coupon.startsAt) {
    return { valid: false, error: 'Cupom ainda não está válido' }
  }
  
  if (now > coupon.endsAt) {
    return { valid: false, error: 'Cupom expirado' }
  }
  
  if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
    return { valid: false, error: 'Cupom esgotado' }
  }
  
  if (coupon.minOrderValue !== null && subtotal < coupon.minOrderValue) {
    return { valid: false, error: `Pedido mínimo de R$ ${coupon.minOrderValue.toFixed(2)} para este cupom` }
  }
  
  // Check scope
  if (coupon.scope.type === 'CATEGORY' && coupon.scope.categoryIds) {
    const hasValidItem = items.some(item => 
      coupon.scope.categoryIds!.includes(item.categoryId)
    )
    if (!hasValidItem) {
      return { valid: false, error: 'Cupom não aplicável aos produtos do carrinho' }
    }
  }
  
  if (coupon.scope.type === 'PRODUCTS' && coupon.scope.productIds) {
    const hasValidItem = items.some(item => 
      coupon.scope.productIds!.includes(item.productId)
    )
    if (!hasValidItem) {
      return { valid: false, error: 'Cupom não aplicável aos produtos do carrinho' }
    }
  }
  
  return { valid: true, coupon }
}

// Calculate coupon discount
export function calculateCouponDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.type === 'PERCENT') {
    return subtotal * (coupon.value / 100)
  }
  return Math.min(coupon.value, subtotal)
}

// Full price calculation for cart
export async function calculateCartPrice(
  items: CartItem[],
  customer: Customer | null,
  couponCode: string | null,
): Promise<PriceCalculation> {
  let subtotal = 0
  let totalPieces = 0
  const itemDetails: { productId: string; categoryId: string }[] = []
  
  // Get price table
  let priceTable: PriceTable | null = null
  if (customer?.priceTableId) {
    priceTable = await getPriceTableById(customer.priceTableId) || null
  }
  
  // Calculate base prices
  for (const item of items) {
    const product = item.product || await getProductById(item.productId)
    if (!product) continue
    
    const variant = item.variant || await getVariantById(item.variantId)
    
    // Get price (variant override or table price)
    let unitPrice: number
    if (variant?.priceOverride) {
      unitPrice = variant.priceOverride
    } else {
      unitPrice = await getProductPrice(product, priceTable)
    }
    
    subtotal += unitPrice * item.quantity
    totalPieces += item.quantity
    itemDetails.push({ productId: product.id, categoryId: product.categoryId })
  }
  
  const tablePrice = subtotal
  
  // Customer extra discount
  let extraDiscount = 0
  if (customer?.extraDiscountPct) {
    extraDiscount = subtotal * (customer.extraDiscountPct / 100)
    subtotal -= extraDiscount
  }
  
  // Tier discount
  const tierDiscountPct = await getTierDiscount(totalPieces)
  let tierDiscount = 0
  if (tierDiscountPct > 0) {
    tierDiscount = subtotal * (tierDiscountPct / 100)
    subtotal -= tierDiscount
  }
  
  // Coupon discount
  let couponDiscount = 0
  if (couponCode) {
    const validation = await validateCoupon(couponCode, subtotal, itemDetails)
    if (validation.valid && validation.coupon) {
      couponDiscount = calculateCouponDiscount(validation.coupon, subtotal)
      subtotal -= couponDiscount
    }
  }
  
  const discountTotal = extraDiscount + tierDiscount + couponDiscount
  
  return {
    basePrice: tablePrice + extraDiscount, // Before customer discount
    tablePrice,
    extraDiscount,
    tierDiscount,
    couponDiscount,
    finalPrice: subtotal,
    totalPieces,
    subtotal: tablePrice + extraDiscount,
    discountTotal,
    total: subtotal,
  }
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${value.toFixed(0)}%`
}

// Simple synchronous price display function (for UI display)
// This is a simplified version that just returns the base price
// The full async version should be used for actual cart calculations
export function getDisplayPrice(basePrice: number | string | null | undefined): number {
  if (basePrice === null || basePrice === undefined) return 0;
  const price = typeof basePrice === 'string' ? parseFloat(basePrice) : basePrice;
  return isNaN(price) ? 0 : price;
}

// Alias for backward compatibility - sync version for simple display
export function calculateProductPrice(basePrice: number | string | null | undefined, _userId?: string | null): number {
  return getDisplayPrice(basePrice);
}
