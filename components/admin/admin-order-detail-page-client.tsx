"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Package,
  Check,
  Trash2,
  RotateCcw,
  Edit,
  Save,
  X,
  Search,
  FileText,
  Printer,
  Send,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  Activity,
  DollarSign,
  Boxes,
  Percent,
  CircleHelp,
  CheckCheck,
} from "lucide-react";
import {
  getOrderDetailAction,
  updateOrderAction,
  addOrderItemAction,
  removeOrderItemAction,
  updateOrderItemAction,
} from "@/lib/actions/orders";
import { getCustomerDetailAction } from "@/lib/actions/customers";
import { getSiteSettingsAction } from "@/lib/actions/settings";
import { getOrderProductVariantsCatalogAction, getProductFullAction } from "@/lib/actions/products";
import { INFINITE_STOCK_MAX_QTY } from "@/lib/stock-mode";
import type { Order, Customer, OrderItem, Product, StockMode, PaymentMethod } from "@/lib/types";
import CurrencyInput from "@/components/form/CurrencyInput";
import IntegerInput from "@/components/form/IntegerInput";
import OrderPaymentsCard from "@/components/admin/order-payments-card";
import { normalizeAdminLocale, tAdmin } from "@/lib/i18n/admin";
import { AdminPage } from "@/components/admin/admin-mobile-ui";
import FloatingActionMenu from "@/components/ui/floating-action-menu";
import { motion } from "framer-motion";

function getOrderStatusLabels(locale?: string): Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> {
  return {
    PENDING: { label: tAdmin(locale, "admin.orders.status.pending", "Pending"), variant: "secondary" },
    CONFIRMED: { label: tAdmin(locale, "admin.orders.status.confirmed", "Confirmed"), variant: "default" },
    PROCESSING: { label: tAdmin(locale, "admin.orders.status.processing", "Processing"), variant: "default" },
    INVOICED: { label: tAdmin(locale, "admin.orders.status.invoiced", "Invoiced"), variant: "default" },
    SHIPPED: { label: tAdmin(locale, "admin.orders.status.shipped", "Shipped"), variant: "default" },
    DELIVERED: { label: tAdmin(locale, "admin.orders.status.delivered", "Delivered"), variant: "default" },
    CANCELLED: { label: tAdmin(locale, "admin.orders.status.cancelled", "Cancelled"), variant: "destructive" },
  };
}

function getPaymentStatusLabels(locale?: string): Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> {
  return {
    PENDING: { label: tAdmin(locale, "admin.orders.paymentStatus.pending", "Pending"), variant: "secondary" },
    PAID: { label: tAdmin(locale, "admin.orders.paymentStatus.paid", "Paid"), variant: "default" },
    PARTIAL: { label: tAdmin(locale, "admin.orders.paymentStatus.partial", "Partial"), variant: "outline" },
    REFUNDED: { label: tAdmin(locale, "admin.orders.paymentStatus.refunded", "Refunded"), variant: "destructive" },
    CANCELLED: { label: tAdmin(locale, "admin.orders.paymentStatus.cancelled", "Cancelled"), variant: "destructive" },
  };
}

interface OrderWithExtras extends Order {
  items: OrderItem[];
  customer?: Customer;
}

interface AdminOrderDetailPageClientProps {
  locale?: string
  orderId: string
  initialOrder: OrderWithExtras | null
  initialCustomer: Customer | null
  initialProducts: Product[]
  initialAttributeLabels: {
    color: Record<string, string>
    size: Record<string, string>
  }
}

type ProductVariantOption = {
  id: string
  productId: string
  variantSku: string
  stock: number
  unitPrice: number
  color: string
  size: string
}

type ProductPreviewState = {
  productName: string
  imageUrl: string | null
  sku: string
  variants: Array<{
    variantKey: string
    attributes: Array<{ key: string; value: string }>
    requestedQty: number
    attendedQty: number
  }>
}

// ─── Color dot helpers ────────────────────────────────────────────────────────
const COLOR_DOT_MAP: Record<string, string> = {
  rosa: '#f9a8d4', pink: '#f9a8d4',
  vermelho: '#ef4444', red: '#ef4444',
  azul: '#3b82f6', blue: '#3b82f6',
  'azul marinho': '#1e3a5f', navy: '#1e3a5f',
  verde: '#22c55e', green: '#22c55e',
  preto: '#1f2937', black: '#1f2937',
  branco: '#f8fafc', white: '#f8fafc',
  cinza: '#9ca3af', gray: '#9ca3af', grey: '#9ca3af',
  amarelo: '#facc15', yellow: '#facc15',
  laranja: '#f97316', orange: '#f97316',
  roxo: '#a855f7', purple: '#a855f7',
  violeta: '#8b5cf6', lilás: '#c084fc',
  marrom: '#92400e', brown: '#92400e',
  bege: '#d4a96a', beige: '#d4a96a',
  caramelo: '#b45309', nude: '#e8c4a0',
  vinho: '#7f1d1d', burgundy: '#7f1d1d',
  dourado: '#d97706', gold: '#d97706',
  prata: '#94a3b8', silver: '#94a3b8',
  coral: '#fb7185', salmão: '#fca5a5',
  turquesa: '#06b6d4', mint: '#6ee7b7',
  off: '#fef9f0', creme: '#fef9f0',
}
function getColorDot(colorName: string | null): string {
  if (!colorName) return '#94a3b8'
  const key = colorName.toLowerCase().trim()
  if (COLOR_DOT_MAP[key]) return COLOR_DOT_MAP[key]
  // Try partial match
  for (const [k, v] of Object.entries(COLOR_DOT_MAP)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return '#94a3b8'
}

const SIZE_ORDER = [
  'PP', 'XS', 'P', 'S', 'M', 'G', 'L', 'GG', 'XL', 'G1', 'G2', 'G3', 'EG', 'EGG', 'XXL', 'XXXL',
  '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
  'P/M', 'M/G', 'G/GG', 'Único', 'U',
]

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'PIX', label: 'PIX' },
  { value: 'CARTAO_EXTERNO', label: 'Cartão' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'FATURADO', label: 'Faturado' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
]

function getPaymentMethodLabel(value?: PaymentMethod | null): string {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label || 'Selecionar'
}

// ─── Mock data for offline/demo mode ────────────────────────────────────────
// Helpers to build a complete mock OrderItem (all fields the renderer reads)
function mkItem(
  id: string, productId: string, nameSnapshot: string, skuSnapshot: string,
  colorSnapshot: string, sizeSnapshot: string, qty: number, unitPrice: number,
  fulfilled = false, originalQty?: number
) {
  return {
    id, productId, nameSnapshot, skuSnapshot,
    colorSnapshot, sizeSnapshot,
    qty, originalQty: originalQty ?? qty, unitPrice,
    total: (originalQty ?? qty) * unitPrice,
    fulfilled, status: fulfilled ? 'attended' : undefined,
    attendedQty: fulfilled ? qty : 0,
    variantAvailableQty: 999,
    assetId: null, assetImageUrl: null, imageUrl: null,
    origin: 'customer' as const,
  }
}

// Helpers to build a complete mock Customer
function mkCustomer(
  id: string, companyName: string, tradeName: string, cnpj: string,
  contactName: string, phone: string, email: string, state: string,
  street: string, city: string, zipCode: string
) {
  const createdAt = new Date('2023-06-15T10:00:00')
  return {
    id, companyName, tradeName, cnpj, contactName, phone, email, state,
    shippingStreet: street, shippingCity: city, shippingState: state,
    shippingZipCode: zipCode, shippingNumber: '100', shippingComplement: '',
    status: 'APPROVED', customerType: 'WHOLESALE',
    createdAt, updatedAt: new Date('2024-11-20T14:30:00'),
  }
}

const MOCK_DETAIL_CUSTOMERS: Record<string, ReturnType<typeof mkCustomer>> = {
  'mock-c1': mkCustomer('mock-c1', 'Boutique Elegance LTDA', 'Boutique Elegance', '12.345.678/0001-90', 'Ana Lima',     '(11) 99988-7766', 'compras@elegance.com.br',     'SP', 'Rua das Flores, 245',   'São Paulo',      '01310-100'),
  'mock-c2': mkCustomer('mock-c2', 'Moda Feminina SA',      'Moda Feminina',     '98.765.432/0001-10', 'Carla Santos', '(11) 98877-6655', 'pedidos@modafeminina.com.br',  'RJ', 'Av. Rio Branco, 800',   'Rio de Janeiro', '20040-020'),
  'mock-c3': mkCustomer('mock-c3', 'Casa da Moda ME',       'Casa da Moda',      '45.678.901/0001-23', 'Julia Ferreira','(31) 97766-5544','vendas@casadamoda.com.br',     'MG', 'Rua Bahia, 320',        'Belo Horizonte', '30160-010'),
  'mock-c4': mkCustomer('mock-c4', 'Style & Co LTDA',       'Style & Co',        '78.901.234/0001-56', 'Maria Souza',  '(11) 96655-4433', 'compras@styleco.com.br',       'SP', 'Av. Paulista, 1500',    'São Paulo',      '01310-200'),
  'mock-c5': mkCustomer('mock-c5', 'Fashion Plus ME',       'Fashion Plus',      '34.567.890/0001-78', 'Paula Costa',  '(41) 95544-3322', 'pedidos@fashionplus.com.br',   'PR', 'Rua XV de Novembro, 50','Curitiba',       '80020-310'),
  'mock-c6': mkCustomer('mock-c6', 'Luxo & Estilo LTDA',    'Luxo & Estilo',     '56.789.012/0001-34', 'Renata Oliveira','(51) 94433-2211','vendas@luxoestilo.com.br',    'RS', 'Av. Ipiranga, 6681',    'Porto Alegre',   '90619-900'),
}

