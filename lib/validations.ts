import { z } from 'zod'

// ==================== CNPJ VALIDATION ====================

export function validateCNPJ(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/[^\d]/g, '')
  
  if (cleanCnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cleanCnpj)) return false
  
  let size = cleanCnpj.length - 2
  let numbers = cleanCnpj.substring(0, size)
  const digits = cleanCnpj.substring(size)
  let sum = 0
  let pos = size - 7
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) return false
  
  size = size + 1
  numbers = cleanCnpj.substring(0, size)
  sum = 0
  pos = size - 7
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) return false
  
  return true
}

export function validateCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/[^\d]/g, '')

  if (cleanCpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cleanCpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += Number(cleanCpf[i]) * (10 - i)
  }

  let result = (sum * 10) % 11
  if (result === 10) result = 0
  if (result !== Number(cleanCpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += Number(cleanCpf[i]) * (11 - i)
  }

  result = (sum * 10) % 11
  if (result === 10) result = 0
  if (result !== Number(cleanCpf[10])) return false

  return true
}

// ==================== AUTH SCHEMAS ====================

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

export const registerB2BSchema = z.object({
  // User
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirmação de senha é obrigatória'),
  requireCnpj: z.boolean().optional(),
  // Company
  companyName: z.string().optional(),
  tradeName: z.string().optional(),
  cnpj: z.string().min(1, 'Documento é obrigatório'),
  stateRegistration: z.string().optional(),
  contactName: z.string().min(2, 'Nome do contato é obrigatório'),
  phone: z.string().optional(),
  // Address
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  segment: z.string().optional(),
  extraFields: z.record(z.string(), z.any()).optional(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'As senhas não correspondem',
      path: ['confirmPassword'],
    })
  }

  const requireCnpj = data.requireCnpj !== false
  const documentDigits = data.cnpj.replace(/[^\d]/g, '')
  const isCnpjDocument = documentDigits.length === 14
  const isCpfDocument = documentDigits.length === 11

  if (requireCnpj) {
    if (!validateCNPJ(documentDigits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CNPJ inválido',
        path: ['cnpj'],
      })
    }
  } else {
    if (isCpfDocument) {
      if (!validateCPF(documentDigits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CPF inválido',
          path: ['cnpj'],
        })
      }
    } else if (isCnpjDocument) {
      if (!validateCNPJ(documentDigits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CNPJ inválido',
          path: ['cnpj'],
        })
      }
    } else {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um CPF ou CNPJ válido',
        path: ['cnpj'],
      })
    }

    if (data.phone) {
      const phoneDigits = data.phone.replace(/[^\d]/g, '')
      if (phoneDigits.length > 0 && phoneDigits.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Telefone inválido',
          path: ['phone'],
        })
      }
    }

    if (data.state && data.state.trim().length > 0 && data.state.trim().length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Estado inválido',
        path: ['state'],
      })
    }

    if (data.zipCode) {
      const zipDigits = data.zipCode.replace(/[^\d]/g, '')
      if (zipDigits.length > 0 && zipDigits.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CEP inválido',
          path: ['zipCode'],
        })
      }
    }
  }
})

// ==================== PRODUCT SCHEMAS ====================

export const productSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  slug: z.string().min(2, 'Slug é obrigatório'),
  sku: z.string().min(2, 'SKU é obrigatório'),
  description: z.string().optional(),
  materials: z.string().optional(),
  measures: z.string().optional(),
  basePrice: z.number().positive('Preço deve ser positivo'),
  cost: z.number().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.object({
    name: z.string(),
    hex: z.string(),
  })).default([]),
})

export const productVariantSchema = z.object({
  productId: z.string(),
  color: z.string(),
  size: z.string(),
  variantSku: z.string(),
  stock: z.number().int().min(0),
  priceOverride: z.number().positive().optional().nullable(),
})

// ==================== CATEGORY SCHEMAS ====================

export const categorySchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  slug: z.string().min(2, 'Slug é obrigatório'),
  description: z.string().optional(),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

// ==================== PRICE TABLE SCHEMAS ====================

export const priceTableSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  type: z.enum(['PERCENTAGE', 'OVERRIDE']),
  percentage: z.number().min(0, 'Percentual deve ser positivo').max(100, 'Percentual máximo é 100%').optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const priceTableItemSchema = z.object({
  priceTableId: z.string(),
  productId: z.string(),
  overridePrice: z.number().positive(),
})

// ==================== COUPON SCHEMAS ====================

export const couponSchema = z.object({
  code: z.string().min(3, 'Código deve ter pelo menos 3 caracteres').toUpperCase(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().positive('Valor deve ser positivo'),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  maxUses: z.number().int().positive().optional().nullable(),
  minOrderValue: z.number().positive().optional().nullable(),
  scope: z.object({
    type: z.enum(['ALL', 'CATEGORY', 'PRODUCTS']),
    categoryIds: z.array(z.string()).optional(),
    productIds: z.array(z.string()).optional(),
  }).default({ type: 'ALL' }),
  isActive: z.boolean().default(true),
})

// ==================== TIER DISCOUNT SCHEMAS ====================

export const tierDiscountSchema = z.object({
  minPieces: z.number().int().positive('Quantidade mínima deve ser positiva'),
  discountPct: z.number().positive('Desconto deve ser positivo').max(100, 'Desconto máximo é 100%'),
  isActive: z.boolean().default(true),
})

// ==================== CUSTOMER SCHEMAS ====================

export const customerUpdateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  priceTableId: z.string().optional().nullable(),
  minPiecesOverride: z.number().int().positive().optional().nullable(),
  extraDiscountPct: z.number().min(0).max(100).optional().nullable(),
  paymentTerms: z.array(z.enum(['PIX', 'BOLETO', 'FATURADO', 'CARTAO_EXTERNO'])).optional(),
  assignedSellerId: z.string().optional().nullable(),
})

