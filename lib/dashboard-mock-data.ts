// ─────────────────────────────────────────────────────────────────────────────
// Dashboard mock data — rich synthetic dataset for all 12 dashboard sections
// ─────────────────────────────────────────────────────────────────────────────

export type DOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'INVOICED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
export type DCurve = 'A' | 'B' | 'C'
export type DRFMSegment = 'Champions' | 'Loyal' | 'Promising' | 'At Risk' | 'Lost'
export type DCustomerStatus = 'active' | 'inactive' | 'at_risk'

export interface DOrder {
  id: string
  customerId: string
  customerName: string
  state: string
  city: string
  status: DOrderStatus
  total: number
  fulfilledTotal: number
  items: number
  fulfilledItems: number
  paymentMethod: string
  date: Date
  month: string // e.g. 'Out/25'
}

export interface DCustomer {
  id: string
  name: string
  email: string
  state: string
  city: string
  segment: string
  status: DCustomerStatus
  rfmSegment: DRFMSegment
  registeredAt: Date
  firstPurchaseAt: Date | null
  lastPurchaseAt: Date | null
  totalOrders: number
  totalRevenue: number
  totalRequested: number
  avgTicket: number
  frequency: number // avg days between orders
  daysToPurchase: number | null // days from reg → first purchase
  assignedSellerName?: string
}

export interface DProduct {
  id: string
  name: string
  sku: string
  category: string
  basePrice: number
  revenueRequested: number
  revenueFulfilled: number
  unitsRequested: number
  unitsFulfilled: number
  stock: number
  dailySales: number
  daysLeft: number
  curve: DCurve
  sizes: { size: string; units: number }[]
  colors: { color: string; hex: string; units: number }[]
  monthlyRevenue: { month: string; value: number }[]
}

export interface DMonthlyRevenue {
  month: string
  requested: number
  fulfilled: number
  orders: number
  newCustomers: number
  returningCustomers: number
}

export interface DGeoEntry {
  state: string
  stateCode: string
  customers: number
  orders: number
  requested: number
  fulfilled: number
  cities: { city: string; customers: number; revenue: number }[]
}

export interface DRFMEntry {
  segment: DRFMSegment
  count: number
  color: string
  bgColor: string
  pct: number
  avgRevenue: number
  description: string
}

export interface DCohortRow {
  cohort: string
  months: (number | null)[]
}

export interface DFunnelStage {
  label: string
  value: number
  pct: number
  color: string
}

// ─── Monthly Revenue (12 months) ─────────────────────────────────────────────
export const MONTHLY_REVENUE: DMonthlyRevenue[] = [
  { month: 'Mai/25', requested: 62400,  fulfilled: 51200,  orders: 18, newCustomers: 5, returningCustomers: 4 },
  { month: 'Jun/25', requested: 71800,  fulfilled: 60100,  orders: 22, newCustomers: 6, returningCustomers: 5 },
  { month: 'Jul/25', requested: 79200,  fulfilled: 67400,  orders: 25, newCustomers: 4, returningCustomers: 8 },
  { month: 'Ago/25', requested: 88600,  fulfilled: 74900,  orders: 29, newCustomers: 7, returningCustomers: 9 },
  { month: 'Set/25', requested: 94100,  fulfilled: 80300,  orders: 32, newCustomers: 5, returningCustomers: 12 },
  { month: 'Out/25', requested: 84200,  fulfilled: 71400,  orders: 27, newCustomers: 4, returningCustomers: 10 },
  { month: 'Nov/25', requested: 91500,  fulfilled: 79800,  orders: 31, newCustomers: 6, returningCustomers: 11 },
  { month: 'Dez/25', requested: 118000, fulfilled: 99200,  orders: 38, newCustomers: 8, returningCustomers: 15 },
  { month: 'Jan/26', requested: 76300,  fulfilled: 64100,  orders: 26, newCustomers: 3, returningCustomers: 10 },
  { month: 'Fev/26', requested: 98700,  fulfilled: 84500,  orders: 34, newCustomers: 7, returningCustomers: 13 },
  { month: 'Mar/26', requested: 112400, fulfilled: 96800,  orders: 37, newCustomers: 9, returningCustomers: 14 },
  { month: 'Abr/26', requested: 124600, fulfilled: 107200, orders: 41, newCustomers: 10, returningCustomers: 16 },
]

export const WEEKLY_REVENUE = [
  { week: 'S1 Mar', requested: 24800, fulfilled: 21200 },
  { week: 'S2 Mar', requested: 28400, fulfilled: 24600 },
  { week: 'S3 Mar', requested: 31200, fulfilled: 26900 },
  { week: 'S4 Mar', requested: 28000, fulfilled: 24100 },
  { week: 'S1 Abr', requested: 29600, fulfilled: 25400 },
  { week: 'S2 Abr', requested: 34200, fulfilled: 29800 },
  { week: 'S3 Abr', requested: 32800, fulfilled: 28100 },
  { week: 'S4 Abr', requested: 28000, fulfilled: 23900 },
]