function mkOrder(
  id: string, customerId: string, status: string, paymentStatus: string,
  items: ReturnType<typeof mkItem>[],
  opts: { notes?: string; internalNotes?: string; trackingCode?: string | null; shippingPrice?: number; discountTotal?: number; manualDiscount?: number; paymentMethod?: PaymentMethod; hoursAgo?: number } = {}
) {
  const c = MOCK_DETAIL_CUSTOMERS[customerId]
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const discountTotal = opts.discountTotal ?? 0
  const shippingPrice = opts.shippingPrice ?? 0
  const total = subtotal - discountTotal + shippingPrice
  return {
    id, customerId, status, paymentStatus,
    items, total, subtotal, fulfilledTotal: items.filter(i => i.fulfilled).reduce((s, i) => s + i.total, 0),
    discountTotal, manualDiscount: opts.manualDiscount ?? 0,
    couponDiscount: 0, tierDiscount: 0,
    shippingPrice,
    paymentMethod: opts.paymentMethod ?? 'PIX',
    trackingCode: opts.trackingCode ?? null, trackingUrl: '',
    totalItems: items.reduce((s, i) => s + (i.originalQty ?? i.qty), 0),
    fulfilledItems: items.filter(i => i.fulfilled).reduce((s, i) => s + i.qty, 0),
    notes: opts.notes ?? '', internalNotes: opts.internalNotes ?? '',
    // shipping address from customer
    shippingStreet: c?.shippingStreet ?? '', shippingNumber: c?.shippingNumber ?? '',
    shippingComplement: '', shippingCity: c?.shippingCity ?? '',
    shippingState: c?.shippingState ?? '', shippingZipCode: c?.shippingZipCode ?? '',
    createdAt: new Date(Date.now() - (opts.hoursAgo ?? 2) * 3600000),
    updatedAt: new Date(),
  }
}