// ==================== ORDER SCHEMAS ====================

export const orderStatusSchema = z.enum([
  'PENDING', 'CONFIRMED', 'PROCESSING', 'INVOICED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
])

export const checkoutSchema = z.object({
  shippingOptionId: z.string(),
  paymentMethod: z.enum(['PIX', 'BOLETO', 'FATURADO', 'CARTAO_EXTERNO']),
  notes: z.string().optional(),
  // Address override (optional)
  shippingStreet: z.string().optional(),
  shippingNumber: z.string().optional(),
  shippingComplement: z.string().optional(),
  shippingNeighborhood: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZipCode: z.string().optional(),
  // Credit card fields (required when paymentMethod === 'CARTAO_EXTERNO')
  cardHolderName: z.string().optional(),
  cardDocument: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  cardInstallments: z.coerce.number().int().min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod !== 'CARTAO_EXTERNO') return

  if (!data.cardHolderName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nome no cartão é obrigatório', path: ['cardHolderName'] })
  }
  if (!data.cardDocument?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CPF/CNPJ do titular é obrigatório', path: ['cardDocument'] })
  }
  if (!data.cardNumber?.replace(/\s/g, '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Número do cartão é obrigatório', path: ['cardNumber'] })
  }
  if (!data.cardExpiry?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Validade do cartão é obrigatória', path: ['cardExpiry'] })
  }
  if (!data.cardCvv?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CVV é obrigatório', path: ['cardCvv'] })
  }
  if (!data.cardInstallments || data.cardInstallments < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Número de parcelas é obrigatório', path: ['cardInstallments'] })
  }
})

// ==================== CART SCHEMAS ====================

export const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().positive(),
})

export const updateCartItemSchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().min(0),
})

export const applyCouponSchema = z.object({
  code: z.string().min(1),
})

// ==================== SETTINGS SCHEMAS ====================

export const siteSettingsSchema = z.object({
  requireCnpj: z.boolean().optional(),
  defaultMinPieces: z.number().int().positive().optional(),
  minOrderValue: z.number().positive().optional().nullable(),
  maxInstallmentsText: z.string().optional(),
  stockMode: z.enum(['FANTASY', 'BINARY', 'REAL', 'INFINITO']).optional(),
  variantMaxQty: z.number().int().positive().optional(),
  pendingCustomerMessage: z.string().optional(),
  priceVisibilityMode: z.enum(['LOGIN_REQUIRED', 'PUBLIC']).optional(),
  sellerCanApproveCustomers: z.boolean().optional(),
  sellerCanEditPriceTable: z.boolean().optional(),
  sellerCanCreateOrders: z.boolean().optional(),
  homeConfig: z.object({
    heroTitle: z.string(),
    heroSubtitle: z.string(),
    heroImage: z.string(),
    featuredCategoryIds: z.array(z.string()),
    featuredProductIds: z.array(z.string()),
  }).optional(),
  sign_wholesale: z.object({
    fields: z.array(z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(['TEXT', 'EMAIL', 'PHONE', 'CNPJ', 'LONG_TEXT', 'URL', 'SELECT', 'UPLOAD']),
      enabled: z.boolean(),
      required: z.boolean(),
      order: z.number().int().positive(),
      isDefault: z.boolean(),
      helpText: z.string().optional(),
    })),
    autoApproval: z.object({
      enabled: z.boolean(),
      mode: z.enum(['CNAE', 'MANUAL']),
      validateCnpjOnReceita: z.boolean(),
      allowedCnaes: z.array(z.string()),
    }),
  }).optional(),
})

// ==================== USER SCHEMAS ====================

export const createUserSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['ADMIN', 'SALES_MANAGER', 'SELLER']),
  phone: z.string().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
})

// ==================== ASSISTED ORDER SCHEMA ====================

export const assistedOrderSchema = z.object({
  customerId: z.string(),
  items: z.array(z.object({
    productId: z.string().optional(),
    variantId: z.string(),
    quantity: z.number().int().positive(),
  })),
  shippingOptionId: z.string(),
  paymentMethod: z.enum(['PIX', 'BOLETO', 'FATURADO', 'CARTAO_EXTERNO']),
  notes: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterB2BInput = z.infer<typeof registerB2BSchema>
export type ProductInput = z.infer<typeof productSchema>
export type ProductVariantInput = z.infer<typeof productVariantSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type PriceTableInput = z.infer<typeof priceTableSchema>
export type PriceTableItemInput = z.infer<typeof priceTableItemSchema>
export type CouponInput = z.infer<typeof couponSchema>
export type TierDiscountInput = z.infer<typeof tierDiscountSchema>
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type AddToCartInput = z.infer<typeof addToCartSchema>
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type AssistedOrderInput = z.infer<typeof assistedOrderSchema>