// ─── Orders (30 synthetic orders) ────────────────────────────────────────────
export const DASHBOARD_ORDERS: DOrder[] = [
  { id: 'ORD-001', customerId: 'C01', customerName: 'Aurora Concept',     state: 'SP', city: 'São Paulo',       status: 'DELIVERED',  total: 3908,  fulfilledTotal: 3490,  items: 18, fulfilledItems: 16, paymentMethod: 'PIX',    date: new Date('2026-03-02'), month: 'Mar/26' },
  { id: 'ORD-002', customerId: 'C02', customerName: 'Brisa Tropical',     state: 'RJ', city: 'Rio de Janeiro',  status: 'PROCESSING', total: 2749,  fulfilledTotal: 1890,  items: 12, fulfilledItems: 8,  paymentMethod: 'BOLETO', date: new Date('2026-03-05'), month: 'Mar/26' },
  { id: 'ORD-003', customerId: 'C03', customerName: 'Casa Nativa',        state: 'MG', city: 'Belo Horizonte',  status: 'DELIVERED',  total: 5018,  fulfilledTotal: 5018,  items: 20, fulfilledItems: 20, paymentMethod: 'PIX',    date: new Date('2026-03-08'), month: 'Mar/26' },
  { id: 'ORD-004', customerId: 'C04', customerName: 'Onda Sul Moda',      state: 'RS', city: 'Porto Alegre',    status: 'SHIPPED',    total: 4200,  fulfilledTotal: 3780,  items: 16, fulfilledItems: 14, paymentMethod: 'PIX',    date: new Date('2026-03-12'), month: 'Mar/26' },
  { id: 'ORD-005', customerId: 'C05', customerName: 'Vitoria Boutique',   state: 'PR', city: 'Curitiba',        status: 'DELIVERED',  total: 2998,  fulfilledTotal: 2998,  items: 12, fulfilledItems: 12, paymentMethod: 'PIX',    date: new Date('2026-03-15'), month: 'Mar/26' },
  { id: 'ORD-006', customerId: 'C06', customerName: 'Mar Azul Fashion',   state: 'SC', city: 'Florianópolis',   status: 'PENDING',    total: 1890,  fulfilledTotal: 0,     items: 8,  fulfilledItems: 0,  paymentMethod: 'BOLETO', date: new Date('2026-03-18'), month: 'Mar/26' },
  { id: 'ORD-007', customerId: 'C07', customerName: 'Itapoã Resortwear',  state: 'BA', city: 'Salvador',        status: 'DELIVERED',  total: 3540,  fulfilledTotal: 3100,  items: 15, fulfilledItems: 13, paymentMethod: 'PIX',    date: new Date('2026-03-20'), month: 'Mar/26' },
  { id: 'ORD-008', customerId: 'C08', customerName: 'Cerrado Chic',       state: 'GO', city: 'Goiânia',         status: 'CONFIRMED',  total: 2100,  fulfilledTotal: 1750,  items: 9,  fulfilledItems: 7,  paymentMethod: 'PIX',    date: new Date('2026-03-22'), month: 'Mar/26' },
  { id: 'ORD-009', customerId: 'C01', customerName: 'Aurora Concept',     state: 'SP', city: 'São Paulo',       status: 'DELIVERED',  total: 4200,  fulfilledTotal: 4200,  items: 18, fulfilledItems: 18, paymentMethod: 'PIX',    date: new Date('2026-03-25'), month: 'Mar/26' },
  { id: 'ORD-010', customerId: 'C09', customerName: 'Pindaíba Store',     state: 'SP', city: 'Campinas',        status: 'CANCELLED',  total: 2800,  fulfilledTotal: 0,     items: 12, fulfilledItems: 0,  paymentMethod: 'BOLETO', date: new Date('2026-03-27'), month: 'Mar/26' },
  { id: 'ORD-011', customerId: 'C10', customerName: 'Encanto Feminino',   state: 'RJ', city: 'Niterói',         status: 'DELIVERED',  total: 1680,  fulfilledTotal: 1680,  items: 7,  fulfilledItems: 7,  paymentMethod: 'PIX',    date: new Date('2026-04-01'), month: 'Abr/26' },
  { id: 'ORD-012', customerId: 'C11', customerName: 'Arte & Moda',        state: 'SP', city: 'São Paulo',       status: 'PROCESSING', total: 5400,  fulfilledTotal: 4320,  items: 22, fulfilledItems: 18, paymentMethod: 'PIX',    date: new Date('2026-04-02'), month: 'Abr/26' },
  { id: 'ORD-013', customerId: 'C12', customerName: 'Palmeira Fashion',   state: 'PE', city: 'Recife',          status: 'DELIVERED',  total: 3120,  fulfilledTotal: 2808,  items: 14, fulfilledItems: 12, paymentMethod: 'PIX',    date: new Date('2026-04-03'), month: 'Abr/26' },
  { id: 'ORD-014', customerId: 'C13', customerName: 'Ipê Boutique',       state: 'DF', city: 'Brasília',        status: 'SHIPPED',    total: 6300,  fulfilledTotal: 5670,  items: 26, fulfilledItems: 23, paymentMethod: 'CARTÃO', date: new Date('2026-04-04'), month: 'Abr/26' },
  { id: 'ORD-015', customerId: 'C03', customerName: 'Casa Nativa',        state: 'MG', city: 'Belo Horizonte',  status: 'PENDING',    total: 2940,  fulfilledTotal: 0,     items: 12, fulfilledItems: 0,  paymentMethod: 'BOLETO', date: new Date('2026-04-05'), month: 'Abr/26' },
  { id: 'ORD-016', customerId: 'C14', customerName: 'Coqueiro Moda',      state: 'CE', city: 'Fortaleza',       status: 'DELIVERED',  total: 2520,  fulfilledTotal: 2268,  items: 10, fulfilledItems: 9,  paymentMethod: 'PIX',    date: new Date('2026-04-05'), month: 'Abr/26' },
  { id: 'ORD-017', customerId: 'C15', customerName: 'Serrana Style',      state: 'RS', city: 'Caxias do Sul',   status: 'INVOICED',   total: 3780,  fulfilledTotal: 3402,  items: 16, fulfilledItems: 14, paymentMethod: 'PIX',    date: new Date('2026-04-06'), month: 'Abr/26' },
  { id: 'ORD-018', customerId: 'C02', customerName: 'Brisa Tropical',     state: 'RJ', city: 'Rio de Janeiro',  status: 'CONFIRMED',  total: 3150,  fulfilledTotal: 2520,  items: 13, fulfilledItems: 10, paymentMethod: 'PIX',    date: new Date('2026-04-06'), month: 'Abr/26' },
  { id: 'ORD-019', customerId: 'C16', customerName: 'Andorinha Moda',     state: 'SP', city: 'Ribeirão Preto',  status: 'DELIVERED',  total: 4410,  fulfilledTotal: 3969,  items: 18, fulfilledItems: 16, paymentMethod: 'PIX',    date: new Date('2026-04-07'), month: 'Abr/26' },
  { id: 'ORD-020', customerId: 'C04', customerName: 'Onda Sul Moda',      state: 'RS', city: 'Porto Alegre',    status: 'PENDING',    total: 2100,  fulfilledTotal: 0,     items: 9,  fulfilledItems: 0,  paymentMethod: 'BOLETO', date: new Date('2026-04-07'), month: 'Abr/26' },
  { id: 'ORD-021', customerId: 'C17', customerName: 'Floral Elegância',   state: 'PR', city: 'Londrina',        status: 'DELIVERED',  total: 1890,  fulfilledTotal: 1701,  items: 8,  fulfilledItems: 7,  paymentMethod: 'PIX',    date: new Date('2026-04-07'), month: 'Abr/26' },
  { id: 'ORD-022', customerId: 'C18', customerName: 'Primavera Fashion',  state: 'SC', city: 'Joinville',       status: 'PROCESSING', total: 3360,  fulfilledTotal: 2688,  items: 14, fulfilledItems: 11, paymentMethod: 'PIX',    date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-023', customerId: 'C05', customerName: 'Vitoria Boutique',   state: 'PR', city: 'Curitiba',        status: 'DELIVERED',  total: 5040,  fulfilledTotal: 4536,  items: 21, fulfilledItems: 19, paymentMethod: 'PIX',    date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-024', customerId: 'C19', customerName: 'Âmbar Couture',      state: 'MG', city: 'Uberlândia',      status: 'SHIPPED',    total: 2730,  fulfilledTotal: 2457,  items: 11, fulfilledItems: 10, paymentMethod: 'CARTÃO', date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-025', customerId: 'C20', customerName: 'Nordeste Chic',      state: 'PB', city: 'João Pessoa',     status: 'DELIVERED',  total: 1680,  fulfilledTotal: 1680,  items: 7,  fulfilledItems: 7,  paymentMethod: 'PIX',    date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-026', customerId: 'C07', customerName: 'Itapoã Resortwear',  state: 'BA', city: 'Salvador',        status: 'PENDING',    total: 4200,  fulfilledTotal: 0,     items: 17, fulfilledItems: 0,  paymentMethod: 'PIX',    date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-027', customerId: 'C11', customerName: 'Arte & Moda',        state: 'SP', city: 'São Paulo',       status: 'DELIVERED',  total: 2940,  fulfilledTotal: 2646,  items: 12, fulfilledItems: 11, paymentMethod: 'PIX',    date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-028', customerId: 'C08', customerName: 'Cerrado Chic',       state: 'GO', city: 'Goiânia',         status: 'CONFIRMED',  total: 1470,  fulfilledTotal: 1176,  items: 6,  fulfilledItems: 5,  paymentMethod: 'BOLETO', date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-029', customerId: 'C13', customerName: 'Ipê Boutique',       state: 'DF', city: 'Brasília',        status: 'PROCESSING', total: 7350,  fulfilledTotal: 6615,  items: 30, fulfilledItems: 27, paymentMethod: 'CARTÃO', date: new Date('2026-04-08'), month: 'Abr/26' },
  { id: 'ORD-030', customerId: 'C01', customerName: 'Aurora Concept',     state: 'SP', city: 'São Paulo',       status: 'PENDING',    total: 3150,  fulfilledTotal: 0,     items: 13, fulfilledItems: 0,  paymentMethod: 'PIX',    date: new Date('2026-04-08'), month: 'Abr/26' },
]

// ─── Customers ────────────────────────────────────────────────────────────────
export const DASHBOARD_CUSTOMERS: DCustomer[] = [
  { id: 'C01', name: 'Aurora Concept',    email: 'marina@aurora.com',    state: 'SP', city: 'São Paulo',       segment: 'Moda feminina', status: 'active',   rfmSegment: 'Champions',  registeredAt: new Date('2025-09-10'), firstPurchaseAt: new Date('2025-09-18'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 5, totalRevenue: 18640, totalRequested: 21000, avgTicket: 3728, frequency: 42, daysToPurchase: 8,    assignedSellerName: 'Ana Santos' },
  { id: 'C02', name: 'Brisa Tropical',    email: 'paulo@brisa.com',      state: 'RJ', city: 'Rio de Janeiro',  segment: 'Resortwear',    status: 'active',   rfmSegment: 'Loyal',      registeredAt: new Date('2025-10-03'), firstPurchaseAt: new Date('2025-10-14'), lastPurchaseAt: new Date('2026-04-06'), totalOrders: 3, totalRevenue: 7798,  totalRequested: 9799,  avgTicket: 2599, frequency: 60, daysToPurchase: 11,   assignedSellerName: 'Maria Silva' },
  { id: 'C03', name: 'Casa Nativa',       email: 'luciana@casanativa.com', state: 'MG', city: 'Belo Horizonte', segment: 'Multimarcas',  status: 'active',   rfmSegment: 'Loyal',      registeredAt: new Date('2025-08-20'), firstPurchaseAt: new Date('2025-09-01'), lastPurchaseAt: new Date('2026-04-05'), totalOrders: 4, totalRevenue: 14040, totalRequested: 15780, avgTicket: 3510, frequency: 55, daysToPurchase: 12,   assignedSellerName: 'Julia Costa' },
  { id: 'C04', name: 'Onda Sul Moda',     email: 'onda@sul.com',         state: 'RS', city: 'Porto Alegre',    segment: 'Casual feminino', status: 'active', rfmSegment: 'Promising',  registeredAt: new Date('2025-11-15'), firstPurchaseAt: new Date('2025-12-01'), lastPurchaseAt: new Date('2026-04-07'), totalOrders: 3, totalRevenue: 9960,  totalRequested: 12600, avgTicket: 3320, frequency: 65, daysToPurchase: 16,   assignedSellerName: 'Carla Lima' },
  { id: 'C05', name: 'Vitoria Boutique',  email: 'vitoria@boutique.com', state: 'PR', city: 'Curitiba',        segment: 'Moda feminina', status: 'active',   rfmSegment: 'Champions',  registeredAt: new Date('2025-07-05'), firstPurchaseAt: new Date('2025-07-11'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 6, totalRevenue: 22160, totalRequested: 24800, avgTicket: 3693, frequency: 38, daysToPurchase: 6,    assignedSellerName: 'Ana Santos' },
  { id: 'C06', name: 'Mar Azul Fashion',  email: 'marazul@fashion.com',  state: 'SC', city: 'Florianópolis',   segment: 'Praia e resort', status: 'active',  rfmSegment: 'Promising',  registeredAt: new Date('2026-02-10'), firstPurchaseAt: new Date('2026-02-25'), lastPurchaseAt: new Date('2026-03-18'), totalOrders: 1, totalRevenue: 0,     totalRequested: 1890,  avgTicket: 0,    frequency: 0,  daysToPurchase: 15,   assignedSellerName: 'Maria Silva' },
  { id: 'C07', name: 'Itapoã Resortwear', email: 'itapoa@resort.com',   state: 'BA', city: 'Salvador',        segment: 'Resortwear',    status: 'active',   rfmSegment: 'Loyal',      registeredAt: new Date('2025-09-28'), firstPurchaseAt: new Date('2025-10-10'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 3, totalRevenue: 7740,  totalRequested: 11940, avgTicket: 2580, frequency: 58, daysToPurchase: 12,   assignedSellerName: 'Julia Costa' },
  { id: 'C08', name: 'Cerrado Chic',      email: 'cerrado@chic.com',     state: 'GO', city: 'Goiânia',         segment: 'Multimarcas',   status: 'active',   rfmSegment: 'Promising',  registeredAt: new Date('2025-12-01'), firstPurchaseAt: new Date('2025-12-20'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 2, totalRevenue: 2926,  totalRequested: 3570,  avgTicket: 1463, frequency: 98, daysToPurchase: 19,   assignedSellerName: 'Carla Lima' },
  { id: 'C09', name: 'Pindaíba Store',    email: 'pindaiba@store.com',   state: 'SP', city: 'Campinas',        segment: 'Casual feminino', status: 'inactive', rfmSegment: 'At Risk',   registeredAt: new Date('2025-10-15'), firstPurchaseAt: null,                  lastPurchaseAt: null,                  totalOrders: 1, totalRevenue: 0,     totalRequested: 2800,  avgTicket: 0,    frequency: 0,  daysToPurchase: null },
  { id: 'C10', name: 'Encanto Feminino',  email: 'encanto@fem.com',      state: 'RJ', city: 'Niterói',         segment: 'Moda feminina', status: 'active',   rfmSegment: 'Loyal',      registeredAt: new Date('2025-11-10'), firstPurchaseAt: new Date('2025-11-22'), lastPurchaseAt: new Date('2026-04-01'), totalOrders: 2, totalRevenue: 4880,  totalRequested: 5600,  avgTicket: 2440, frequency: 80, daysToPurchase: 12,   assignedSellerName: 'Maria Silva' },
  { id: 'C11', name: 'Arte & Moda',       email: 'arte@moda.com',        state: 'SP', city: 'São Paulo',       segment: 'Moda feminina', status: 'active',   rfmSegment: 'Champions',  registeredAt: new Date('2025-06-15'), firstPurchaseAt: new Date('2025-06-20'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 7, totalRevenue: 28200, totalRequested: 31500, avgTicket: 4028, frequency: 30, daysToPurchase: 5,    assignedSellerName: 'Ana Santos' },
  { id: 'C12', name: 'Palmeira Fashion',  email: 'palmeira@fashion.com', state: 'PE', city: 'Recife',          segment: 'Moda feminina', status: 'active',   rfmSegment: 'Loyal',      registeredAt: new Date('2025-10-20'), firstPurchaseAt: new Date('2025-11-05'), lastPurchaseAt: new Date('2026-04-03'), totalOrders: 3, totalRevenue: 8680,  totalRequested: 9800,  avgTicket: 2893, frequency: 62, daysToPurchase: 16,   assignedSellerName: 'Maria Silva' },
  { id: 'C13', name: 'Ipê Boutique',      email: 'ipe@boutique.com',     state: 'DF', city: 'Brasília',        segment: 'Alto padrão',   status: 'active',   rfmSegment: 'Champions',  registeredAt: new Date('2025-08-01'), firstPurchaseAt: new Date('2025-08-08'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 5, totalRevenue: 29360, totalRequested: 33600, avgTicket: 5872, frequency: 45, daysToPurchase: 7,    assignedSellerName: 'Ana Santos' },
  { id: 'C14', name: 'Coqueiro Moda',     email: 'coqueiro@moda.com',    state: 'CE', city: 'Fortaleza',       segment: 'Casual feminino', status: 'active', rfmSegment: 'Promising',  registeredAt: new Date('2026-01-10'), firstPurchaseAt: new Date('2026-01-28'), lastPurchaseAt: new Date('2026-04-05'), totalOrders: 2, totalRevenue: 4914,  totalRequested: 5880,  avgTicket: 2457, frequency: 68, daysToPurchase: 18,   assignedSellerName: 'Julia Costa' },
  { id: 'C15', name: 'Serrana Style',     email: 'serrana@style.com',    state: 'RS', city: 'Caxias do Sul',   segment: 'Casual feminino', status: 'active', rfmSegment: 'Loyal',      registeredAt: new Date('2025-09-05'), firstPurchaseAt: new Date('2025-09-20'), lastPurchaseAt: new Date('2026-04-06'), totalOrders: 4, totalRevenue: 13620, totalRequested: 15120, avgTicket: 3405, frequency: 52, daysToPurchase: 15,   assignedSellerName: 'Julia Costa' },
  { id: 'C16', name: 'Andorinha Moda',    email: 'andorinha@moda.com',   state: 'SP', city: 'Ribeirão Preto',  segment: 'Moda feminina', status: 'active',   rfmSegment: 'Loyal',      registeredAt: new Date('2025-11-20'), firstPurchaseAt: new Date('2025-12-04'), lastPurchaseAt: new Date('2026-04-07'), totalOrders: 3, totalRevenue: 11110, totalRequested: 12600, avgTicket: 3703, frequency: 55, daysToPurchase: 14,   assignedSellerName: 'Carla Lima' },
  { id: 'C17', name: 'Floral Elegância',  email: 'floral@eleg.com',      state: 'PR', city: 'Londrina',        segment: 'Moda feminina', status: 'at_risk',  rfmSegment: 'At Risk',    registeredAt: new Date('2025-10-01'), firstPurchaseAt: new Date('2025-10-18'), lastPurchaseAt: new Date('2026-04-07'), totalOrders: 2, totalRevenue: 4890,  totalRequested: 5880,  avgTicket: 2445, frequency: 120, daysToPurchase: 17,   assignedSellerName: 'Carla Lima' },
  { id: 'C18', name: 'Primavera Fashion', email: 'primavera@fashion.com', state: 'SC', city: 'Joinville',      segment: 'Casual feminino', status: 'active', rfmSegment: 'Promising',  registeredAt: new Date('2026-02-01'), firstPurchaseAt: new Date('2026-02-18'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 1, totalRevenue: 2688,  totalRequested: 3360,  avgTicket: 2688, frequency: 0,  daysToPurchase: 17,   assignedSellerName: 'Ana Santos' },
  { id: 'C19', name: 'Âmbar Couture',     email: 'ambar@couture.com',    state: 'MG', city: 'Uberlândia',      segment: 'Alto padrão',   status: 'active',   rfmSegment: 'Promising',  registeredAt: new Date('2025-12-15'), firstPurchaseAt: new Date('2026-01-08'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 2, totalRevenue: 5850,  totalRequested: 6720,  avgTicket: 2925, frequency: 90, daysToPurchase: 24,   assignedSellerName: 'Carla Lima' },
  { id: 'C20', name: 'Nordeste Chic',     email: 'nordeste@chic.com',    state: 'PB', city: 'João Pessoa',     segment: 'Casual feminino', status: 'active', rfmSegment: 'Promising',  registeredAt: new Date('2026-01-20'), firstPurchaseAt: new Date('2026-02-08'), lastPurchaseAt: new Date('2026-04-08'), totalOrders: 2, totalRevenue: 3360,  totalRequested: 3920,  avgTicket: 1680, frequency: 58, daysToPurchase: 19 },
  { id: 'C21', name: 'Suave Moda',        email: 'suave@moda.com',       state: 'SP', city: 'São Paulo',       segment: 'Moda feminina', status: 'at_risk',  rfmSegment: 'At Risk',    registeredAt: new Date('2025-07-10'), firstPurchaseAt: new Date('2025-07-25'), lastPurchaseAt: new Date('2025-12-10'), totalOrders: 2, totalRevenue: 6200,  totalRequested: 7800,  avgTicket: 3100, frequency: 130, daysToPurchase: 15,   assignedSellerName: 'Ana Santos' },
  { id: 'C22', name: 'Veludo Rosa',       email: 'veludo@rosa.com',      state: 'RJ', city: 'Rio de Janeiro',  segment: 'Alto padrão',   status: 'inactive', rfmSegment: 'Lost',       registeredAt: new Date('2025-06-01'), firstPurchaseAt: new Date('2025-06-12'), lastPurchaseAt: new Date('2025-08-20'), totalOrders: 1, totalRevenue: 3800,  totalRequested: 4200,  avgTicket: 3800, frequency: 0,  daysToPurchase: 11,   assignedSellerName: 'Maria Silva' },
  { id: 'C23', name: 'Aconchego Fashion', email: 'aconchego@fashion.com', state: 'MG', city: 'Belo Horizonte', segment: 'Casual feminino', status: 'inactive', rfmSegment: 'Lost',     registeredAt: new Date('2025-05-15'), firstPurchaseAt: new Date('2025-05-28'), lastPurchaseAt: new Date('2025-07-15'), totalOrders: 2, totalRevenue: 4100,  totalRequested: 5200,  avgTicket: 2050, frequency: 0,  daysToPurchase: 13,   assignedSellerName: 'Maria Silva' },
  { id: 'C24', name: 'Bruma Elegante',    email: 'bruma@eleg.com',       state: 'RS', city: 'Gramado',         segment: 'Alto padrão',   status: 'at_risk',  rfmSegment: 'At Risk',    registeredAt: new Date('2025-08-30'), firstPurchaseAt: new Date('2025-09-14'), lastPurchaseAt: new Date('2026-01-05'), totalOrders: 2, totalRevenue: 7200,  totalRequested: 8400,  avgTicket: 3600, frequency: 100, daysToPurchase: 15,   assignedSellerName: 'Carla Lima' },
  { id: 'C25', name: 'Jasmim Boutique',   email: 'jasmim@boutique.com',  state: 'PR', city: 'Maringá',         segment: 'Moda feminina', status: 'active',   rfmSegment: 'Loyal',      registeredAt: new Date('2025-10-12'), firstPurchaseAt: new Date('2025-10-25'), lastPurchaseAt: new Date('2026-03-30'), totalOrders: 3, totalRevenue: 9800,  totalRequested: 11200, avgTicket: 3267, frequency: 60, daysToPurchase: 13,   assignedSellerName: 'Julia Costa' },
]

// ─── Products ─────────────────────────────────────────────────────────────────
export const DASHBOARD_PRODUCTS: DProduct[] = [
  {
    id: 'P01', name: 'Vestido Midi Linho', sku: 'VML-001', category: 'Vestidos', basePrice: 289.9,
    revenueRequested: 68400, revenueFulfilled: 58140, unitsRequested: 236, unitsFulfilled: 201, stock: 42, dailySales: 6, daysLeft: 7, curve: 'A',
    sizes: [{ size: 'P', units: 58 }, { size: 'M', units: 72 }, { size: 'G', units: 52 }, { size: 'GG', units: 19 }],
    colors: [{ color: 'Areia', hex: '#d8c3ab', units: 102 }, { color: 'Branco', hex: '#f9f7f3', units: 74 }, { color: 'Terracota', hex: '#c4622d', units: 25 }],
    monthlyRevenue: [{ month: 'Jan', value: 7200 }, { month: 'Fev', value: 9400 }, { month: 'Mar', value: 12600 }, { month: 'Abr', value: 14800 }],
  },
  {
    id: 'P02', name: 'Blazer Florença', sku: 'BLZ-002', category: 'Blazers', basePrice: 349.9,
    revenueRequested: 54600, revenueFulfilled: 47040, unitsRequested: 156, unitsFulfilled: 134, stock: 18, dailySales: 5, daysLeft: 4, curve: 'A',
    sizes: [{ size: 'P', units: 38 }, { size: 'M', units: 52 }, { size: 'G', units: 44 }],
    colors: [{ color: 'Preto', hex: '#1c1c1c', units: 88 }, { color: 'Caramelo', hex: '#c68642', units: 46 }],
    monthlyRevenue: [{ month: 'Jan', value: 8400 }, { month: 'Fev', value: 11200 }, { month: 'Mar', value: 16800 }, { month: 'Abr', value: 18200 }],
  },
  {
    id: 'P03', name: 'Calça Wide Leg', sku: 'CWL-003', category: 'Calças', basePrice: 259.9,
    revenueRequested: 41600, revenueFulfilled: 37440, unitsRequested: 160, unitsFulfilled: 144, stock: 28, dailySales: 4, daysLeft: 7, curve: 'A',
    sizes: [{ size: '36', units: 32 }, { size: '38', units: 48 }, { size: '40', units: 38 }, { size: '42', units: 26 }],
    colors: [{ color: 'Off White', hex: '#f3eee4', units: 80 }, { color: 'Bege', hex: '#c8a97e', units: 64 }],
    monthlyRevenue: [{ month: 'Jan', value: 5600 }, { month: 'Fev', value: 8800 }, { month: 'Mar', value: 12400 }, { month: 'Abr', value: 14800 }],
  },
  {
    id: 'P04', name: 'Conjunto Riviera', sku: 'CRV-004', category: 'Conjuntos', basePrice: 399.9,
    revenueRequested: 32800, revenueFulfilled: 28720, unitsRequested: 82, unitsFulfilled: 72, stock: 35, dailySales: 3, daysLeft: 12, curve: 'B',
    sizes: [{ size: 'P', units: 22 }, { size: 'M', units: 30 }, { size: 'G', units: 20 }],
    colors: [{ color: 'Verde Água', hex: '#7cb9c5', units: 42 }, { color: 'Coral', hex: '#f08080', units: 30 }],
    monthlyRevenue: [{ month: 'Jan', value: 4200 }, { month: 'Fev', value: 6800 }, { month: 'Mar', value: 9600 }, { month: 'Abr', value: 12200 }],
  },
  {
    id: 'P05', name: 'Blusa Ciganinha', sku: 'BCG-005', category: 'Blusas', basePrice: 149.9,
    revenueRequested: 27000, revenueFulfilled: 24300, unitsRequested: 180, unitsFulfilled: 162, stock: 94, dailySales: 5, daysLeft: 19, curve: 'B',
    sizes: [{ size: 'P', units: 52 }, { size: 'M', units: 68 }, { size: 'G', units: 42 }],
    colors: [{ color: 'Branco', hex: '#f9f7f3', units: 90 }, { color: 'Preto', hex: '#1c1c1c', units: 72 }],
    monthlyRevenue: [{ month: 'Jan', value: 3800 }, { month: 'Fev', value: 5400 }, { month: 'Mar', value: 7800 }, { month: 'Abr', value: 10000 }],
  },
  {
    id: 'P06', name: 'Saia Midi Plissada', sku: 'SMP-006', category: 'Saias', basePrice: 219.9,
    revenueRequested: 22000, revenueFulfilled: 19800, unitsRequested: 100, unitsFulfilled: 90, stock: 120, dailySales: 3, daysLeft: 40, curve: 'B',
    sizes: [{ size: 'P', units: 24 }, { size: 'M', units: 38 }, { size: 'G', units: 28 }],
    colors: [{ color: 'Rosê', hex: '#e8a9a9', units: 52 }, { color: 'Azul Índigo', hex: '#4b6587', units: 38 }],
    monthlyRevenue: [{ month: 'Jan', value: 2800 }, { month: 'Fev', value: 4600 }, { month: 'Mar', value: 7200 }, { month: 'Abr', value: 7400 }],
  },
  {
    id: 'P07', name: 'Shorts Sarja', sku: 'SSA-007', category: 'Shorts', basePrice: 129.9,
    revenueRequested: 14300, revenueFulfilled: 12870, unitsRequested: 110, unitsFulfilled: 99, stock: 210, dailySales: 4, daysLeft: 53, curve: 'C',
    sizes: [{ size: '36', units: 28 }, { size: '38', units: 36 }, { size: '40', units: 28 }, { size: '42', units: 7 }],
    colors: [{ color: 'Areia', hex: '#d8c3ab', units: 65 }, { color: 'Branco', hex: '#f9f7f3', units: 34 }],
    monthlyRevenue: [{ month: 'Jan', value: 1800 }, { month: 'Fev', value: 2800 }, { month: 'Mar', value: 4200 }, { month: 'Abr', value: 5500 }],
  },
  {
    id: 'P08', name: 'Top Cropped Ribana', sku: 'TCR-008', category: 'Tops', basePrice: 89.9,
    revenueRequested: 8900, revenueFulfilled: 8010, unitsRequested: 99, unitsFulfilled: 89, stock: 312, dailySales: 3, daysLeft: 104, curve: 'C',
    sizes: [{ size: 'P', units: 32 }, { size: 'M', units: 38 }, { size: 'G', units: 19 }],
    colors: [{ color: 'Preto', hex: '#1c1c1c', units: 50 }, { color: 'Branco', hex: '#f9f7f3', units: 39 }],
    monthlyRevenue: [{ month: 'Jan', value: 1200 }, { month: 'Fev', value: 1800 }, { month: 'Mar', value: 2600 }, { month: 'Abr', value: 3300 }],
  },
  {
    id: 'P09', name: 'Regata Premium', sku: 'RPM-009', category: 'Regatas', basePrice: 79.9,
    revenueRequested: 6400, revenueFulfilled: 5760, unitsRequested: 80, unitsFulfilled: 72, stock: 420, dailySales: 3, daysLeft: 140, curve: 'C',
    sizes: [{ size: 'P', units: 22 }, { size: 'M', units: 30 }, { size: 'G', units: 20 }],
    colors: [{ color: 'Branco', hex: '#f9f7f3', units: 42 }, { color: 'Areia', hex: '#d8c3ab', units: 30 }],
    monthlyRevenue: [{ month: 'Jan', value: 800 }, { month: 'Fev', value: 1200 }, { month: 'Mar', value: 2000 }, { month: 'Abr', value: 2400 }],
  },
  {
    id: 'P10', name: 'Vestido Festa Serena', sku: 'VFS-010', category: 'Vestidos', basePrice: 499.9,
    revenueRequested: 25000, revenueFulfilled: 22500, unitsRequested: 50, unitsFulfilled: 45, stock: 8, dailySales: 2, daysLeft: 4, curve: 'A',
    sizes: [{ size: 'P', units: 12 }, { size: 'M', units: 18 }, { size: 'G', units: 15 }],
    colors: [{ color: 'Dourado', hex: '#d4af37', units: 24 }, { color: 'Preto', hex: '#1c1c1c', units: 21 }],
    monthlyRevenue: [{ month: 'Jan', value: 3500 }, { month: 'Fev', value: 5000 }, { month: 'Mar', value: 7500 }, { month: 'Abr', value: 9000 }],
  },
]

// ─── Geographic ───────────────────────────────────────────────────────────────
export const GEO_DATA: DGeoEntry[] = [
  { state: 'São Paulo',        stateCode: 'SP', customers: 7,  orders: 10, requested: 312400, fulfilled: 271000, cities: [{ city: 'São Paulo', customers: 5, revenue: 212400 }, { city: 'Campinas', customers: 1, revenue: 28000 }, { city: 'Ribeirão Preto', customers: 1, revenue: 49000 }] },
  { state: 'Rio de Janeiro',   stateCode: 'RJ', customers: 4,  orders: 5,  requested: 148600, fulfilled: 127200, cities: [{ city: 'Rio de Janeiro', customers: 3, revenue: 108600 }, { city: 'Niterói', customers: 1, revenue: 40000 }] },
  { state: 'Minas Gerais',     stateCode: 'MG', customers: 4,  orders: 5,  requested: 131200, fulfilled: 114800, cities: [{ city: 'Belo Horizonte', customers: 2, revenue: 84200 }, { city: 'Uberlândia', customers: 1, revenue: 28200 }, { city: 'Gramado', customers: 1, revenue: 18800 }] },
  { state: 'Rio Grande do Sul', stateCode: 'RS', customers: 4, orders: 4,  requested: 110800, fulfilled: 96200,  cities: [{ city: 'Porto Alegre', customers: 2, revenue: 62800 }, { city: 'Caxias do Sul', customers: 1, revenue: 28600 }, { city: 'Gramado', customers: 1, revenue: 19400 }] },
  { state: 'Paraná',           stateCode: 'PR', customers: 4,  orders: 4,  requested: 91400,  fulfilled: 79800,  cities: [{ city: 'Curitiba', customers: 2, revenue: 52400 }, { city: 'Londrina', customers: 1, revenue: 19600 }, { city: 'Maringá', customers: 1, revenue: 19400 }] },
  { state: 'Distrito Federal', stateCode: 'DF', customers: 1,  orders: 2,  requested: 82600,  fulfilled: 74200,  cities: [{ city: 'Brasília', customers: 1, revenue: 82600 }] },
  { state: 'Santa Catarina',   stateCode: 'SC', customers: 2,  orders: 2,  requested: 51600,  fulfilled: 44200,  cities: [{ city: 'Florianópolis', customers: 1, revenue: 28400 }, { city: 'Joinville', customers: 1, revenue: 23200 }] },
  { state: 'Bahia',            stateCode: 'BA', customers: 1,  orders: 2,  requested: 47400,  fulfilled: 40400,  cities: [{ city: 'Salvador', customers: 1, revenue: 47400 }] },
  { state: 'Pernambuco',       stateCode: 'PE', customers: 1,  orders: 1,  requested: 31200,  fulfilled: 28080,  cities: [{ city: 'Recife', customers: 1, revenue: 31200 }] },
  { state: 'Ceará',            stateCode: 'CE', customers: 1,  orders: 1,  requested: 25200,  fulfilled: 22680,  cities: [{ city: 'Fortaleza', customers: 1, revenue: 25200 }] },
  { state: 'Goiás',            stateCode: 'GO', customers: 1,  orders: 2,  requested: 21400,  fulfilled: 17800,  cities: [{ city: 'Goiânia', customers: 1, revenue: 21400 }] },
  { state: 'Paraíba',          stateCode: 'PB', customers: 1,  orders: 1,  requested: 16800,  fulfilled: 16800,  cities: [{ city: 'João Pessoa', customers: 1, revenue: 16800 }] },
]

// ─── RFM ──────────────────────────────────────────────────────────────────────
export const RFM_DATA: DRFMEntry[] = [
  { segment: 'Champions',  count: 5,  color: '#10b981', bgColor: '#d1fae5', pct: 20, avgRevenue: 22000, description: 'Compram com alta frequência e alto valor. Seu melhor grupo.' },
  { segment: 'Loyal',      count: 8,  color: '#3b82f6', bgColor: '#dbeafe', pct: 32, avgRevenue: 9800,  description: 'Compram regularmente, boa base de sustentação da receita.' },
  { segment: 'Promising',  count: 7,  color: '#a855f7', bgColor: '#f3e8ff', pct: 28, avgRevenue: 4200,  description: 'Clientes recentes com potencial de crescimento.' },
  { segment: 'At Risk',    count: 3,  color: '#f59e0b', bgColor: '#fef3c7', pct: 12, avgRevenue: 6100,  description: 'Já foram bons mas o engajamento caiu. Precisam de atenção.' },
  { segment: 'Lost',       count: 2,  color: '#ef4444', bgColor: '#fee2e2', pct: 8,  avgRevenue: 3950,  description: 'Sem atividade há mais de 180 dias. Difícil recuperação.' },
]

// ─── Cohort ───────────────────────────────────────────────────────────────────
export const COHORT_DATA: DCohortRow[] = [
  { cohort: 'Mai/25', months: [100, 71, 57, 50, 43, 38, 36, 33] },
  { cohort: 'Jun/25', months: [100, 68, 55, 47, 41, 38, 35, null] },
  { cohort: 'Jul/25', months: [100, 75, 62, 54, 48, 43, null, null] },
  { cohort: 'Ago/25', months: [100, 72, 58, 50, 44, null, null, null] },
  { cohort: 'Set/25', months: [100, 69, 56, 48, null, null, null, null] },
  { cohort: 'Out/25', months: [100, 67, 52, null, null, null, null, null] },
  { cohort: 'Nov/25', months: [100, 73, null, null, null, null, null, null] },
  { cohort: 'Dez/25', months: [100, 78, null, null, null, null, null, null] },
  { cohort: 'Jan/26', months: [100, 74, null, null, null, null, null, null] },
  { cohort: 'Fev/26', months: [100, null, null, null, null, null, null, null] },
  { cohort: 'Mar/26', months: [100, null, null, null, null, null, null, null] },
  { cohort: 'Abr/26', months: [100, null, null, null, null, null, null, null] },
]

// ─── Sales Funnel ─────────────────────────────────────────────────────────────
export const FUNNEL_DATA: DFunnelStage[] = [
  { label: 'Cadastros Aprovados',     value: 25, pct: 100, color: '#6366f1' },
  { label: 'Realizaram 1º Pedido',    value: 22, pct: 88,  color: '#8b5cf6' },
  { label: 'Pedido Atendido',         value: 19, pct: 76,  color: '#a855f7' },
  { label: 'Compraram 2x ou mais',    value: 14, pct: 56,  color: '#c084fc' },
  { label: 'Compraram 3x ou mais',    value: 9,  pct: 36,  color: '#d8b4fe' },
]

// ─── Seasonality ──────────────────────────────────────────────────────────────
export const SEASONALITY_BY_CATEGORY = [
  { category: 'Vestidos',   jan: 18, fev: 22, mar: 28, abr: 34, mai: 38, jun: 32, jul: 26, ago: 22, set: 24, out: 20, nov: 28, dez: 42 },
  { category: 'Blazers',    jan: 30, fev: 28, mar: 32, abr: 38, mai: 32, jun: 28, jul: 34, ago: 38, set: 42, out: 36, nov: 32, dez: 28 },
  { category: 'Conjuntos',  jan: 22, fev: 26, mar: 30, abr: 28, mai: 32, jun: 28, jul: 30, ago: 34, set: 32, out: 26, nov: 28, dez: 36 },
  { category: 'Blusas',     jan: 24, fev: 28, mar: 32, abr: 30, mai: 26, jun: 22, jul: 24, ago: 28, set: 32, out: 34, nov: 38, dez: 42 },
]

export const SEASONALITY_ORDERS_BY_MONTH = [
  { month: 'Jan', orders: 26 }, { month: 'Fev', orders: 34 }, { month: 'Mar', orders: 37 },
  { month: 'Abr', orders: 41 }, { month: 'Mai', orders: 38 }, { month: 'Jun', orders: 32 },
  { month: 'Jul', orders: 28 }, { month: 'Ago', orders: 31 }, { month: 'Set', orders: 35 },
  { month: 'Out', orders: 29 }, { month: 'Nov', orders: 33 }, { month: 'Dez', orders: 44 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function fmt(v: number, compact = false) {
  if (compact && v >= 1000) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 1, minimumFractionDigits: 0, notation: 'compact' }).format(v)
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

export function fmtN(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v)
}

export function fmtPct(v: number) {
  return `${v.toFixed(1)}%`
}

export const STATUS_LABELS: Record<DOrderStatus, string> = {
  PENDING: 'Pendente', CONFIRMED: 'Confirmado', PROCESSING: 'Processando',
  INVOICED: 'Faturado', SHIPPED: 'Enviado', DELIVERED: 'Entregue', CANCELLED: 'Cancelado',
}

export const CURVE_COLORS: Record<DCurve, { bg: string; text: string }> = {
  A: { bg: '#d1fae5', text: '#065f46' },
  B: { bg: '#fef3c7', text: '#92400e' },
  C: { bg: '#f3f4f6', text: '#374151' },
}

// Aggregate totals for the current period (Abr/26 = most recent)
export const TOTALS = (() => {
  const allOrders = DASHBOARD_ORDERS
  const activeOrders = allOrders.filter(o => o.status !== 'CANCELLED')
  const delivered = allOrders.filter(o => o.status === 'DELIVERED')

  const totalRequested = activeOrders.reduce((s, o) => s + o.total, 0)
  const totalFulfilled = activeOrders.reduce((s, o) => s + o.fulfilledTotal, 0)
  const fulfillmentRate = totalRequested > 0 ? (totalFulfilled / totalRequested) * 100 : 0

  const approvedCustomers = DASHBOARD_CUSTOMERS.length
  const purchasedCustomers = DASHBOARD_CUSTOMERS.filter(c => c.firstPurchaseAt !== null).length
  const activeCustomers = DASHBOARD_CUSTOMERS.filter(c => c.status === 'active').length
  const newCustomers = DASHBOARD_CUSTOMERS.filter(c => {
    const d = c.registeredAt
    return d >= new Date('2026-03-01')
  }).length
  const returningCustomers = DASHBOARD_CUSTOMERS.filter(c => c.totalOrders >= 2).length

  const conversionRate = approvedCustomers > 0 ? (purchasedCustomers / approvedCustomers) * 100 : 0
  const avgTicket = activeOrders.length > 0 ? totalFulfilled / activeOrders.length : 0

  const daysToFirstPurchase = DASHBOARD_CUSTOMERS
    .filter(c => c.daysToPurchase !== null)
    .map(c => c.daysToPurchase as number)
  const avgDaysToFirstPurchase = daysToFirstPurchase.length > 0
    ? daysToFirstPurchase.reduce((s, v) => s + v, 0) / daysToFirstPurchase.length
    : 0

  const repeatRate = DASHBOARD_CUSTOMERS.filter(c => c.totalOrders >= 2).length / Math.max(purchasedCustomers, 1) * 100

  return {
    totalRequested,
    totalFulfilled,
    fulfillmentRate,
    totalOrders: allOrders.length,
    activeOrders: activeOrders.length,
    deliveredOrders: delivered.length,
    pendingOrders: allOrders.filter(o => o.status === 'PENDING').length,
    approvedCustomers,
    purchasedCustomers,
    activeCustomers,
    newCustomers,
    returningCustomers,
    conversionRate,
    avgTicket,
    avgDaysToFirstPurchase,
    repeatRate,
  }
})()