const MOCK_ORDER_DETAILS: Record<string, ReturnType<typeof mkOrder>> = {
  'a1b2c3d4e5f6a1b2': mkOrder('a1b2c3d4e5f6a1b2', 'mock-c1', 'PENDING', 'PENDING', [
    mkItem('item-a1',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Rosa',    'PP',  4,  289.90),
    mkItem('item-a2',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Rosa',    'P',   6,  289.90),
    mkItem('item-a3',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Rosa',    'M',   8,  289.90),
    mkItem('item-a4',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Rosa',    'G',   6,  289.90),
    mkItem('item-a5',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Rosa',    'GG',  4,  289.90),
    mkItem('item-a6',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Azul',    'P',   4,  289.90),
    mkItem('item-a7',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Azul',    'M',   6,  289.90),
    mkItem('item-a8',  'p1', 'Vestido Floral Midi',  'VFM-001', 'Azul',    'G',   6,  289.90),
    mkItem('item-a9',  'p2', 'Blusa Crepe Premium',  'BCP-002', 'Branco',  'P',   6,  179.90),
    mkItem('item-a10', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Branco',  'M',   8,  179.90),
    mkItem('item-a11', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Branco',  'G',   4,  179.90),
    mkItem('item-a12', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Preto',   'P',   6,  179.90),
    mkItem('item-a13', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Preto',   'M',   6,  179.90),
    mkItem('item-a14', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Preto',   'G',   4,  179.90),
  ], { hoursAgo: 1.5 }),

  'b2c3d4e5f6a1b2c3': mkOrder('b2c3d4e5f6a1b2c3', 'mock-c2', 'PROCESSING', 'PAID', [
    mkItem('item-b1', 'p3', 'Calça Alfaiataria', 'CA-003', 'Preto', '36', 10, 349.90, true),
    mkItem('item-b2', 'p3', 'Calça Alfaiataria', 'CA-003', 'Preto', '38', 14, 349.90, true),
    mkItem('item-b3', 'p3', 'Calça Alfaiataria', 'CA-003', 'Preto', '40', 20, 349.90, true),
    mkItem('item-b4', 'p3', 'Calça Alfaiataria', 'CA-003', 'Preto', '42', 16, 349.90, false),
    mkItem('item-b5', 'p3', 'Calça Alfaiataria', 'CA-003', 'Preto', '44', 8,  349.90, false),
    mkItem('item-b6', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Verde', 'P',  8,  459.90),
    mkItem('item-b7', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Verde', 'M',  15, 459.90),
    mkItem('item-b8', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Verde', 'G',  10, 459.90),
    mkItem('item-b9', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Verde', 'GG',  6, 459.90),
  ], { notes: 'Urgente — cliente prioritário', hoursAgo: 3 }),

  'c3d4e5f6a1b2c3d4': mkOrder('c3d4e5f6a1b2c3d4', 'mock-c3', 'SHIPPED', 'PAID', [
    mkItem('item-c1', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Vinho',     'PP',  6,  219.90, true),
    mkItem('item-c2', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Vinho',     'P',   8,  219.90, true),
    mkItem('item-c3', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Vinho',     'M',   10, 219.90, true),
    mkItem('item-c4', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Vinho',     'G',   14, 219.90, true),
    mkItem('item-c5', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Vinho',     'GG',  8,  219.90, true),
    mkItem('item-c6', 'p6', 'Blazer Oversized',   'BO-006',  'Off White', 'P',   6,  399.90, true),
    mkItem('item-c7', 'p6', 'Blazer Oversized',   'BO-006',  'Off White', 'M',   14, 399.90, true),
    mkItem('item-c8', 'p6', 'Blazer Oversized',   'BO-006',  'Off White', 'G',   10, 399.90, true),
    mkItem('item-c9', 'p6', 'Blazer Oversized',   'BO-006',  'Off White', 'GG',  6,  399.90, true),
  ], { trackingCode: 'BR123456789BR', shippingPrice: 25, internalNotes: 'Enviado via Correios SEDEX', hoursAgo: 26 }),

  'd4e5f6a1b2c3d4e5': mkOrder('d4e5f6a1b2c3d4e5', 'mock-c4', 'DELIVERED', 'PAID', [
    mkItem('item-d1', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Azul',    'PP',  4,  289.90, true),
    mkItem('item-d2', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Azul',    'P',   6,  289.90, true),
    mkItem('item-d3', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Azul',    'M',   8,  289.90, true),
    mkItem('item-d4', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Azul',    'G',   10, 289.90, true),
    mkItem('item-d5', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Azul',    'GG',  6,  289.90, true),
    mkItem('item-d6', 'p6', 'Blazer Oversized',    'BO-006',  'Caramelo', 'P',   8,  399.90, true),
    mkItem('item-d7', 'p6', 'Blazer Oversized',    'BO-006',  'Caramelo', 'M',   10, 399.90, true),
    mkItem('item-d8', 'p6', 'Blazer Oversized',    'BO-006',  'Caramelo', 'G',   6,  399.90, true),
  ], { hoursAgo: 50 }),

  'e5f6a1b2c3d4e5f6': mkOrder('e5f6a1b2c3d4e5f6', 'mock-c5', 'PENDING', 'PENDING', [
    mkItem('item-e1', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Preto',   'PP',  4,  179.90),
    mkItem('item-e2', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Preto',   'P',   6,  179.90),
    mkItem('item-e3', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Preto',   'M',   8,  179.90),
    mkItem('item-e4', 'p2', 'Blusa Crepe Premium',  'BCP-002', 'Preto',   'G',   6,  179.90),
    mkItem('item-e5', 'p5', 'Saia Midi Plissada',   'SMP-005', 'Mostarda','P',   4,  219.90),
    mkItem('item-e6', 'p5', 'Saia Midi Plissada',   'SMP-005', 'Mostarda','M',   6,  219.90),
    mkItem('item-e7', 'p5', 'Saia Midi Plissada',   'SMP-005', 'Mostarda','G',   4,  219.90),
  ], { hoursAgo: 6 }),

  'f6a1b2c3d4e5f6a1': mkOrder('f6a1b2c3d4e5f6a1', 'mock-c6', 'CONFIRMED', 'PAID', [
    mkItem('item-f1', 'p3', 'Calça Alfaiataria', 'CA-003',  'Cáqui', '36', 8,  349.90),
    mkItem('item-f2', 'p3', 'Calça Alfaiataria', 'CA-003',  'Cáqui', '38', 16, 349.90),
    mkItem('item-f3', 'p3', 'Calça Alfaiataria', 'CA-003',  'Cáqui', '40', 14, 349.90),
    mkItem('item-f4', 'p3', 'Calça Alfaiataria', 'CA-003',  'Cáqui', '42', 10, 349.90),
    mkItem('item-f5', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Lilás', 'P',  8,  459.90),
    mkItem('item-f6', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Lilás', 'M',  16, 459.90),
    mkItem('item-f7', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Lilás', 'G',  10, 459.90),
    mkItem('item-f8', 'p4', 'Conjunto Twin Set', 'CTS-004', 'Lilás', 'GG',  6, 459.90),
  ], { hoursAgo: 74 }),

  'g1a2b3c4d5e6f7a8': mkOrder('g1a2b3c4d5e6f7a8', 'mock-c1', 'INVOICED', 'PARTIAL', [
    mkItem('item-g1', 'p6', 'Blazer Oversized',   'BO-006',  'Cinza',    'P',   8,  399.90, true,  12),
    mkItem('item-g2', 'p6', 'Blazer Oversized',   'BO-006',  'Cinza',    'M',   11, 399.90, false, 20),
    mkItem('item-g3', 'p6', 'Blazer Oversized',   'BO-006',  'Cinza',    'G',   14, 399.90, true,  25),
    mkItem('item-g4', 'p6', 'Blazer Oversized',   'BO-006',  'Cinza',    'GG',  6,  399.90, false, 10),
    mkItem('item-g5', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Mostarda', 'P',   8,  219.90),
    mkItem('item-g6', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Mostarda', 'M',   20, 219.90),
    mkItem('item-g7', 'p5', 'Saia Midi Plissada', 'SMP-005', 'Mostarda', 'G',   12, 219.90),
  ], { notes: 'Pagamento parcial confirmado', shippingPrice: 35, hoursAgo: 96 }),

  'h2b3c4d5e6f7a8b9': mkOrder('h2b3c4d5e6f7a8b9', 'mock-c2', 'CANCELLED', 'REFUNDED', [
    mkItem('item-h1', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Rosa', 'PP',  2,  289.90),
    mkItem('item-h2', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Rosa', 'P',   6,  289.90),
    mkItem('item-h3', 'p1', 'Vestido Floral Midi', 'VFM-001', 'Rosa', 'M',   4,  289.90),
    mkItem('item-h4', 'p2', 'Blusa Crepe Premium', 'BCP-002', 'Bege', 'P',   4,  179.90),
    mkItem('item-h5', 'p2', 'Blusa Crepe Premium', 'BCP-002', 'Bege', 'M',   4,  179.90),
    mkItem('item-h6', 'p2', 'Blusa Crepe Premium', 'BCP-002', 'Bege', 'G',   2,  179.90),
  ], { notes: 'Cancelado a pedido do cliente', hoursAgo: 120 }),
}

// Support simple IDs used in manual testing (e.g. /orders/ordmock001)
const SIMPLE_ID_MAP: Record<string, string> = {
  'ordmock001': 'a1b2c3d4e5f6a1b2',
  'ordmock002': 'b2c3d4e5f6a1b2c3',
  'ordmock003': 'c3d4e5f6a1b2c3d4',
  'ordmock004': 'd4e5f6a1b2c3d4e5',
  'ordmock005': 'e5f6a1b2c3d4e5f6',
  'ordmock006': 'f6a1b2c3d4e5f6a1',
  'ordmock007': 'g1a2b3c4d5e6f7a8',
  'ordmock008': 'h2b3c4d5e6f7a8b9',
}

function getMockOrder(id: string) {
  return MOCK_ORDER_DETAILS[id] ?? MOCK_ORDER_DETAILS[SIMPLE_ID_MAP[id] ?? ''] ?? null
}

function getMockCustomer(customerId: string) {
  return MOCK_DETAIL_CUSTOMERS[customerId] ?? null
}
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminOrderDetailPageClient({
  locale,
  orderId,
  initialOrder,
  initialCustomer,
  initialProducts,
  initialAttributeLabels,
}: AdminOrderDetailPageClientProps) {
  const normalizedLocale = normalizeAdminLocale(locale)
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback)
  const ORDER_STATUS_LABELS = getOrderStatusLabels(locale)
  const PAYMENT_STATUS_LABELS = getPaymentStatusLabels(locale)
  const mockOrderFallback = !initialOrder ? getMockOrder(orderId) as unknown as OrderWithExtras | null : null
  const mockCustomerFallback = !initialCustomer && mockOrderFallback
    ? getMockCustomer((mockOrderFallback as any).customerId) as unknown as Customer | null
    : null

  const [order, setOrder] = useState<OrderWithExtras | null>(initialOrder ?? mockOrderFallback);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer ?? mockCustomerFallback);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(!initialOrder && !mockOrderFallback);
  const [isSaving, setIsSaving] = useState(false);
  // Edit states
  const [editingShipping, setEditingShipping] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [trackingSaved, setTrackingSaved] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  
  // Form states
  const [shippingPrice, setShippingPrice] = useState(0);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  
  // Add product dialog
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariants, setProductVariants] = useState<ProductVariantOption[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantOption | null>(null);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);
  const [addUnitPrice, setAddUnitPrice] = useState(0);
  const [loadingVariants, setLoadingVariants] = useState(false);
  
  // Selected items for bulk actions
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [groupToRemove, setGroupToRemove] = useState<string | null>(null);
  const [stockModeConfig, setStockModeConfig] = useState<StockMode>('FANTASY');
  const [stockVariantMaxQty, setStockVariantMaxQty] = useState(999);

  const [attendedQtyDraft, setAttendedQtyDraft] = useState<Record<string, number>>({});
  const [productPreview, setProductPreview] = useState<ProductPreviewState | null>(null)
  
  function resolveAttributeLabel(
    value: string | null | undefined,
    labels: Record<string, string>
  ): string {
    const raw = String(value || '').trim()
    if (!raw) return '-'
    return labels[raw] || labels[raw.toUpperCase()] || labels[raw.toLowerCase()] || raw
  }

  function resolveProductSku(item: OrderItem): string {
    const variantSku = String(item.skuSnapshot || '').trim()
    if (variantSku) {
      return variantSku
    }

    const fromCatalog = initialProducts.find((product) => String(product.id) === String(item.productId))
    if (fromCatalog?.sku) {
      return fromCatalog.sku
    }

    return '-'
  }

  function resolveVariantAttributes(item: OrderItem): Array<{ key: string; value: string }> {
    const normalizeAttributeKey = (key: string): string => {
      const normalized = key.trim().toLowerCase()
      if (['cor', 'color'].includes(normalized)) return tr('admin.orders.attribute.color', 'Color')
      if (['tam', 'tamanho', 'size'].includes(normalized)) return tr('admin.orders.attribute.size', 'Size')

      return key
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/^\w/, (char) => char.toUpperCase())
    }

    const raw = String(item.variantCombinationKey || '').trim()
    if (raw) {
      const keyValueMatches = Array.from(raw.matchAll(/([^|,;:]+):([^|,;]+)/g))
      if (keyValueMatches.length > 0) {
        const parsed = keyValueMatches
          .map((match) => {
            const key = String(match[1] || '').trim()
            const value = String(match[2] || '').trim()
            if (!key || !value) return null

            const normalizedKey = key.toLowerCase()
            const parsedValue = normalizedKey === 'cor' || normalizedKey === 'color'
              ? resolveAttributeLabel(value, initialAttributeLabels.color)
              : normalizedKey === 'tam' || normalizedKey === 'tamanho' || normalizedKey === 'size'
                ? resolveAttributeLabel(value, initialAttributeLabels.size)
                : value

            return {
              key: normalizeAttributeKey(key),
              value: parsedValue,
            }
          })
          .filter((entry): entry is { key: string; value: string } => Boolean(entry))

        if (parsed.length > 0) return parsed
      }

      return [{ key: tr('admin.orders.attribute.variation', 'Variation'), value: raw }]
    }

    const color = resolveAttributeLabel(item.colorSnapshot, initialAttributeLabels.color)
    const size = resolveAttributeLabel(item.sizeSnapshot, initialAttributeLabels.size)
    const fallback: Array<{ key: string; value: string }> = []

    if (color !== '-') fallback.push({ key: tr('admin.orders.attribute.color', 'Color'), value: color })
    if (size !== '-') fallback.push({ key: tr('admin.orders.attribute.size', 'Size'), value: size })

    return fallback.length > 0 ? fallback : [{ key: tr('admin.orders.attribute.variation', 'Variation'), value: '-' }]
  }

  useEffect(() => {
    if (!order) return;
    setShippingPrice(order.shippingPrice || 0);
    setManualDiscount(order.manualDiscount || 0);
    setTrackingCode(order.trackingCode || "");
    setTrackingUrl(order.trackingUrl || "");
    setNotes(order.notes || "");
    setInternalNotes(order.internalNotes || "");

    const nextAttendedDraft: Record<string, number> = {};
    for (const item of order.items) {
      nextAttendedDraft[item.id] = Number(item.qty || 0);
    }
    setAttendedQtyDraft(nextAttendedDraft);
  }, [order]);

  useEffect(() => {
    if (!order && orderId) {
      loadData();
    }
  }, [orderId, order]);


  useEffect(() => {
    let cancelled = false;

    const loadStockSettings = async () => {
      const result = await getSiteSettingsAction();
      if (!result.success || !result.data || cancelled) return;

      setStockModeConfig(result.data.stockMode || 'FANTASY');
      setStockVariantMaxQty(Math.max(1, Number(result.data.variantMaxQty || 999)));
    };

    void loadStockSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function getMaxOrderEditQty(params: { currentQty?: number; availableQty?: number; variantStock?: number }): number {
    const currentQty = Math.max(0, Math.floor(Number(params.currentQty || 0)));
    const availableQty = Math.max(0, Math.floor(Number(params.availableQty || 0)));
    const variantStock = Math.max(0, Math.floor(Number(params.variantStock || 0)));

    if (stockModeConfig === 'BINARY') {
      const binaryLimit = availableQty > 0 || variantStock > 0 ? 1 : 0;
      return Math.max(currentQty, binaryLimit);
    }

    if (stockModeConfig === 'INFINITO') {
      const infinitoLimit = availableQty > 0 || variantStock > 0 ? INFINITE_STOCK_MAX_QTY : 0;
      return Math.max(currentQty, infinitoLimit);
    }

    if (stockModeConfig === 'FANTASY') {
      return Math.max(currentQty, stockVariantMaxQty);
    }

    return Math.max(currentQty, availableQty, variantStock);
  }

  function clampOrderEditQty(value: number, maxAllowed: number): number {
    const normalizedMax = Math.max(1, Math.floor(Number(maxAllowed || 1)));
    const normalizedValue = Math.floor(Number(value || 0));
    return Math.max(1, Math.min(normalizedMax, normalizedValue));
  }

  async function loadData() {
    if (!orderId) return;
    setIsLoading(true);
    const orderResult = await getOrderDetailAction(orderId);
    
    if (orderResult.success && orderResult.data) {
      const orderData = orderResult.data as OrderWithExtras;
      setOrder(orderData);
      setShippingPrice(orderData.shippingPrice || 0);
      setManualDiscount(orderData.manualDiscount || 0);
      setTrackingCode(orderData.trackingCode || "");
      setTrackingUrl(orderData.trackingUrl || "");
      setNotes(orderData.notes || "");
      setInternalNotes(orderData.internalNotes || "");

      if (orderData.customer) {
        setCustomer(orderData.customer);
      } else {
        const customerResult = await getCustomerDetailAction(orderData.customerId);
        if (customerResult.success && customerResult.data) {
          setCustomer(customerResult.data);
        }
      }
    } else {
      // Fallback to mock data when no backend is available
      const mock = getMockOrder(orderId) as unknown as OrderWithExtras | null
      if (mock) {
        setOrder(mock)
        setShippingPrice((mock as any).shippingPrice || 0)
        setManualDiscount((mock as any).manualDiscount || 0)
        setTrackingCode((mock as any).trackingCode || "")
        setNotes((mock as any).notes || "")
        setInternalNotes((mock as any).internalNotes || "")
        const mockCustomer = getMockCustomer((mock as any).customerId)
        if (mockCustomer) setCustomer(mockCustomer as unknown as Customer)
      }
    }

    setIsLoading(false);
  }

  async function refreshOrderDataOnly(preserveScroll: boolean = false) {
    if (!orderId) return;

    const savedScroll = preserveScroll
      ? { x: window.scrollX, y: window.scrollY }
      : null;

    const orderResult = await getOrderDetailAction(orderId);

    if (orderResult.success && orderResult.data) {
      const orderData = orderResult.data as OrderWithExtras;
      setOrder(orderData);
      setShippingPrice(orderData.shippingPrice || 0);
      setManualDiscount(orderData.manualDiscount || 0);

      if (orderData.customer) {
        setCustomer(orderData.customer);
      }
    }

    if (savedScroll) {
      requestAnimationFrame(() => {
        window.scrollTo(savedScroll.x, savedScroll.y);
      });
      setTimeout(() => {
        window.scrollTo(savedScroll.x, savedScroll.y);
      }, 0);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!order) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { status: newStatus as Order["status"] });
    if (result.success) {
      await refreshOrderDataOnly();
    }
    setIsSaving(false);
  }

  async function handlePaymentStatusChange(newStatus: string) {
    if (!order) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { paymentStatus: newStatus as 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED' });
    if (result.success) {
      await refreshOrderDataOnly();
    }
    setIsSaving(false);
  }

  async function handleSaveShipping() {
    if (!order) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { shippingPrice });
    if (result.success) {
      await refreshOrderDataOnly(true);
    }
    setEditingShipping(false);
    setIsSaving(false);
  }

  async function handleSaveDiscount() {
    if (!order) return;
    setIsSaving(true);
    const savedScroll = { x: window.scrollX, y: window.scrollY };
    const maxAllowedDiscount = Math.max(
      0,
      subtotal + (order.shippingPrice || 0) - (order.discountTotal || 0)
    )
    const normalizedManualDiscount = Math.min(
      maxAllowedDiscount,
      Math.max(0, Number(manualDiscount) || 0)
    )

    if (Math.abs(normalizedManualDiscount - manualDiscount) > 0.0001) {
      setManualDiscount(normalizedManualDiscount)
    }

    const result = await updateOrderAction(order.id, { manualDiscount: normalizedManualDiscount });
    if (result.success && result.data) {
      const updatedOrder = result.data as Order;
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...updatedOrder,
          items: prev.items,
          customer: prev.customer,
        };
      });
      setManualDiscount(Number(updatedOrder.manualDiscount || 0));

      requestAnimationFrame(() => {
        window.scrollTo(savedScroll.x, savedScroll.y);
      });
      setTimeout(() => {
        window.scrollTo(savedScroll.x, savedScroll.y);
      }, 0);
    }
    setEditingDiscount(false);
    setIsSaving(false);
  }

  async function handleSaveTracking() {
    if (!order) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { trackingCode, trackingUrl });
    if (result.success) {
      await refreshOrderDataOnly();
      setTrackingSaved(true);
      setTimeout(() => setTrackingSaved(false), 1800);
    }
    setIsSaving(false);
  }

  async function handleSaveOrderChanges() {
    if (!order) return;

    const currentTracking = (order.trackingCode || '').trim();
    const nextTracking = (trackingCode || '').trim();

    if (currentTracking !== nextTracking) {
      await handleSaveTracking();
      return;
    }

    await refreshOrderDataOnly();
  }

  function handleSendWhatsApp() {
    if (!customer) return;
    const phone = String(customer.phone || '').replace(/\D/g, '');
    const orderId8 = order?.id.slice(0, 8).toUpperCase() ?? '';
    const statusLabel = order ? (ORDER_STATUS_LABELS[order.status]?.label ?? order.status) : '';
    const message = encodeURIComponent(
      `Olá, ${customer.contactName || customer.companyName}! 👋\n\nSeu pedido *#${orderId8}* está com status: *${statusLabel}*.\n\nQualquer dúvida, estamos à disposição!`
    );
    const url = phone
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  }

  async function handleExportPdf() {
    await handleSaveOrderChanges();
    window.print();
  }

  async function handlePrintLabel() {
    if (!order) return;

    await handleSaveOrderChanges();

    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) return;

    const tracking = (trackingCode || '').trim() || '-';
    const customerName = customer?.contactName || customer?.companyName || tr('admin.orders.print.customer', 'Customer');
    const addressLine1 = `${order.shippingStreet || ''}, ${order.shippingNumber || ''}${order.shippingComplement ? ` - ${order.shippingComplement}` : ''}`.trim();
    const addressLine2 = `${order.shippingNeighborhood || ''}`.trim();
    const addressLine3 = `${order.shippingCity || ''} - ${order.shippingState || ''}`.trim();
    const addressZip = `${order.shippingZipCode || ''}`.trim();

    printWindow.document.write(`
      <html>
        <head>
          <title>${tr('admin.orders.print.labelTitle', 'Order Label')} ${String(order.id).slice(0, 8).toUpperCase()}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; color: #111827; }
            .label { border: 1px solid #d1d5db; border-radius: 10px; padding: 16px; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
            .line { margin: 4px 0; font-size: 14px; }
            .muted { color: #4b5563; }
            .divider { border-top: 1px dashed #d1d5db; margin: 12px 0; }
            .tracking { font-size: 16px; font-weight: 700; letter-spacing: 0.3px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">${tr('admin.orders.title', 'Order')} ${String(order.id).slice(0, 8).toUpperCase()}</div>
            <div class="line"><strong>${tr('admin.orders.print.recipient', 'Recipient')}:</strong> ${customerName}</div>
            <div class="line muted">${addressLine1}</div>
            <div class="line muted">${addressLine2}</div>
            <div class="line muted">${addressLine3}</div>
            <div class="line muted">${tr('admin.orders.print.zip', 'ZIP')}: ${addressZip}</div>
            <div class="divider"></div>
            <div class="line"><strong>${tr('admin.orders.trackingCode', 'Tracking Code')}</strong></div>
            <div class="tracking">${tracking}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  async function handleTrackingBlur() {
    if (!order) return;
    const currentTracking = (order.trackingCode || '').trim();
    const nextTracking = (trackingCode || '').trim();
    if (currentTracking === nextTracking) {
      return;
    }
    await handleSaveTracking();
  }

  async function handleSaveNotes() {
    if (!order) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { internalNotes });
    if (result.success) {
      await refreshOrderDataOnly();
    }
    setEditingNotes(false);
    setIsSaving(false);
  }

  async function handlePaymentMethodChange(value: string) {
    if (!order) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, {
      paymentMethod: value as PaymentMethod
    });
    if (result.success) {
      await refreshOrderDataOnly();
    }
    setIsSaving(false);
  }

  async function handleSelectProduct(product: Product) {
    setSelectedProduct(product);
    setAddUnitPrice(product.basePrice);
    setSelectedColor("")
    setSelectedSize("")
    setSelectedVariant(null)
    setLoadingVariants(true)

    const result = await getProductFullAction(product.id)

    if (result.success && result.data) {
      const rawVariants = Array.isArray(result.data?.variants) ? result.data.variants : []

      const mappedVariants: ProductVariantOption[] = rawVariants
        .map((variantEntry: any) => {
          const attributeValues = Array.isArray(variantEntry?.attribute_values)
            ? variantEntry.attribute_values
            : Array.isArray(variantEntry?.attributeValues)
              ? variantEntry.attributeValues
              : []

          const colorAttr = attributeValues.find((value: any) =>
            ['color', 'cor'].includes(String(value?.attribute_code || '').toLowerCase())
          )
          const sizeAttr = attributeValues.find((value: any) =>
            ['size', 'tamanho', 'tam'].includes(String(value?.attribute_code || '').toLowerCase())
          )

          const priceCents = Number(variantEntry?.promo_cents || 0) > 0
            ? Number(variantEntry?.promo_cents || 0)
            : Number(variantEntry?.price_cents || 0)

          return {
            id: String(variantEntry?.id || ''),
            productId: String(variantEntry?.product_id || product.id),
            variantSku: String(variantEntry?.sku || ''),
            stock: Number(variantEntry?.stock_qty || 0),
            unitPrice: priceCents / 100,
            color: String(colorAttr?.value_name || '-').trim() || '-',
            size: String(sizeAttr?.value_name || '-').trim() || '-',
          }
        })
        .filter((variant: ProductVariantOption) => variant.id)

      setProductVariants(mappedVariants)
    } else {
      setProductVariants([])
    }

    setLoadingVariants(false)
  }

  async function handleAddProduct() {
    if (!order || !selectedProduct || !selectedVariant) return;

    const maxAllowed = getMaxOrderEditQty({
      variantStock: selectedVariant.stock,
      availableQty: selectedVariant.stock,
      currentQty: 0,
    });

    if (maxAllowed < 1) {
      window.alert(tr('admin.orders.alerts.variantUnavailable', 'Variant unavailable for this stock mode'))
      return
    }

    const clampedQty = clampOrderEditQty(addQuantity, maxAllowed);

    setIsSaving(true);
    
    const result = await addOrderItemAction(order.id, {
      productId: selectedProduct.id,
      variantId: selectedVariant.id,
      quantity: clampedQty,
      unitPrice: addUnitPrice,
      origin: 'manager_added',
    });

    if (!result.success) {
      window.alert(result.error || tr('admin.orders.alerts.addItem', 'Could not add item to order'))
      setIsSaving(false);
      return;
    }

    await refreshOrderDataOnly();
    setAddProductOpen(false);
    setSelectedProduct(null);
    setProductVariants([]);
    setSelectedVariant(null);
    setSelectedColor("");
    setSelectedSize("");
    setAddQuantity(1);
    setAddUnitPrice(0);
    setIsSaving(false);
  }

  async function handleRemoveItem(itemId: string) {
    if (!order) return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    await removeOrderItemAction(order.id, itemId);
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleRemoveSelectedItems() {
    if (!order || selectedItems.length === 0) return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    for (const itemId of selectedItems) {
      await removeOrderItemAction(order.id, itemId);
    }
    setSelectedItems([]);
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleReactivateItem(itemId: string) {
    if (!order) return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    await updateOrderItemAction(order.id, itemId, { fulfilled: false });
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleToggleFulfilled(itemId: string, fulfilled: boolean) {
    if (!order) return;
    if (order.status === 'CONFIRMED') return;
    const item = order.items.find((entry) => entry.id === itemId);
    if (item?.status === 'removed') return;
    setIsSaving(true);
    await updateOrderItemAction(order.id, itemId, { fulfilled });
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleMarkAllFulfilled() {
    if (!order) return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    for (const item of order.items) {
      if (item.status !== 'removed' && !item.fulfilled) {
        await updateOrderItemAction(order.id, item.id, { fulfilled: true });
      }
    }
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleMarkGroupFulfilled(items: OrderItem[], fulfilled: boolean) {
    if (!order) return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    for (const item of items) {
      if (item.status !== 'removed') {
        await updateOrderItemAction(order.id, item.id, { fulfilled });
      }
    }
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleChangeAttendedQty(item: OrderItem, nextValue: number) {
    if (!order) return;
    if (order.status === 'CONFIRMED') return;
    if (item.status === 'removed') return;

    const stockLimit = getMaxOrderEditQty({
      currentQty: item.qty,
      availableQty: item.variantAvailableQty,
    });
    const nextQty = Math.max(0, Math.min(Math.floor(Number(stockLimit || 0)), Math.round(Number(nextValue || 0))));

    if (nextQty === Number(item.qty)) return;

    const previousDraft = Number(attendedQtyDraft[item.id] ?? item.qty);
    setAttendedQtyDraft(prev => ({ ...prev, [item.id]: nextQty }));
    setIsSaving(true);
    const result = await updateOrderItemAction(order.id, item.id, {
      quantity: nextQty,
      unitPrice: item.unitPrice,
    });
    if (result.success) {
      await refreshOrderDataOnly(true);
    } else {
      setAttendedQtyDraft(prev => ({ ...prev, [item.id]: previousDraft }));
      window.alert(result.error || 'Não foi possível atualizar a quantidade atendida');
    }
    setIsSaving(false);
  }

  async function handleRemoveGroupItems(items: OrderItem[]) {
    if (!order || items.length === 0) return;
    if (order.status === 'CONFIRMED') return;

    setIsSaving(true);
    for (const item of items) {
      await removeOrderItemAction(order.id, item.id);
    }
    await refreshOrderDataOnly();
    setGroupToRemove(null);
    setIsSaving(false);
  }

  async function handleReactivateGroupItems(items: OrderItem[]) {
    if (!order || items.length === 0) return;
    if (order.status === 'CONFIRMED') return;

    const removedItems = items.filter((item) => item.status === 'removed')
    if (removedItems.length === 0) return

    setIsSaving(true)
    for (const item of removedItems) {
      await updateOrderItemAction(order.id, item.id, { fulfilled: false })
    }
    await refreshOrderDataOnly()
    setIsSaving(false)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(normalizedLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateLong = (date: Date) => {
    return new Date(date).toLocaleString(normalizedLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const colorOptions = Array.from(
    new Set(productVariants.map((variant) => variant.color).filter((value) => value && value !== '-'))
  ).map((color) => ({
    color,
    stock: productVariants
      .filter((variant) => variant.color === color)
      .reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0),
  }))

  const sizeOptions = Array.from(
    new Set(
      productVariants
        .filter((variant) => !selectedColor || variant.color === selectedColor)
        .map((variant) => variant.size)
        .filter((value) => value && value !== '-')
    )
  ).map((size) => {
    const sizeVariant = productVariants.find(
      (variant) => (!selectedColor || variant.color === selectedColor) && variant.size === size
    )

    return {
      size,
      stock: Number(sizeVariant?.stock || 0),
    }
  })

  useEffect(() => {
    if (!addProductOpen) return

    setProducts([])
    setSelectedProduct(null)
    setProductVariants([])
    setSelectedVariant(null)
    setSelectedColor("")
    setSelectedSize("")

    const loadVariantCatalog = async () => {
      setLoadingVariants(true)
      const result = await getOrderProductVariantsCatalogAction(productSearch)
      if (result.success && result.data) {
        const productsMap = new Map<string, Product>()
        for (const entry of result.data) {
          if (!productsMap.has(entry.productId)) {
            productsMap.set(entry.productId, {
              id: entry.productId,
              name: entry.productName,
              slug: entry.productCode.toLowerCase(),
              sku: entry.productCode,
              description: null,
              materials: null,
              measures: null,
              basePrice: entry.unitPrice,
              cost: null,
              isActive: true,
              isFeatured: false,
              categoryId: '',
              tags: [],
              images: [],
              sizes: [],
              colors: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }
        }

        setProducts(Array.from(productsMap.values()))
      } else {
        setProducts([])
      }
      setLoadingVariants(false)
    }

    const timeout = setTimeout(() => {
      loadVariantCatalog()
    }, 250)

    return () => clearTimeout(timeout)
  }, [addProductOpen, productSearch])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{tr('admin.orders.loading', 'Loading...')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{tr('admin.orders.notFound', 'Order not found')}</p>
      </div>
    );
  }

  const orderStatusInfo = ORDER_STATUS_LABELS[order.status] || { label: order.status, variant: "secondary" as const };
  const isOrderConfirmed = order.status === 'CONFIRMED';

  const orderStatusBadgeClass = (status: string) => {
    if (status === 'DELIVERED' || status === 'CONFIRMED' || status === 'INVOICED') return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    if (status === 'PENDING') return 'bg-amber-50 text-amber-600 border border-amber-100'
    if (status === 'PROCESSING' || status === 'SHIPPED') return 'bg-sky-50 text-sky-600 border border-sky-100'
    if (status === 'CANCELLED') return 'bg-rose-50 text-rose-600 border border-rose-100'
    return 'bg-muted/60 text-muted-foreground border border-border/60'
  }

  const getInvoiceStatusBadgeClass = (status: string) => {
    if (status === 'AUTHORIZED') return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    if (status === 'PENDING' || status === 'PROCESSING') return 'bg-amber-50 text-amber-600 border border-amber-100'
    if (status === 'REJECTED' || status === 'ERROR') return 'bg-rose-50 text-rose-600 border border-rose-100'
    if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600 border border-slate-200'
    return 'bg-muted/60 text-muted-foreground border border-border/60'
  }

  const getInvoiceStatusLabel = (status?: string | null) => {
    switch (String(status || '').toUpperCase()) {
      case 'PENDING':
        return tr('admin.orders.invoiceStatus.pending', 'Pending')
      case 'PROCESSING':
        return tr('admin.orders.invoiceStatus.processing', 'Processing')
      case 'AUTHORIZED':
        return tr('admin.orders.invoiceStatus.authorized', 'Authorized')
      case 'REJECTED':
        return tr('admin.orders.invoiceStatus.rejected', 'Rejected')
      case 'CANCELLED':
        return tr('admin.orders.invoiceStatus.cancelled', 'Cancelled')
      case 'ERROR':
        return tr('admin.orders.invoiceStatus.error', 'Error')
      default:
        return status || tr('admin.orders.invoiceStatus.none', 'No status')
    }
  }

  const getLabelStatusBadgeClass = (status: string) => {
    if (status === 'ISSUED') return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    if (status === 'ERROR') return 'bg-rose-50 text-rose-600 border border-rose-100'
    return 'bg-muted/60 text-muted-foreground border border-border/60'
  }

  const getLabelStatusLabel = (status?: string | null) => {
    switch (String(status || '').toUpperCase()) {
      case 'ISSUED':
        return tr('admin.orders.labelStatus.issued', 'Issued')
      case 'ERROR':
        return tr('admin.orders.labelStatus.error', 'Error')
      default:
        return status || tr('admin.orders.labelStatus.none', 'No status')
    }
  }

  // Calculate totals
  const subtotal = order.items.filter(item => item.status !== 'removed').reduce((sum, item) => sum + item.total, 0);
  const couponDiscount = order.couponDiscount || 0;
  const tierDiscount = order.tierDiscount || 0;
  const paymentMethodDiscount = Math.max(0, (order.discountTotal || 0) - couponDiscount - tierDiscount);
  const maxManualDiscount = Math.max(0, subtotal + (order.shippingPrice || 0) - (order.discountTotal || 0));
  const appliedManualDiscount = Math.min(Math.max(0, manualDiscount), maxManualDiscount);
  const totalDiscount = (order.discountTotal || 0) + appliedManualDiscount;
  const total = Math.max(0, subtotal - totalDiscount + (order.shippingPrice || 0));
  const fulfilledTotal = order.items
    .filter(i => i.status !== 'removed')
    .reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0);

  const productGroups = order.items
    .reduce((acc, item) => {
      const pid = String(item.productId)
      if (!acc[pid]) {
        acc[pid] = {
          productId: pid,
          productName: item.nameSnapshot,
          sku: resolveProductSku(item),
          imageUrl: item.assetImageUrl || item.imageUrl || null,
          unitPrice: item.unitPrice,
          items: [] as OrderItem[],
        }
      }
      if (!acc[pid].imageUrl && (item.assetImageUrl || item.imageUrl)) {
        acc[pid].imageUrl = item.assetImageUrl || item.imageUrl || null
      }
      acc[pid].items.push(item)
      return acc
    }, {} as Record<string, { productId: string; productName: string; sku: string; imageUrl: string | null; unitPrice: number; items: OrderItem[] }>)

  const productGroupsList = Object.values(productGroups)
  const selectedVariantMaxAddQty = getMaxOrderEditQty({
    variantStock: selectedVariant?.stock,
    availableQty: selectedVariant?.stock,
    currentQty: 0,
  })

  return (
    <AdminPage className="print:space-y-4 print:p-0 pb-40 md:pb-28">
      <div className="print:hidden flex items-center justify-between gap-3 border-b pb-3">
        {/* Left: back + title */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/orders">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-medium text-foreground flex items-center gap-2 truncate">
              <Package className="h-5 w-5 text-primary shrink-0" />
              {tr('admin.orders.title', 'Order')} {order.id.slice(0, 8).toUpperCase()}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground capitalize">{formatDateLong(order.createdAt)}</p>
              <Badge variant="outline" className={`text-xs font-medium ${orderStatusBadgeClass(order.status)}`}>{orderStatusInfo.label}</Badge>
              {trackingCode?.trim() && (
                <Badge variant="outline" className="text-xs font-medium font-mono">
                  {trackingCode}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-lg font-medium">{tr('admin.orders.title', 'Order')} {order.id.slice(0, 8).toUpperCase()}</h1>
        <p className="text-sm text-muted-foreground capitalize">{formatDateLong(order.createdAt)}</p>
        {trackingCode?.trim() && (
          <p className="text-sm mt-1">{tr('admin.orders.trackingCode', 'Tracking Code')}: {trackingCode}</p>
        )}
      </div>

      <div className="space-y-4">

        {/* ── 1. Customer Information ──────────────────────────────────────── */}
        <Card className="rounded-xl border-border/20 shadow-none gap-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              {tr('admin.orders.customerInfo', 'Customer Information')}
            </CardTitle>
          </CardHeader>
          <CardContent className="border-t border-border/20 pt-6">
            {customer ? (
              <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Empresa</p>
                  <p className="font-semibold">{customer.companyName}</p>
                  <p className="text-muted-foreground">{customer.cnpj}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Contato</p>
                  <p className="font-medium">{customer.contactName}</p>
                  <p className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{customer.phone}</p>
                  <p className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" />{customer.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Endereço</p>
                  <p className="text-muted-foreground flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{order.shippingStreet}, {order.shippingNumber}{order.shippingComplement ? ` — ${order.shippingComplement}` : ''}</span>
                  </p>
                  <p className="text-muted-foreground pl-5">{order.shippingCity} — {order.shippingState}</p>
                  <p className="text-muted-foreground pl-5">CEP: {order.shippingZipCode}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Histórico</p>
                  <p className="text-muted-foreground flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 shrink-0" />Cadastro: {formatDate(customer.createdAt)}</p>
                  <p className="text-muted-foreground flex items-center gap-2"><Activity className="h-3.5 w-3.5 shrink-0" />Última atividade: {formatDate(customer.updatedAt)}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{tr('admin.orders.customerNotFound', 'Customer not found')}</p>
            )}
          </CardContent>
        </Card>

        {/* ── 2. Metrics ──────────────────────────────────────────────────── */}
        <div className="print:hidden flex flex-col divide-y divide-border/30 rounded-xl border border-border/20 bg-card shadow-none overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-6 w-6 rounded-md bg-sky-100 text-sky-600 grid place-items-center shrink-0">
                <DollarSign className="h-3 w-3" />
              </div>
              <p className="text-xs text-muted-foreground leading-none">Valor Solicitado</p>
            </div>
            <p className="text-sm font-semibold tabular-nums leading-none shrink-0">R$ {total.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-6 w-6 rounded-md bg-emerald-100 text-emerald-600 grid place-items-center shrink-0">
                <Boxes className="h-3 w-3" />
              </div>
              <p className="text-xs text-muted-foreground leading-none">Valor Atendido</p>
            </div>
            <p className="text-sm font-semibold tabular-nums leading-none shrink-0 text-emerald-700 dark:text-emerald-400">R$ {fulfilledTotal.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-6 w-6 rounded-md bg-amber-100 text-amber-600 grid place-items-center shrink-0">
                <Percent className="h-3 w-3" />
              </div>
              <p className="text-xs text-muted-foreground leading-none">% Atendida</p>
            </div>
            <p className="text-sm font-semibold tabular-nums leading-none shrink-0 text-amber-600">
              {total > 0 ? `${((fulfilledTotal / total) * 100).toFixed(1)}%` : '0.0%'}
            </p>
          </div>
        </div>

        {/* ── 3. Order Status ──────────────────────────────────────────────── */}
        <Card className="print:hidden rounded-xl border-border/20 shadow-none gap-0">
          <CardHeader>
            <CardTitle className="text-base">{tr('admin.orders.statusSection', 'Order Status')}</CardTitle>
          </CardHeader>
          <CardContent className="border-t border-border/20 pt-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* Fulfillment */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', {
                    'bg-amber-400': order.status === 'PENDING',
                    'bg-blue-500': order.status === 'CONFIRMED' || order.status === 'PROCESSING',
                    'bg-purple-500': order.status === 'INVOICED',
                    'bg-cyan-500': order.status === 'SHIPPED',
                    'bg-emerald-500': order.status === 'DELIVERED',
                    'bg-red-500': order.status === 'CANCELLED',
                  })} />
                  <Label className="text-xs text-muted-foreground">{tr('admin.orders.separation', 'Fulfillment')}</Label>
                </div>
                <Select value={order.status} onValueChange={handleStatusChange} disabled={isSaving}>
                  <SelectTrigger className="w-full h-11 text-sm">
                    <span className="truncate">{ORDER_STATUS_LABELS[order.status]?.label ?? order.status}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{ORDER_STATUS_LABELS.PENDING.label}</SelectItem>
                    <SelectItem value="CONFIRMED">{ORDER_STATUS_LABELS.CONFIRMED.label}</SelectItem>
                    <SelectItem value="PROCESSING">{ORDER_STATUS_LABELS.PROCESSING.label}</SelectItem>
                    <SelectItem value="INVOICED">{ORDER_STATUS_LABELS.INVOICED.label}</SelectItem>
                    <SelectItem value="SHIPPED">{ORDER_STATUS_LABELS.SHIPPED.label}</SelectItem>
                    <SelectItem value="DELIVERED">{ORDER_STATUS_LABELS.DELIVERED.label}</SelectItem>
                    <SelectItem value="CANCELLED">{ORDER_STATUS_LABELS.CANCELLED.label}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', {
                    'bg-amber-400': (order.paymentStatus || 'PENDING') === 'PENDING',
                    'bg-emerald-500': order.paymentStatus === 'PAID',
                    'bg-orange-400': order.paymentStatus === 'PARTIAL',
                    'bg-red-500': order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'CANCELLED',
                  })} />
                  <Label className="text-xs text-muted-foreground">{tr('admin.orders.payment', 'Payment')}</Label>
                </div>
                <Select value={order.paymentStatus || 'PENDING'} onValueChange={handlePaymentStatusChange} disabled={isSaving}>
                  <SelectTrigger className="w-full h-11 text-sm">
                    <span className="truncate">{PAYMENT_STATUS_LABELS[order.paymentStatus || 'PENDING']?.label ?? order.paymentStatus ?? 'Pendente'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{PAYMENT_STATUS_LABELS.PENDING.label}</SelectItem>
                    <SelectItem value="PAID">{PAYMENT_STATUS_LABELS.PAID.label}</SelectItem>
                    <SelectItem value="PARTIAL">{PAYMENT_STATUS_LABELS.PARTIAL.label}</SelectItem>
                    <SelectItem value="REFUNDED">{PAYMENT_STATUS_LABELS.REFUNDED.label}</SelectItem>
                    <SelectItem value="CANCELLED">{PAYMENT_STATUS_LABELS.CANCELLED.label}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                  <Label className="text-xs text-muted-foreground">Método</Label>
                </div>
                <Select value={order.paymentMethod || undefined} onValueChange={handlePaymentMethodChange} disabled={isSaving}>
                  <SelectTrigger className="w-full h-11 text-sm">
                    <span className="truncate">{getPaymentMethodLabel(order.paymentMethod)}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', {
                    'bg-amber-400': order.status === 'PENDING',
                    'bg-blue-500': order.status === 'PROCESSING',
                    'bg-cyan-500': order.status === 'SHIPPED',
                    'bg-emerald-500': order.status === 'DELIVERED',
                    'bg-red-500': order.status === 'CANCELLED',
                    'bg-muted-foreground/40': order.status === 'CONFIRMED' || order.status === 'INVOICED',
                  })} />
                  <Label className="text-xs text-muted-foreground">{tr('admin.orders.delivery', 'Delivery')}</Label>
                </div>
                <Select value={order.status} onValueChange={handleStatusChange} disabled={isSaving}>
                  <SelectTrigger className="w-full h-11 text-sm">
                    <span className="truncate">
                      {order.status === 'PENDING'
                        ? tr('admin.orders.deliveryStatus.pending', 'Pending')
                        : order.status === 'PROCESSING'
                          ? tr('admin.orders.deliveryStatus.processing', 'Preparing')
                          : order.status === 'SHIPPED'
                            ? tr('admin.orders.deliveryStatus.shipped', 'In Transit')
                            : order.status === 'DELIVERED'
                              ? tr('admin.orders.deliveryStatus.delivered', 'Delivered')
                              : order.status === 'CANCELLED'
                                ? tr('admin.orders.deliveryStatus.cancelled', 'Returned')
                                : '-'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{tr('admin.orders.deliveryStatus.pending', 'Pending')}</SelectItem>
                    <SelectItem value="PROCESSING">{tr('admin.orders.deliveryStatus.processing', 'Preparing')}</SelectItem>
                    <SelectItem value="SHIPPED">{tr('admin.orders.deliveryStatus.shipped', 'In Transit')}</SelectItem>
                    <SelectItem value="DELIVERED">{tr('admin.orders.deliveryStatus.delivered', 'Delivered')}</SelectItem>
                    <SelectItem value="CANCELLED">{tr('admin.orders.deliveryStatus.cancelled', 'Returned')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tracking Code — full width below */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{tr('admin.orders.trackingCode', 'Tracking Code')}</Label>
              <Input
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value)}
                onBlur={handleTrackingBlur}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleTrackingBlur();
                  }
                }}
                placeholder={tr('admin.orders.trackingPlaceholder', 'Ex: BR123456789XX')}
                disabled={isSaving}
                className="h-11 text-sm"
              />
              {trackingSaved && (
                <p className="text-xs text-emerald-600">{tr('admin.orders.saved', 'Saved')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── 4. Products ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Produtos do Pedido ({productGroupsList.length})</CardTitle>
                <CardDescription>
                  Itens agrupados por produto/cor com edição rápida por matriz
                </CardDescription>
              </div>
              {!isOrderConfirmed && selectedItems.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-muted-foreground">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir ({selectedItems.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir {selectedItems.length} item(ns) do pedido?
                        O estoque será restaurado automaticamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRemoveSelectedItems}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>

            {/* Add Product dialog — controlled, triggered from FAB */}
            {!isOrderConfirmed && (
              <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Adicionar Produto ao Pedido</DialogTitle>
                    <DialogDescription>
                      Busque e selecione um produto para adicionar ao pedido
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar produto por nome ou SKU..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {!selectedProduct ? (
                      <div className="max-h-75 overflow-y-auto border rounded-lg">
                        {loadingVariants ? (
                          <p className="p-3 text-sm text-muted-foreground">Carregando catálogo de variantes...</p>
                        ) : filteredProducts.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">Nenhum produto real encontrado no catálogo de variantes</p>
                        ) : null}
                        {filteredProducts.slice(0, 10).map((product) => (
                          <div
                            key={product.id}
                            className="p-3 border-b last:border-b-0 hover:bg-muted cursor-pointer"
                            onClick={() => handleSelectProduct(product)}
                          >
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {product.sku} | R$ {product.basePrice.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium">{selectedProduct.name}</p>
                            <p className="text-sm text-muted-foreground">SKU: {selectedProduct.sku}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => {
                            setSelectedProduct(null);
                            setProductVariants([]);
                            setSelectedVariant(null);
                            setSelectedColor("");
                            setSelectedSize("");
                          }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {loadingVariants ? (
                          <p className="text-sm text-muted-foreground">Carregando variações...</p>
                        ) : productVariants.length > 0 ? (
                          <div className="space-y-4">
                            <div>
                              <Label>Cor</Label>
                              <Select
                                value={selectedColor}
                                onValueChange={(value) => {
                                  setSelectedColor(value)
                                  setSelectedSize("")
                                  setSelectedVariant(null)
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione a cor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {colorOptions.map((colorOption) => (
                                    <SelectItem key={colorOption.color} value={colorOption.color}>
                                      {colorOption.color} (Estoque: {colorOption.stock})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Tamanho</Label>
                              <Select
                                value={selectedSize}
                                onValueChange={(value) => {
                                  setSelectedSize(value)
                                  const variant = productVariants.find(
                                    (entry) => entry.color === selectedColor && entry.size === value
                                  )
                                  setSelectedVariant(variant || null)
                                  if (variant) {
                                    setAddUnitPrice(variant.unitPrice)
                                  }
                                }}
                                disabled={!selectedColor}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione o tamanho" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sizeOptions.map((sizeOption) => (
                                    <SelectItem key={sizeOption.size} value={sizeOption.size}>
                                      {sizeOption.size} (Estoque: {sizeOption.stock})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-destructive">Este produto não possui variações cadastradas</p>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div>
                            <Label>Quantidade</Label>
                            <IntegerInput
                              value={addQuantity}
                              onChange={(value) => {
                                if (selectedVariantMaxAddQty < 1) {
                                  setAddQuantity(1)
                                  return
                                }
                                setAddQuantity(clampOrderEditQty(Number(value || 1), selectedVariantMaxAddQty))
                              }}
                              min={1}
                              max={selectedVariantMaxAddQty < 1 ? undefined : selectedVariantMaxAddQty}
                              fullWidth
                            />
                          </div>
                          <div>
                            <Label>Preço Unitário</Label>
                            <CurrencyInput
                              min={0}
                              value={addUnitPrice}
                              onChange={(value) => setAddUnitPrice(Number(value || 0))}
                              fullWidth
                              className="space-y-0"
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Total: R$ {(addQuantity * addUnitPrice).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddProductOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAddProduct}
                      disabled={!selectedProduct || !selectedVariant || isSaving || selectedVariantMaxAddQty < 1}
                    >
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <CardContent className="border-t border-border/20 pt-6">
              <div className="space-y-4">
                {productGroupsList.map((group) => {
                  const groupAllRemoved = group.items.length > 0 && group.items.every((item) => item.status === 'removed')
                  const activeItems = group.items.filter(i => i.status !== 'removed')
                  const groupAllFulfilled = activeItems.length > 0 && activeItems.every(i => i.fulfilled || i.status === 'attended')
                  const groupRequested = group.items.reduce((sum, item) => sum + Number(item.originalQty ?? item.qty), 0)
                  const groupFulfilled = group.items.filter(i => i.status !== 'removed').reduce((sum, i) => sum + Number(i.qty || 0), 0)
                  const groupTotal = group.items.reduce((sum, item) => sum + Number(item.originalQty ?? item.qty) * Number(item.unitPrice || 0), 0)

                  // Build unique sizes and colors for the matrix
                  const rawColors = Array.from(new Set(group.items.map(i => String(i.colorSnapshot || '')).filter(Boolean)))
                  const rawSizes = Array.from(new Set(group.items.map(i => String(i.sizeSnapshot || '')).filter(Boolean)))
                  rawSizes.sort((a, b) => {
                    const ai = SIZE_ORDER.indexOf(a); const bi = SIZE_ORDER.indexOf(b)
                    if (ai !== -1 && bi !== -1) return ai - bi
                    if (ai !== -1) return -1; if (bi !== -1) return 1
                    return a.localeCompare(b)
                  })

                  // Matrix lookup: matrixLookup[color][size] = item
                  const matrixLookup: Record<string, Record<string, OrderItem>> = {}
                  for (const item of group.items) {
                    const c = String(item.colorSnapshot || '')
                    const s = String(item.sizeSnapshot || '')
                    if (!matrixLookup[c]) matrixLookup[c] = {}
                    matrixLookup[c][s] = item
                  }

                  // Price range for display
                  const prices = group.items.map(i => Number(i.unitPrice || 0)).filter(p => p > 0)
                  const minPrice = prices.length ? Math.min(...prices) : 0
                  const maxPrice = prices.length ? Math.max(...prices) : 0
                  const priceLabel = minPrice === maxPrice
                    ? `R$ ${minPrice.toFixed(2)}`
                    : `R$ ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}`

                  return (
                    <div key={group.productId} className={`rounded-xl border border-border/20 overflow-hidden ${groupAllRemoved ? 'opacity-60' : ''}`}>

                      {/* ── Product header ───────────────────────────── */}
                      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Product image thumbnail */}
                          <button
                            type="button"
                            className="h-14 w-14 rounded-lg bg-muted overflow-hidden shrink-0 grid place-items-center border border-border/20"
                            onClick={() => {
                              const groupedVariants = group.items.reduce((acc, entry) => {
                                const attributes = resolveVariantAttributes(entry)
                                const variantKey = attributes.map(a => `${a.key}:${a.value}`).join('|')
                                if (!acc[variantKey]) acc[variantKey] = { variantKey, attributes, requestedQty: 0, attendedQty: 0 }
                                acc[variantKey].requestedQty += Number(entry.originalQty ?? entry.qty)
                                if (entry.status !== 'removed') {
                                  acc[variantKey].attendedQty += Number(entry.qty || 0)
                                }
                                return acc
                              }, {} as Record<string, { variantKey: string; attributes: Array<{ key: string; value: string }>; requestedQty: number; attendedQty: number }>)
                              setProductPreview({ productName: group.productName, imageUrl: group.imageUrl, sku: group.sku, variants: Object.values(groupedVariants) })
                            }}
                          >
                            {group.imageUrl ? (
                              <img src={group.imageUrl} alt={group.productName} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground/40" />
                            )}
                          </button>

                          {/* Product info */}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight">{group.productName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">SKU: {group.sku} · {priceLabel}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                Solic.: <span className="font-semibold text-foreground tabular-nums">{groupRequested}</span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Atend.: <span className="font-semibold text-emerald-600 tabular-nums">{groupFulfilled}</span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Total: <span className="font-semibold text-foreground tabular-nums">R$ {groupTotal.toFixed(2)}</span>
                              </span>
                            </div>
                          </div>

                          {groupAllRemoved && (
                            <Badge variant="outline" className="text-xs font-medium bg-rose-50 text-rose-600 border border-rose-100 shrink-0">Removido</Badge>
                          )}
                        </div>

                        {/* Group-level action */}
                        {!isOrderConfirmed && groupAllRemoved ? (
                          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" disabled={isSaving} onClick={() => handleReactivateGroupItems(group.items)} title="Reativar">
                            <RotateCcw className="h-5 w-5" />
                          </Button>
                        ) : !isOrderConfirmed ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-10 w-10 shrink-0 transition-colors ${groupAllFulfilled ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' : 'text-muted-foreground hover:text-foreground'}`}
                              disabled={isSaving}
                              onClick={() => handleMarkGroupFulfilled(group.items, !groupAllFulfilled)}
                              title={groupAllFulfilled ? 'Desmarcar todos' : 'Marcar todos como atendidos'}
                            >
                              <CheckCheck className="h-5 w-5" />
                            </Button>
                          <AlertDialog open={groupToRemove === group.productId} onOpenChange={(open) => setGroupToRemove(open ? group.productId : null)}>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground" disabled={isSaving}>
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover produto do pedido</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover {group.items.length} variante(s) de "{group.productName}" do pedido?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveGroupItems(group.items)}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </div>
                        ) : null}
                      </div>

                      {/* ── Color × Size matrix ──────────────────────── */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-t border-border/20">
                          <thead>
                            <tr className="bg-muted/20 border-b border-border/10">
                              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground min-w-[140px]">Cor</th>
                              {rawSizes.map(size => (
                                <th key={size} className="text-center px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                  {resolveAttributeLabel(size, initialAttributeLabels.size)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rawColors.map((color, colorIdx) => {
                              const colorLabel = resolveAttributeLabel(color, initialAttributeLabels.color)
                              const colorDot = getColorDot(color)

                              return (
                                <tr key={color} className={`border-b border-border/10 last:border-0 ${colorIdx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                  {/* Color label with dot */}
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="inline-block h-3.5 w-3.5 rounded-full shrink-0 border border-black/10"
                                        style={{ background: colorDot }}
                                      />
                                      <span className="text-sm font-medium">{colorLabel}</span>
                                    </div>
                                  </td>

                                  {/* Size cells with inline attended quantity controls */}
                                  {rawSizes.map(size => {
                                    const item = matrixLookup[color]?.[size]
                                    if (!item) {
                                      return (
                                        <td key={size} className="min-w-24 text-center px-2 py-3.5">
                                          <span className="text-muted-foreground/25 text-xs select-none">—</span>
                                        </td>
                                      )
                                    }

                                    const requestedQty = Number(item.originalQty ?? item.qty)
                                    const attendedQtyVal = Number(attendedQtyDraft[item.id] ?? item.qty)
                                    const isAttended = item.status === 'attended' || item.fulfilled
                                    const isRemoved = item.status === 'removed'
                                    const stockLimit = getMaxOrderEditQty({ currentQty: item.qty, availableQty: item.variantAvailableQty })
                                    const normalizedAttendedQty = Math.max(0, Math.min(Math.floor(Number(stockLimit || 0)), Math.floor(attendedQtyVal)))
                                    const isZeroRequested = requestedQty > 0 && normalizedAttendedQty === 0 && !isRemoved
                                    const canDecrease = !isSaving && normalizedAttendedQty > 0 && !isOrderConfirmed && !isRemoved
                                    const canIncrease = !isSaving && normalizedAttendedQty < stockLimit && !isOrderConfirmed && !isRemoved

                                    if (isOrderConfirmed || isRemoved) {
                                      return (
                                        <td key={size} className={`min-w-24 text-center px-2 py-3.5 ${isRemoved ? 'opacity-40' : isZeroRequested ? 'bg-red-500 text-white' : isAttended ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}`}>
                                          <div className="flex flex-col items-center gap-1">
                                            <span className={cn("text-xs font-medium tabular-nums", isZeroRequested ? "text-white/80" : "text-muted-foreground")}>{requestedQty}</span>
                                            <span className={cn("text-xl font-semibold tabular-nums", isRemoved ? "line-through text-muted-foreground/40" : isZeroRequested ? "text-white" : isAttended ? "text-emerald-600" : "text-foreground")}>
                                              {normalizedAttendedQty}
                                            </span>
                                          </div>
                                        </td>
                                      )
                                    }

                                    return (
                                      <td
                                        key={size}
                                        className={`min-w-24 text-center px-2 py-2 transition-colors ${
                                          isZeroRequested
                                            ? 'bg-red-500 text-white'
                                            : isAttended
                                              ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
                                              : 'bg-background'
                                        }`}
                                      >
                                        <div className="flex min-h-32 flex-col items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            className={cn(
                                              "flex h-9 w-9 items-center justify-center rounded-full border text-2xl leading-none transition-colors disabled:opacity-30",
                                              isZeroRequested
                                                ? "border-white/50 bg-white/15 text-white hover:bg-white/25"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                            disabled={!canIncrease}
                                            onClick={() => handleChangeAttendedQty(item, normalizedAttendedQty + 1)}
                                            aria-label={`Aumentar quantidade atendida de ${group.productName}`}
                                          >
                                            +
                                          </button>
                                          <div className="flex flex-col items-center gap-1 select-none">
                                            <span className={cn("text-xs font-medium tabular-nums", isZeroRequested ? "text-white/80" : "text-muted-foreground")}>{requestedQty}</span>
                                            <span className={cn("text-3xl font-semibold tabular-nums leading-none", isZeroRequested ? "text-white" : isAttended ? "text-emerald-600" : "text-foreground")}>
                                              {normalizedAttendedQty}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            className={cn(
                                              "flex h-9 w-9 items-center justify-center rounded-full border text-2xl leading-none transition-colors disabled:opacity-30",
                                              isZeroRequested
                                                ? "border-white/50 bg-white/15 text-white hover:bg-white/25"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                            disabled={!canDecrease}
                                            onClick={() => handleChangeAttendedQty(item, normalizedAttendedQty - 1)}
                                            aria-label={`Diminuir quantidade atendida de ${group.productName}`}
                                          >
                                            -
                                          </button>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>

            </CardContent>
          </Card>
        </div>

        <Dialog open={Boolean(productPreview)} onOpenChange={(open) => { if (!open) setProductPreview(null) }}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{productPreview?.productName || 'Produto'}</DialogTitle>
              <DialogDescription>Pré-visualização do item comprado</DialogDescription>
            </DialogHeader>

            {productPreview && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-lg border border-border/20 bg-muted">
                  {productPreview.imageUrl ? (
                    <img
                      src={productPreview.imageUrl}
                      alt={productPreview.productName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Sem imagem</div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">SKU</p>
                    <p className="font-medium break-all">{productPreview.sku || '-'}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Variantes compradas</p>
                    <div className="space-y-2 rounded-md border border-border/20 p-3">
                      {productPreview.variants.map((variant, index) => {
                        const safeAttributes = Array.isArray(variant.attributes)
                          ? variant.attributes
                          : [{ key: 'Variação', value: String((variant as any)?.variantLabel || variant.variantKey || '-') }]

                        const safeVariantKey = String(variant.variantKey || `variant-${index}`)

                        return (
                        <div key={safeVariantKey} className="rounded-md border border-border/20 p-3">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              {safeAttributes.map((attribute, attrIndex) => (
                                <div key={`${safeVariantKey}-${attribute.key}-${attrIndex}`} className="text-sm leading-relaxed">
                                  <span className="text-muted-foreground">{attribute.key}: </span>
                                  <span className="font-medium">{attribute.value}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between border-t border-border/20 pt-2 text-sm text-muted-foreground">
                              <span>Solicitado: {variant.requestedQty}</span>
                              <span>Atendido: {variant.attendedQty}</span>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Notes */}
        <div className="space-y-4">
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">R$ {subtotal.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Desconto</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Detalhes dos descontos">
                            <CircleHelp className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent align="start" className="max-w-xs">
                          <div className="space-y-2 text-xs">
                            <p className="font-medium">Composição dos descontos</p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Cupom</span>
                                <span className="tabular-nums">-R$ {couponDiscount.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Faixa (tier)</span>
                                <span className="tabular-nums">-R$ {tierDiscount.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Forma de pagamento</span>
                                <span className="tabular-nums">-R$ {paymentMethodDiscount.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Manual (admin)</span>
                                <span className="tabular-nums">-R$ {appliedManualDiscount.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {!editingDiscount ? (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingDiscount(true)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  {editingDiscount ? (
                    <div className="flex items-center justify-end gap-1">
                      <CurrencyInput
                        value={manualDiscount}
                        onChange={(value) => {
                          const normalized = Math.min(maxManualDiscount, Math.max(0, Number(value || 0)))
                          setManualDiscount(normalized)
                        }}
                        min={0}
                        max={maxManualDiscount}
                        helperText={`Máximo permitido: R$ ${maxManualDiscount.toFixed(2)}`}
                        fullWidth={false}
                        className="w-28 space-y-0"
                      />
                      <Button size="icon" className="h-8 w-8" onClick={handleSaveDiscount} disabled={isSaving}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingDiscount(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-semibold tabular-nums text-green-600">-R$ {totalDiscount.toFixed(2)}</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Frete</span>
                    {!editingShipping ? (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingShipping(true)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  {editingShipping ? (
                    <div className="flex items-center justify-end gap-1">
                      <CurrencyInput
                        value={shippingPrice}
                        onChange={(value) => setShippingPrice(value ?? 0)}
                        min={0}
                        fullWidth={false}
                        className="w-28 space-y-0"
                      />
                      <Button size="icon" className="h-8 w-8" onClick={handleSaveShipping} disabled={isSaving}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingShipping(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-semibold tabular-nums">R$ {(order.shippingPrice || 0).toFixed(2)}</span>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-base font-medium">Total Solicitado</span>
                  <span className="text-right text-xl font-medium tabular-nums">R$ {total.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-emerald-700 dark:text-emerald-400">Valor Atendido</span>
                  <span className="text-right text-xl font-medium tabular-nums text-emerald-700 dark:text-emerald-400">R$ {fulfilledTotal.toFixed(2)}</span>
                </div>

                {total > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">% Atendida</span>
                    <span className="text-sm font-medium tabular-nums text-amber-600">{((fulfilledTotal / total) * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              {editingNotes ? (
                <div className="space-y-4">
                  <div>
                    <Label>Observações do Cliente</Label>
                    <Textarea
                      value={notes}
                      readOnly
                      disabled
                      placeholder="Sem observações do cliente"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Observações Internas</Label>
                    <Textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Observações apenas para a equipe interna..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveNotes} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setEditingNotes(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Observações do Cliente</Label>
                    <p className="mt-1">{order.notes || 'Nenhuma observação'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Observações Internas</Label>
                    <p className="mt-1">{order.internalNotes || 'Nenhuma observação interna'}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingNotes(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Observações
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <OrderPaymentsCard
            orderId={orderId}
            paymentStatus={order?.paymentStatus}
          />
        </div>
      </div>

      {/* ── Floating Save + Actions ────────────────────────────────────── */}
      <div className="print:hidden fixed bottom-[88px] md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
        {/* Save button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Button
            onClick={handleSaveOrderChanges}
            disabled={isSaving}
            className="h-14 px-6 rounded-full bg-primary hover:bg-primary/90 shadow-[0_4px_24px_rgba(0,0,0,0.25)] text-sm font-semibold gap-2"
          >
            <Save className="h-5 w-5" />
            <span>Salvar</span>
          </Button>
        </motion.div>

        {/* Actions FAB */}
        <FloatingActionMenu
          className="relative bottom-auto right-auto"
          triggerLabel="Ações"
          align="center"
          options={[
            {
              label: 'Adicionar Produto',
              Icon: <Search className="h-4 w-4" />,
              onClick: () => setAddProductOpen(true),
            },
            {
              label: 'Marcar Todos Atendidos',
              Icon: <Check className="h-4 w-4" />,
              onClick: handleMarkAllFulfilled,
            },
            {
              label: 'Exportar PDF',
              Icon: <FileText className="h-4 w-4" />,
              onClick: handleExportPdf,
            },
            {
              label: 'Imprimir Etiqueta',
              Icon: <Printer className="h-4 w-4" />,
              onClick: handlePrintLabel,
            },
            {
              label: 'WhatsApp',
              Icon: <Send className="h-4 w-4" />,
              onClick: handleSendWhatsApp,
            },
          ]}
        />
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          body {
            font-size: 12px;
          }
        }
      `}</style>
    </AdminPage>
  );
}
