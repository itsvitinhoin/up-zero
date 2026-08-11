import { DASHBOARD_CUSTOMERS, DASHBOARD_ORDERS } from '@/lib/dashboard-mock-data'
import type { Customer, Order, PaymentMethod } from '@/lib/types'

function mapPaymentMethod(value: string): PaymentMethod {
  if (value === 'PIX' || value === 'BOLETO') return value
  if (value === 'CARTÃO') return 'CARTAO_EXTERNO'
  return 'FATURADO'
}

export const adminMockCustomers: Customer[] = DASHBOARD_CUSTOMERS.map((customer) => ({
  id: customer.id,
  userId: `user-${customer.id}`,
  customerType: 'PJ',
  companyName: customer.name,
  tradeName: customer.name,
  cnpj: '',
  stateRegistration: null,
  contactName: customer.name,
  phone: '',
  email: customer.email,
  street: '',
  number: '',
  complement: null,
  neighborhood: '',
  city: customer.city,
  state: customer.state,
  zipCode: '',
  segment: customer.segment ?? null,
  status: customer.status === 'active' ? 'APPROVED' : 'PENDING',
  priceTableId: null,
  minPiecesOverride: null,
  extraDiscountPct: null,
  paymentTerms: ['PIX'],
  assignedSellerId: null,
  createdAt: customer.registeredAt,
  updatedAt: customer.lastPurchaseAt ?? customer.registeredAt,
}))

export const adminMockOrders: Order[] = DASHBOARD_ORDERS.map((order) => ({
  id: order.id,
  code: order.id,
  customerId: order.customerId,
  createdByUserId: 'system',
  createdBySellerId: null,
  status: order.status,
  paymentStatus: order.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
  subtotal: order.total,
  couponDiscount: 0,
  tierDiscount: 0,
  discountTotal: 0,
  manualDiscount: 0,
  total: order.total,
  fulfilledTotal: order.fulfilledTotal,
  totalItems: order.items,
  fulfilledItems: order.fulfilledItems,
  shippingName: null,
  shippingPrice: 0,
  paymentMethod: mapPaymentMethod(order.paymentMethod),
  notes: null,
  internalNotes: null,
  trackingCode: null,
  trackingUrl: null,
  shippingStreet: '',
  shippingNumber: '',
  shippingComplement: null,
  shippingNeighborhood: '',
  shippingCity: order.city,
  shippingState: order.state,
  shippingZipCode: '',
  createdAt: order.date,
  updatedAt: order.date,
}))

export function withAdminMockCustomers(customers: Customer[]): Customer[] {
  return customers.length > 0 ? customers : adminMockCustomers
}
