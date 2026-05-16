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
  items: { productId: string; categoryId: string; lineSubtotal?: number; quantity?: number }[],
  context?: { customerOrderCount?: number },
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
  
  const minOrderValue = coupon.minOrderValueCents != null ? coupon.minOrderValueCents / 100 : null
  if (minOrderValue !== null && subtotal < minOrderValue) {
    return { valid: false, error: `Pedido mínimo de R$ ${minOrderValue.toFixed(2)} para este cupom` }
  }

  if (coupon.firstPurchaseOnly) {
    if (typeof context?.customerOrderCount === 'number' && context.customerOrderCount > 0) {
      return { valid: false, error: 'Cupom disponível apenas para primeira compra' }
    }

    const firstPurchaseMinOrderValue =
      coupon.firstPurchaseMinOrderValueCents != null ? coupon.firstPurchaseMinOrderValueCents / 100 : null
    if (firstPurchaseMinOrderValue !== null && subtotal < firstPurchaseMinOrderValue) {
      return {
        valid: false,
        error: `Pedido mínimo de R$ ${firstPurchaseMinOrderValue.toFixed(2)} para primeira compra`,
      }
    }

    const firstPurchaseMinItems = coupon.firstPurchaseMinItemsQuantity ?? null
    if (firstPurchaseMinItems !== null) {
      const itemCount = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      if (itemCount < firstPurchaseMinItems) {
        return {
          valid: false,
          error: `Quantidade mínima de ${firstPurchaseMinItems} itens para primeira compra`,
        }
      }
    }
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

function isCouponItemEligible(coupon: Coupon, item: { productId: string; categoryId: string }): boolean {
  const includeTargets = coupon.includeTargets ?? []
  const excludeTargets = coupon.excludeTargets ?? []

  const excluded = excludeTargets.some((target) => {
    if (target.type === 'product') return target.id === item.productId
    if (target.type === 'category') return target.id === item.categoryId
    return false
  })
  if (excluded) return false

  if (coupon.applyToAllProducts === false && includeTargets.length > 0) {
    return includeTargets.some((target) => {
      if (target.type === 'product') return target.id === item.productId
      if (target.type === 'category') return target.id === item.categoryId
      return false
    })
  }

  return true
}

function getEligibleCouponSubtotal(
  coupon: Coupon,
  items: { productId: string; categoryId: string; lineSubtotal?: number }[],
  fallbackSubtotal: number,
): number {
  const subtotalFromItems = items.reduce((sum, item) => {
    if (!isCouponItemEligible(coupon, item)) return sum
    return sum + (item.lineSubtotal ?? 0)
  }, 0)

  return subtotalFromItems > 0 ? subtotalFromItems : fallbackSubtotal
}

// Calculate coupon discount
export function calculateCouponDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.discountType === 'free_shipping') {
    return 0
  }

  if (coupon.type === 'percentage') {
    return subtotal * (coupon.valueCents / 100)
  }

  return Math.min(coupon.valueCents / 100, subtotal)
}

// Full price calculation for cart
export async function calculateCartPrice(
  items: CartItem[],
  customer: Customer | null,
  couponCode: string | null,
): Promise<PriceCalculation> {
  let subtotal = 0
  let totalPieces = 0
  const itemDetails: { productId: string; categoryId: string; lineSubtotal: number; quantity: number }[] = []
  
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
    
    const lineSubtotal = unitPrice * item.quantity
    subtotal += lineSubtotal
    totalPieces += item.quantity
    itemDetails.push({ productId: product.id, categoryId: product.categoryId, lineSubtotal, quantity: item.quantity })
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
      const eligibleSubtotal = getEligibleCouponSubtotal(validation.coupon, itemDetails, subtotal)
      couponDiscount = calculateCouponDiscount(validation.coupon, eligibleSubtotal)
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
