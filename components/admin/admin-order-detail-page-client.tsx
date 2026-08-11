"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
} from "@/components/ui/table";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  ArrowLeft,
  Package,
  Clock,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Edit,
  Save,
  X,
  FileText,
  Printer,
  Send,
  Truck,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  Activity,
  Webhook,
  DollarSign,
  Boxes,
  Percent,
  CircleHelp,
  Loader2,
  UserRound,
} from "lucide-react";
import {
  getOrderDetailAction,
  getOrderInvoiceAction,
  generateOrderInvoiceAction,
  refreshOrderInvoiceStatusAction,
  getOrderLabelAction,
  generateOrderLabelAction,
  regenerateOrderLabelAction,
  updateOrderAction,
  addOrderItemAction,
  deleteOrderItemAction,
  removeOrderItemAction,
  updateOrderItemAction,
  dispatchOrderWebhookAction,
  assignOrderSellerFromCustomerAction,
} from "@/lib/actions/orders";
import { dispatchOrderMessageAction } from "@/lib/actions/messaging";
import { getCorePaymentMethodsAction } from "@/lib/actions/settings";
import { resolveAvailableQtyByStockMode } from "@/lib/stock-mode";
import type { Order, OrderInvoice, OrderLabel, Customer, OrderItem, Product, ProductVariant, StockMode } from "@/lib/types";
import {
  AssistedOrderProductCatalog,
  type AssistedOrderVariantSelection,
} from "@/components/admin/assisted-order-product-catalog";
import CurrencyInput from "@/components/form/CurrencyInput";
import IntegerInput from "@/components/form/IntegerInput";
import OrderPaymentsCard from "@/components/admin/order-payments-card";
import FloatingActionMenu from "@/components/ui/floating-action-menu";
import { normalizeAdminLocale, tAdmin } from "@/lib/i18n/admin";
import { CloudflareImage } from "@/components/ui/cloudflare-image";
import { toast } from "sonner";
import { useAdminStore } from "@/contexts/admin-store-context";

function getOrderStatusLabels(locale?: string): Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> {
  return {
    PENDING: { label: tAdmin(locale, "admin.orders.status.pending", "Pending"), variant: "secondary" },
    IN_ANALYSIS: { label: tAdmin(locale, "admin.orders.status.inAnalysis", "Em Análise"), variant: "outline" },
    RELEASED: { label: tAdmin(locale, "admin.orders.status.released", "Liberado"), variant: "default" },
    CONFIRMED: { label: tAdmin(locale, "admin.orders.status.confirmed", "Confirmed"), variant: "default" },
    PROCESSING: { label: tAdmin(locale, "admin.orders.status.processing", "Processing"), variant: "default" },
    INVOICED: { label: tAdmin(locale, "admin.orders.status.invoiced", "Invoiced"), variant: "default" },
    SHIPPED: { label: tAdmin(locale, "admin.orders.status.shipped", "Shipped"), variant: "default" },
    DELIVERED: { label: tAdmin(locale, "admin.orders.status.delivered", "Delivered"), variant: "default" },
    CANCELLED: { label: tAdmin(locale, "admin.orders.status.cancelled", "Cancelled"), variant: "destructive" },
  };
}

function sanitizePreviewHtml(input: string): string {
  if (!input || typeof window === "undefined") return input

  const parser = new DOMParser()
  const doc = parser.parseFromString(input, "text/html")

  doc.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove())

  doc.querySelectorAll("*").forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase()
      const attrValue = attr.value.trim().toLowerCase()

      if (attrName.startsWith("on")) {
        element.removeAttribute(attr.name)
      }

      if ((attrName === "href" || attrName === "src") && (attrValue.startsWith("javascript:") || attrValue.startsWith("data:"))) {
        element.removeAttribute(attr.name)
      }
    }
  })

  return doc.body.innerHTML
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

function getPaymentMethodLabels(locale?: string): Record<'PIX' | 'BOLETO' | 'FATURADO' | 'CARTAO_EXTERNO', string> {
  return {
    PIX: tAdmin(locale, 'admin.payments.methods.pix', 'PIX'),
    BOLETO: tAdmin(locale, 'admin.payments.methods.boleto', 'Boleto'),
    FATURADO: tAdmin(locale, 'admin.payments.methods.faturado', 'Faturado'),
    CARTAO_EXTERNO: tAdmin(locale, 'admin.payments.methods.creditCard', 'Cartão'),
  }
}

function normalizeChaveNfe(value: string): string {
  return value.replace(/\s/g, "").replace(/\D/g, "")
}

function orderHasValidInvoiceChave(invoice: OrderInvoice | null): boolean {
  return normalizeChaveNfe(invoice?.accessKey ?? "").length === 44
}

interface OrderWithExtras extends Order {
  items: OrderItem[];
  customer?: Customer;
}

function getOrderItemOriginLabel(locale: string | undefined, origin?: 'customer' | 'manager_added' | 'replacement' | 'gift') {
  switch (origin) {
    case 'customer':
      return tAdmin(locale, 'admin.orders.itemOrigin.customer', 'Customer')
    case 'manager_added':
      return tAdmin(locale, 'admin.orders.itemOrigin.manager_added', 'Manager')
    case 'replacement':
      return tAdmin(locale, 'admin.orders.itemOrigin.replacement', 'Replacement')
    case 'gift':
      return tAdmin(locale, 'admin.orders.itemOrigin.gift', 'Gift')
    default:
      return tAdmin(locale, 'admin.orders.itemOrigin.customer', 'Customer')
  }
}

function getOrderOriginLabel(locale: string | undefined, origin?: 'customer' | 'manager' | 'api' | 'import' | string | null) {
  switch (origin) {
    case 'customer':
      return tAdmin(locale, 'admin.orders.itemOrigin.customer', 'Customer')
    case 'manager':
      return tAdmin(locale, 'admin.orders.itemOrigin.manager_added', 'Manager')
    case 'api':
      return 'API'
    case 'import':
      return locale === 'pt-BR' ? 'Importação' : 'Import'
    default:
      return '-'
  }
}

interface AdminOrderDetailPageClientProps {
  locale?: string
  orderId: string
  initialOrder: OrderWithExtras | null
  initialCustomer: Customer | null
  initialInvoice: OrderInvoice | null
  initialLabel: OrderLabel | null
  initialPayments: unknown[]
  initialPaymentLinks: unknown[]
  initialStockMode: StockMode
  initialStockVariantMaxQty: number
  initialAttributeLabels: {
    color: Record<string, string>
    size: Record<string, string>
    colorHex?: Record<string, string>
  }
}

type WebhookPayload = Record<string, unknown>

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

type VariantDimension = {
  rawKey: string
  normalizedKey: string
  label: string
  rawValue: string
  displayValue: string
}

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
  violeta: '#8b5cf6', lilas: '#c084fc',
  marrom: '#92400e', brown: '#92400e',
  bege: '#d4a96a', beige: '#d4a96a',
  caramelo: '#b45309', nude: '#e8c4a0',
  vinho: '#7f1d1d', burgundy: '#7f1d1d',
  dourado: '#d97706', gold: '#d97706',
  prata: '#94a3b8', silver: '#94a3b8',
  coral: '#fb7185', salmao: '#fca5a5',
  turquesa: '#06b6d4', mint: '#6ee7b7',
  off: '#fef9f0', creme: '#fef9f0',
}

function getColorDot(colorName: string | null, hexMap?: Record<string, string>): string {
  if (!colorName) return '#94a3b8'
  if (hexMap) {
    const direct = hexMap[colorName] || hexMap[colorName.toUpperCase()] || hexMap[colorName.toLowerCase()]
    if (direct) return direct
  }
  const key = colorName.toLowerCase().trim()
  if (COLOR_DOT_MAP[key]) return COLOR_DOT_MAP[key]

  for (const [mapKey, value] of Object.entries(COLOR_DOT_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return value
  }

  return '#94a3b8'
}

function isItemAttended(item: OrderItem): boolean {
  return item.status === 'attended' || item.fulfilled
}

function getItemAttendedQty(item: OrderItem): number {
  return isItemAttended(item) ? Math.max(0, Number(item.qty || 0)) : 0
}

function getOrderDisplayCode(
  order: Pick<Order, 'id' | 'code'> | null | undefined,
  fallbackId: string,
): string {
  const code = String(order?.code || '').trim()
  if (code) return code

  const rawId = String(order?.id || fallbackId || '').trim()
  return rawId.slice(0, 8).toUpperCase()
}

const SIZE_ORDER = [
  'PP', 'XS', 'P', 'S', 'M', 'G', 'L', 'GG', 'XL', 'G1', 'G2', 'G3', 'EG', 'EGG', 'XXL', 'XXXL',
  '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
  'P/M', 'M/G', 'G/GG', 'Unico', 'U',
]

type InvoiceFiscalSummary = {
  nature: string | null
  emitterName: string | null
  emitterCnpj: string | null
  selectionMode: string | null
}

type MobileInfoPanel = 'customer' | 'seller' | 'delivery' | 'status' | 'invoice' | 'label'
type CommunicationPanel = 'message' | 'webhook'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function normalizeFiscalSelectionMode(value: string | null | undefined): string | null {
  switch (String(value || '').trim()) {
    case 'fixed':
      return 'Fixo'
    case 'round_robin':
      return 'Round robin'
    case 'weighted_random':
      return 'Aleatório ponderado'
    default:
      return value ? String(value) : null
  }
}

function extractInvoiceFiscalSummary(invoice: OrderInvoice | null): InvoiceFiscalSummary | null {
  if (!invoice) return null

  const payloadValue = invoice.payload as unknown
  const document = Array.isArray(payloadValue) ? payloadValue[0] : payloadValue
  const docRecord = asRecord(document)
  if (!docRecord) return null

  const metadata = asRecord(docRecord.metadata)
  const selectedEmitter = asRecord(metadata?.selected_emitter)
  const emitente = asRecord(docRecord.emitente)

  const nature = typeof docRecord.natureza === 'string' && docRecord.natureza.trim()
    ? docRecord.natureza.trim()
    : null
  const emitterName = typeof selectedEmitter?.name === 'string' && selectedEmitter.name.trim()
    ? selectedEmitter.name.trim()
    : null
  const emitterCnpj = typeof selectedEmitter?.cnpj === 'string' && selectedEmitter.cnpj.trim()
    ? selectedEmitter.cnpj.trim()
    : typeof emitente?.cpfCnpj === 'string' && emitente.cpfCnpj.trim()
      ? emitente.cpfCnpj.trim()
      : null
  const selectionMode = typeof selectedEmitter?.selection_mode === 'string' && selectedEmitter.selection_mode.trim()
    ? normalizeFiscalSelectionMode(selectedEmitter.selection_mode)
    : null

  if (!nature && !emitterName && !emitterCnpj && !selectionMode) {
    return null
  }

  return {
    nature,
    emitterName,
    emitterCnpj,
    selectionMode,
  }
}

export default function AdminOrderDetailPageClient({
  locale,
  orderId,
  initialOrder,
  initialCustomer,
  initialInvoice,
  initialLabel,
  initialPayments,
  initialPaymentLinks,
  initialStockMode,
  initialStockVariantMaxQty,
  initialAttributeLabels,
}: AdminOrderDetailPageClientProps) {
  const { session } = useAdminStore();
  const router = useRouter();
  const permissionSet = useMemo(
    () => new Set(
      Array.isArray(session?.permissionCodes)
        ? session.permissionCodes
            .map((code) => String(code || '').trim().toLowerCase())
            .filter(Boolean)
        : []
    ),
    [session?.permissionCodes],
  )
  const canCreateOrder = permissionSet.has('orders.create')
  const canEditOrder = permissionSet.has('orders.edit')
  const canCancelOrder = permissionSet.has('orders.cancel')
  const canMarkOrderPaid = permissionSet.has('orders.mark_paid')
  const canManageShipping = permissionSet.has('orders.manage_shipping')
  const canManageReturns = permissionSet.has('orders.manage_returns')
  const canSendMessages = permissionSet.has('messaging.send')
  const normalizedLocale = normalizeAdminLocale(locale)
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback)
  const ORDER_STATUS_LABELS = getOrderStatusLabels(locale)
  const PAYMENT_STATUS_LABELS = getPaymentStatusLabels(locale)
  const PAYMENT_METHOD_LABELS = getPaymentMethodLabels(locale)
  const [order, setOrder] = useState<OrderWithExtras | null>(initialOrder);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const isLoading = false;
  const [isSaving, setIsSaving] = useState(false);
  const [isFloatingSaveLoading, setIsFloatingSaveLoading] = useState(false);
  const [invoice, setInvoice] = useState<OrderInvoice | null>(initialInvoice);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);
  const [invoiceRefreshing, setInvoiceRefreshing] = useState(false);
  const [label, setLabel] = useState<OrderLabel | null>(initialLabel);
  const [labelLoading, setLabelLoading] = useState(false);
  const [labelGenerating, setLabelGenerating] = useState(false);
  const [labelChaveModalOpen, setLabelChaveModalOpen] = useState(false);
  const [labelChaveModalMode, setLabelChaveModalMode] = useState<"generate" | "regenerate">("generate");
  const [labelChaveNfeInput, setLabelChaveNfeInput] = useState("");
  const [labelNumeroNfeInput, setLabelNumeroNfeInput] = useState("");
  const [labelChaveFormError, setLabelChaveFormError] = useState<string | null>(null);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<Array<{ id?: number; value: string; label: string }>>([]);

  // Edit states
  const [editingShipping, setEditingShipping] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingSaved, setTrackingSaved] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  // Form states
  const [shippingPrice, setShippingPrice] = useState(0);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [addProductOpen, setAddProductOpen] = useState(false);
  const [isAssigningSeller, setIsAssigningSeller] = useState(false);

  // Selected items for bulk actions
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [groupToRemove, setGroupToRemove] = useState<string | null>(null);
  const [stockModeConfig, setStockModeConfig] = useState<StockMode>(initialStockMode);
  const [stockVariantMaxQty, setStockVariantMaxQty] = useState(initialStockVariantMaxQty);

  const [attendedQtyDraft, setAttendedQtyDraft] = useState<Record<string, number>>({});
  const [openCellId, setOpenCellId] = useState<string | null>(null)
  const [productPreview, setProductPreview] = useState<ProductPreviewState | null>(null)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState("")
  const [mobileInfoPanel, setMobileInfoPanel] = useState<MobileInfoPanel | null>(null)
  const [messageTrigger, setMessageTrigger] = useState<"ORDER_CREATED" | "ORDER_INVOICE_GENERATED" | "ORDER_CONFIRMED" | "ORDER_PROCESSING" | "ORDER_SHIPPED" | "ORDER_DELIVERED" | "ORDER_CANCELLED">("ORDER_CREATED")
  const [messageChannel, setMessageChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP")
  const [isDispatchingMessage, setIsDispatchingMessage] = useState(false)
  const [dispatchFeedback, setDispatchFeedback] = useState<string>("")
  const [dispatchPreview, setDispatchPreview] = useState<string>("")
  const [dispatchPreviewHtml, setDispatchPreviewHtml] = useState<string>("")
  const [webhookEvent, setWebhookEvent] = useState<
    'order.created' | 'order.updated' | 'order.confirmed' | 'order.payment_confirmed' | 'order.shipped' | 'order.delivered' | 'order.cancelled'
  >('order.created')
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false)
  const [webhookDispatchFeedback, setWebhookDispatchFeedback] = useState<string>("")
  const [webhookDispatchPayload, setWebhookDispatchPayload] = useState<WebhookPayload | null>(null)
  const [communicationPanel, setCommunicationPanel] = useState<CommunicationPanel | null>(null)
  const [messageDispatchResultOpen, setMessageDispatchResultOpen] = useState(false)
  const [webhookDispatchResultOpen, setWebhookDispatchResultOpen] = useState(false)
  const invoiceFiscalSummary = extractInvoiceFiscalSummary(invoice)
  const hasInvoicePdf = Boolean(invoice?.pdfUrl?.trim())
  const hasInvoiceXml = Boolean(invoice?.xmlUrl?.trim())
  const invoicePdfHref = invoice && hasInvoicePdf
    ? `/api/admin/invoice-download?kind=pdf&orderId=${encodeURIComponent(String(invoice.orderId || ''))}`
    : null
  const invoiceXmlHref = invoice && hasInvoiceXml
    ? `/api/admin/invoice-download?kind=xml&orderId=${encodeURIComponent(String(invoice.orderId || ''))}`
    : null
  const invoiceIsAwaitingProvider = Boolean(
    invoice &&
    (invoice.status === 'PENDING' || invoice.status === 'PROCESSING') &&
    invoice.integrationReferenceId
  )
  const canGenerateInvoice = !invoice || !invoiceIsAwaitingProvider
  const orderDisplayCode = getOrderDisplayCode(order, orderId)

  async function handleDispatchOrderMessage() {
    if (!order) return
    if (!canSendMessages) {
      setDispatchFeedback('Você não tem permissão para enviar mensagens')
      return
    }

    setIsDispatchingMessage(true)
    setDispatchFeedback("")

    const result = await dispatchOrderMessageAction({
      orderId: order.id,
      trigger: messageTrigger,
      channel: messageChannel,
    })

    if (!result.success || !result.data) {
      const error = result.error || tr('admin.orders.messaging.dispatchError', 'Nao foi possivel disparar a mensagem')
      setDispatchFeedback(error)
      setIsDispatchingMessage(false)
      return
    }

    const renderedMessage = result.data.renderedMessage || ""
    setDispatchPreview(renderedMessage)
    setDispatchPreviewHtml(sanitizePreviewHtml(renderedMessage))
    setDispatchFeedback(`${result.data.message} (${result.data.recipient})`)
    setWebhookDispatchResultOpen(false)
    setMessageDispatchResultOpen(true)

    if (result.data.whatsappUrl) {
      window.open(result.data.whatsappUrl, '_blank', 'noopener,noreferrer')
    }

    setIsDispatchingMessage(false)
  }

  async function handleDispatchOrderWebhook() {
    if (!order) return
    setIsDispatchingWebhook(true)
    setWebhookDispatchFeedback("")
    setWebhookDispatchPayload(null)

    const result = await dispatchOrderWebhookAction(order.id, webhookEvent)

    if (!result.success || !result.data) {
      const error = result.error || tr('admin.orders.webhook.dispatchError', 'Nao foi possivel disparar o webhook')
      setWebhookDispatchFeedback(error)
      setIsDispatchingWebhook(false)
      return
    }

    setWebhookDispatchFeedback(`${result.data.message} (${result.data.event})`)
    setWebhookDispatchPayload((result.data.payload as WebhookPayload | undefined) || null)
    setMessageDispatchResultOpen(false)
    setWebhookDispatchResultOpen(true)
    setIsDispatchingWebhook(false)
  }

  function openErrorDialog(message: string) {
    setErrorDialogMessage(message)
    setErrorDialogOpen(true)
  }

  function showActionError(rawError: unknown, fallback: string) {
    toast.error(extractActionErrorMessage(rawError, fallback))
  }

  function extractActionErrorMessage(rawError: unknown, fallback: string): string {
    if (typeof rawError !== 'string') return fallback

    const text = rawError.trim()
    if (!text) return fallback

    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>
        const error = typeof record.error === 'string' ? record.error.trim() : ''
        if (error) return error

        const message = typeof record.message === 'string' ? record.message.trim() : ''
        if (message) return message
      }
    } catch {
      // Keep raw string when backend returns plain text.
    }

    return text
  }

  function resolveAttributeLabel(
    value: string | null | undefined,
    labels: Record<string, string>
  ): string {
    const raw = String(value || '').trim()
    if (!raw) return '-'
    return labels[raw] || labels[raw.toUpperCase()] || labels[raw.toLowerCase()] || raw
  }

  function normalizeVariantAttributeKind(key: string): string {
    const normalized = key.trim().toLowerCase()
    if (['cor', 'color'].includes(normalized)) return 'color'
    if (['tam', 'tamanho', 'size'].includes(normalized)) return 'size'
    return normalized
  }

  function formatVariantAttributeLabel(key: string): string {
    const normalized = normalizeVariantAttributeKind(key)
    if (normalized === 'color') return tr('admin.orders.attribute.color', 'Color')
    if (normalized === 'size') return tr('admin.orders.attribute.size', 'Size')

    return key
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/^\w/, (char) => char.toUpperCase())
  }

  function formatVariantAttributeValue(normalizedKey: string, value: string): string {
    if (normalizedKey === 'color') return resolveAttributeLabel(value, initialAttributeLabels.color)
    if (normalizedKey === 'size') return resolveAttributeLabel(value, initialAttributeLabels.size)
    return value
  }

  function getVariantDimensions(item: OrderItem): VariantDimension[] {
    const raw = String(item.variantCombinationKey || '').trim()
    if (raw) {
      const keyValueMatches = Array.from(raw.matchAll(/([^|,;:]+):([^|,;]+)/g))
      if (keyValueMatches.length > 0) {
        const parsed = keyValueMatches
          .map((match) => {
            const rawKey = String(match[1] || '').trim()
            const rawValue = String(match[2] || '').trim()
            if (!rawKey || !rawValue) return null

            const normalizedKey = normalizeVariantAttributeKind(rawKey)
            return {
              rawKey,
              normalizedKey,
              label: formatVariantAttributeLabel(rawKey),
              rawValue,
              displayValue: formatVariantAttributeValue(normalizedKey, rawValue),
            }
          })
          .filter((entry): entry is VariantDimension => Boolean(entry))

        if (parsed.length > 0) return parsed
      }
    }

    const fallback: VariantDimension[] = []
    const colorRaw = String(item.colorSnapshot || '').trim()
    const sizeRaw = String(item.sizeSnapshot || '').trim()

    if (colorRaw) {
      fallback.push({
        rawKey: 'color',
        normalizedKey: 'color',
        label: tr('admin.orders.attribute.color', 'Color'),
        rawValue: colorRaw,
        displayValue: resolveAttributeLabel(colorRaw, initialAttributeLabels.color),
      })
    }

    if (sizeRaw) {
      fallback.push({
        rawKey: 'size',
        normalizedKey: 'size',
        label: tr('admin.orders.attribute.size', 'Size'),
        rawValue: sizeRaw,
        displayValue: resolveAttributeLabel(sizeRaw, initialAttributeLabels.size),
      })
    }

    return fallback
  }

  function compareVariantDimensionValues(a: VariantDimension, b: VariantDimension): number {
    if (a.normalizedKey === 'size' && b.normalizedKey === 'size') {
      const ai = SIZE_ORDER.indexOf(a.rawValue)
      const bi = SIZE_ORDER.indexOf(b.rawValue)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
    }

    return a.displayValue.localeCompare(b.displayValue)
  }

  function resolveProductSku(item: OrderItem): string {
    const productSku = String(item.productSkuSnapshot || '').trim()
    if (productSku) {
      return productSku
    }

    const variantSku = String(item.skuSnapshot || '').trim()
    if (variantSku) {
      return variantSku
    }

    return '-'
  }

  function resolveVariantAttributes(item: OrderItem): Array<{ key: string; value: string }> {
    const dimensions = getVariantDimensions(item)
    if (dimensions.length > 0) {
      return dimensions.map((dimension) => ({ key: dimension.label, value: dimension.displayValue }))
    }

    const raw = String(item.variantCombinationKey || '').trim()
    if (raw) {
      return [{ key: tr('admin.orders.attribute.variation', 'Variation'), value: raw }]
    }

    return [{ key: tr('admin.orders.attribute.variation', 'Variation'), value: tr('admin.orders.attribute.none', 'Sem variacao') }]
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
      nextAttendedDraft[item.id] = getItemAttendedQty(item);
    }
    setAttendedQtyDraft(nextAttendedDraft);
  }, [order]);

  // Invoice and label are preloaded by server route for initial render performance.

  useEffect(() => {
    if (!orderId) return;
    void loadLabel();
  }, [orderId]);

  useEffect(() => {
    setStockModeConfig(initialStockMode);
    setStockVariantMaxQty(initialStockVariantMaxQty);
  }, [initialStockMode, initialStockVariantMaxQty]);

  function getMaxOrderEditQty(params: {
    currentQty?: number
    availableQty?: number
    variantStock?: number
    reservedQty?: number
  }): number {
    const currentQty = Math.max(0, Math.floor(Number(params.currentQty || 0)))
    const stockQty = Math.max(
      0,
      Math.floor(Number(params.variantStock ?? params.availableQty ?? 0)),
    )
    const reservedQty = Math.max(0, Math.floor(Number(params.reservedQty || 0)))
    const available = resolveAvailableQtyByStockMode({
      stockMode: stockModeConfig,
      variantMaxQty: stockVariantMaxQty,
      stockQty,
      reservedQty,
    })

    return Math.max(currentQty, available)
  }

  function resolveVariantAvailableQty(stockQty: number, reservedQty: number): number {
    return resolveAvailableQtyByStockMode({
      stockMode: stockModeConfig,
      variantMaxQty: stockVariantMaxQty,
      stockQty,
      reservedQty,
    })
  }

  function clampOrderEditQty(value: number, maxAllowed: number, minAllowed: number = 1): number {
    const normalizedMin = Math.max(0, Math.floor(Number(minAllowed || 0)));
    const normalizedMax = Math.max(normalizedMin, Math.floor(Number(maxAllowed || normalizedMin)));
    const normalizedValue = Math.floor(Number(value || 0));
    return Math.max(normalizedMin, Math.min(normalizedMax, normalizedValue));
  }

  async function handleAssignSellerFromCustomer() {
    if (!orderId || !order || order.assignedSellerId) return;

    if (!customer?.assignedSellerId) {
      toast.error(tr('admin.orders.seller.noCustomerSeller', 'Cliente não possui vendedora atribuída'));
      return;
    }

    setIsAssigningSeller(true);
    try {
      const result = await assignOrderSellerFromCustomerAction(orderId);
      if (!result.success || !result.data) {
        toast.error(result.error || tr('admin.orders.seller.assignError', 'Não foi possível atribuir a vendedora ao pedido'));
        return;
      }

      setOrder((current) =>
        current
          ? {
              ...current,
              assignedSellerId: result.data!.assignedSellerId,
              assignedSellerName: result.data!.assignedSellerName,
            }
          : current,
      );
      toast.success(tr('admin.orders.seller.assignSuccess', 'Vendedora atribuída ao pedido'));
    } finally {
      setIsAssigningSeller(false);
    }
  }

  async function refreshOrderDataOnly(preserveScroll: boolean = false) {
    if (!orderId) return;

    const savedScroll = preserveScroll
      ? { x: window.scrollX, y: window.scrollY }
      : null;

    const orderResult = await getOrderDetailAction(orderId);

    if (orderResult.success && orderResult.data) {
      const orderData = orderResult.data;
      setOrder(orderData);
      setShippingPrice(orderData.shippingPrice || 0);
      setManualDiscount(orderData.manualDiscount || 0);
      setLabel(orderData.label ?? null);
      setInvoice(orderData.invoice ?? null);

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

  async function loadInvoice() {
    if (!orderId) return;
    setInvoiceLoading(true);
    const result = await getOrderInvoiceAction(orderId);
    if (result.success && result.data) {
      setInvoice(result.data);
    } else {
      setInvoice(null);
    }
    setInvoiceLoading(false);
  }

  async function loadLabel() {
    if (!orderId) return;
    setLabelLoading(true);
    const result = await getOrderLabelAction(orderId);
    if (result.success && result.data) {
      setLabel(result.data);
    } else {
      setLabel(null);
    }
    setLabelLoading(false);
  }

  async function handleGenerateLabel(chaveData?: { chaveNfe?: string; numeroNfe?: string }) {
    if (!order || !canEditOrder) return;
    setLabelGenerating(true);
    const result = await generateOrderLabelAction(order.id, chaveData);
    if (!result.success) {
      openErrorDialog(result.error || 'Não foi possível gerar a etiqueta');
      setLabelGenerating(false);
      return;
    }

    setLabel(result.data || null);
    setLabelChaveModalOpen(false);
    await refreshOrderDataOnly(true);
    setLabelGenerating(false);
  }

  async function handleRegenerateLabel(chaveData?: { chaveNfe?: string; numeroNfe?: string }) {
    if (!order || !canEditOrder) return;
    setLabelGenerating(true);
    const result = await regenerateOrderLabelAction(order.id, chaveData);
    if (!result.success) {
      openErrorDialog(result.error || 'Não foi possível regenerar a etiqueta');
      setLabelGenerating(false);
      return;
    }

    setLabel(result.data || null);
    setLabelChaveModalOpen(false);
    await refreshOrderDataOnly(true);
    setLabelGenerating(false);
  }

  function openLabelChaveModal(mode: "generate" | "regenerate") {
    setLabelChaveModalMode(mode);
    setLabelChaveNfeInput("");
    setLabelNumeroNfeInput(invoice?.nfNumber?.trim() ?? "");
    setLabelChaveFormError(null);
    setLabelChaveModalOpen(true);
  }

  function handleGenerateLabelClick() {
    if (!order || !canEditOrder) return;
    if (!orderHasValidInvoiceChave(invoice)) {
      openLabelChaveModal("generate");
      return;
    }
    void handleGenerateLabel();
  }

  function handleRegenerateLabelClick() {
    if (!order || !canEditOrder) return;
    if (!orderHasValidInvoiceChave(invoice)) {
      openLabelChaveModal("regenerate");
      return;
    }
    void handleRegenerateLabel();
  }

  async function handleConfirmLabelChaveModal() {
    const chave = normalizeChaveNfe(labelChaveNfeInput);
    if (chave.length !== 44) {
      setLabelChaveFormError("A chave NF-e deve ter 44 dígitos.");
      return;
    }

    setLabelChaveFormError(null);
    const payload = {
      chaveNfe: chave,
      numeroNfe: labelNumeroNfeInput.trim() || undefined,
    };

    if (labelChaveModalMode === "regenerate") {
      await handleRegenerateLabel(payload);
    } else {
      await handleGenerateLabel(payload);
    }
  }

  async function handleRefreshLabel() {
    if (!orderId) return;
    setLabelLoading(true);
    await loadLabel();
    await refreshOrderDataOnly(true);
  }

  async function handleGenerateInvoice() {
    if (!order) return;
    if (!canEditOrder) return;
    setInvoiceGenerating(true);
    const result = await generateOrderInvoiceAction(order.id);
    if (!result.success) {
      openErrorDialog(result.error || tr('admin.orders.alerts.generateInvoice', 'Não foi possível gerar a nota fiscal do pedido'));
      setInvoiceGenerating(false);
      return;
    }

    setInvoice(result.data || null);
    await refreshOrderDataOnly(true);
    setInvoiceGenerating(false);
  }

  async function handleRefreshInvoiceStatus() {
    if (!order || !invoice) return;
    if (!canEditOrder) return;
    setInvoiceRefreshing(true);
    const result = await refreshOrderInvoiceStatusAction(order.id);
    if (!result.success) {
      openErrorDialog(result.error || tr('admin.orders.alerts.refreshInvoice', 'Não foi possível consultar o status da nota fiscal'));
      setInvoiceRefreshing(false);
      return;
    }

    setInvoice(result.data || null);
    await refreshOrderDataOnly(true);
    setInvoiceRefreshing(false);
  }

  useEffect(() => {
    if (!order || !invoice) return;
    if (!canEditOrder) return;
    if (invoice.status !== 'PROCESSING') return;
    if (!invoice.integrationReferenceId) return;
    if (invoiceRefreshing || invoiceGenerating || isSaving) return;

    const timerId = window.setTimeout(async () => {
      setInvoiceRefreshing(true);
      const result = await refreshOrderInvoiceStatusAction(order.id);
      if (result.success) {
        setInvoice(result.data || null);
        await refreshOrderDataOnly(true);
      }
      setInvoiceRefreshing(false);
    }, 5000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    canEditOrder,
    order,
    invoice,
    invoiceRefreshing,
    invoiceGenerating,
    isSaving,
  ]);

  useEffect(() => {
    let isMounted = true

    const loadPaymentMethods = async () => {
      const result = await getCorePaymentMethodsAction()
      if (!isMounted) return
      if (result.success && result.data) {
        setAvailablePaymentMethods(result.data)
      } else {
        setAvailablePaymentMethods([])
      }
    }

    void loadPaymentMethods()
    return () => {
      isMounted = false
    }
  }, [])

  const paymentMethodOptions = availablePaymentMethods.length > 0
    ? availablePaymentMethods
    : [
        { value: 'PIX', label: PAYMENT_METHOD_LABELS.PIX },
        { value: 'BOLETO', label: PAYMENT_METHOD_LABELS.BOLETO },
        { value: 'FATURADO', label: PAYMENT_METHOD_LABELS.FATURADO },
        { value: 'CARTAO_EXTERNO', label: PAYMENT_METHOD_LABELS.CARTAO_EXTERNO },
      ]

  async function handleStatusChange(newStatus: string) {
    if (!order) return;
    if (!canEditOrder) return;
    if (hasPendingFulfillmentCompletion) {
      openErrorDialog(fulfillmentCompletionBlockMessage);
      return;
    }
    if (newStatus === 'CANCELLED' && !canCancelOrder) return;
    if ((newStatus === 'SHIPPED' || newStatus === 'DELIVERED') && !canManageShipping) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { status: newStatus as Order["status"] });
    if (result.success) {
      await refreshOrderDataOnly();
    } else {
      showActionError(result.error, tr('admin.orders.alerts.updateStatus', 'Nao foi possivel atualizar o status do pedido'))
    }
    setIsSaving(false);
  }

  async function handlePaymentStatusChange(newStatus: string) {
    if (!order) return;
    if (!canEditOrder) return;
    if (hasPendingFulfillmentCompletion) {
      openErrorDialog(fulfillmentCompletionBlockMessage);
      return;
    }
    if ((newStatus === 'PAID' || newStatus === 'PARTIAL') && !canMarkOrderPaid) return;
    if ((newStatus === 'REFUNDED' || newStatus === 'CANCELLED') && !canManageReturns) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { paymentStatus: newStatus as 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED' });
    if (result.success) {
      await refreshOrderDataOnly();
    } else {
      showActionError(result.error, tr('admin.orders.alerts.updatePaymentStatus', 'Nao foi possivel atualizar o status do pagamento'))
    }
    setIsSaving(false);
  }

  async function handleSaveShipping() {
    if (!order) return;
    if (!canEditOrder) return;
    if (!canManageShipping) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { shippingPrice });
    if (result.success) {
      await refreshOrderDataOnly(true);
    } else {
      showActionError(result.error, tr('admin.orders.alerts.updateShipping', 'Nao foi possivel atualizar o frete'))
    }
    setEditingShipping(false);
    setIsSaving(false);
  }

  async function handleSaveDiscount() {
    if (!order) return;
    if (!canEditOrder) return;
    setIsSaving(true);
    const savedScroll = { x: window.scrollX, y: window.scrollY };
    const maxAllowedDiscount = Math.max(
      0,
      orderSubtotal + (order.shippingPrice || 0) - (order.discountTotal || 0)
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
    } else if (!result.success) {
      showActionError(result.error, tr('admin.orders.alerts.updateDiscount', 'Nao foi possivel atualizar o desconto manual'))
    }
    setEditingDiscount(false);
    setIsSaving(false);
  }

  async function handleSaveTracking() {
    if (!order) return;
    if (!canEditOrder) return;
    if (!canManageShipping) return;
    if (trackingLockedByLabel) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { trackingCode, trackingUrl });
    if (result.success) {
      await refreshOrderDataOnly();
      setTrackingSaved(true);
      setTimeout(() => setTrackingSaved(false), 1800);
    } else {
      showActionError(result.error, tr('admin.orders.alerts.updateTracking', 'Nao foi possivel atualizar o rastreio'))
    }
    setEditingTracking(false);
    setIsSaving(false);
  }

  async function handleSaveOrderChanges() {
    if (!order) return;
    if (!canEditOrder) return;

    const currentTracking = (order.trackingCode || '').trim();
    const nextTracking = (trackingCode || '').trim();

    if (currentTracking !== nextTracking) {
      await handleSaveTracking();
      return;
    }

    await refreshOrderDataOnly();
  }

  async function handleFloatingSaveClick() {
    if (!canEditOrder) return;
    setIsFloatingSaveLoading(true);

    try {
      await handleSaveOrderChanges();
    } finally {
      setIsFloatingSaveLoading(false);
    }
  }

  async function handleExportPdf() {
    if (!order) return;

    await handleSaveOrderChanges();

    const href = `/api/admin/order-print-pdf?orderId=${encodeURIComponent(String(order.id))}`;
    window.open(href, '_blank', 'noopener,noreferrer');
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
          <title>${tr('admin.orders.print.labelTitle', 'Order Label')} ${getOrderDisplayCode(order, orderId)}</title>
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
            <div class="title">${tr('admin.orders.title', 'Order')} ${getOrderDisplayCode(order, orderId)}</div>
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

  async function handlePrintRomaneio() {
    if (!order) return;

    await handleSaveOrderChanges();

    const href = `/api/admin/order-manifest-pdf?orderId=${encodeURIComponent(String(order.id))}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function handleOpenWhatsApp() {
    const rawPhone = String(customer?.phone || '').trim();
    const phoneDigits = rawPhone.replace(/\D/g, '');

    if (phoneDigits.length < 10) {
      openErrorDialog('Telefone do cliente inválido para WhatsApp');
      return;
    }

    const customerName = customer?.contactName || customer?.companyName || 'cliente';
    const statusKey = String(order?.status || 'PENDING').toUpperCase();
    const statusLabel = ORDER_STATUS_LABELS[statusKey]?.label || 'Pendente';
    const orderCode = getOrderDisplayCode(order, orderId);
    const message = `Olá, ${customerName}! Seu pedido *#${orderCode}* está com status: *${statusLabel}*. Qualquer dúvida, estamos à disposição!`;
    const whatsappUrl = `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleTrackingBlur() {
    if (!order) return;
    if (!canEditOrder) {
      setEditingTracking(false);
      return;
    }
    if (trackingLockedByLabel) {
      setTrackingCode(order.trackingCode || "");
      setEditingTracking(false);
      return;
    }
    const currentTracking = (order.trackingCode || '').trim();
    const nextTracking = (trackingCode || '').trim();
    if (currentTracking === nextTracking) {
      setEditingTracking(false);
      return;
    }
    await handleSaveTracking();
  }

  async function handleSaveNotes() {
    if (!order) return;
    if (!canEditOrder) return;
    setIsSaving(true);
    const result = await updateOrderAction(order.id, { internalNotes });
    if (result.success) {
      await refreshOrderDataOnly();
    } else {
      showActionError(result.error, tr('admin.orders.alerts.updateInternalNotes', 'Nao foi possivel salvar as observacoes internas'))
    }
    setEditingNotes(false);
    setIsSaving(false);
  }

  async function handlePaymentMethodChange(value: string) {
    if (!order) return;
    if (!canEditOrder) return;

    const selectedMethod = paymentMethodOptions.find((method) => method.value === value)
    if (!selectedMethod?.id || !Number.isFinite(Number(selectedMethod.id)) || Number(selectedMethod.id) <= 0) {
      openErrorDialog('Método de pagamento sem methodId válido. Verifique Configurações > Métodos de Pagamento.')
      return
    }

    setIsSaving(true);
    const result = await updateOrderAction(order.id, {
      paymentMethodId: Number(selectedMethod.id),
      paymentMethod: value as 'PIX' | 'BOLETO' | 'FATURADO' | 'CARTAO_EXTERNO'
    });
    if (result.success) {
      await refreshOrderDataOnly();
    } else {
      showActionError(result.error, tr('admin.orders.alerts.updatePaymentMethod', 'Nao foi possivel atualizar o metodo de pagamento'))
    }
    setIsSaving(false);
  }

  async function handleCatalogAddVariants(payload: {
    product: Product
    items: AssistedOrderVariantSelection[]
  }): Promise<boolean> {
    if (!order || !canEditOrder) return false
    if (order.status === 'RELEASED') return false

    setIsSaving(true)
    try {
      for (const item of payload.items) {
        const result = await addOrderItemAction(order.id, {
          productId: payload.product.id,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          origin: 'manager_added',
        })

        if (!result.success) {
          openErrorDialog(result.error || tr('admin.orders.alerts.addItem', 'Could not add item to order'))
          return false
        }
      }

      await refreshOrderDataOnly()
      setAddProductOpen(false)
      return true
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCatalogBarcodeScan(payload: {
    product: Product
    variant: ProductVariant
  }): Promise<boolean> {
    if (!order || !canEditOrder) return false
    if (order.status === 'RELEASED') return false

    const maxAllowed = getMaxOrderEditQty({
      variantStock: payload.variant.stock,
      currentQty: 0,
    })

    if (maxAllowed < 1) {
      openErrorDialog(tr('admin.orders.alerts.variantUnavailable', 'Variant unavailable for this stock mode'))
      return false
    }

    const unitPrice = typeof payload.variant.priceOverride === 'number'
      ? payload.variant.priceOverride
      : payload.product.basePrice

    setIsSaving(true)
    try {
      const result = await addOrderItemAction(order.id, {
        productId: payload.product.id,
        variantId: payload.variant.id,
        quantity: 1,
        unitPrice,
        origin: 'manager_added',
      })

      if (!result.success) {
        openErrorDialog(result.error || tr('admin.orders.alerts.addItem', 'Could not add item to order'))
        return false
      }

      await refreshOrderDataOnly()
      return true
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!order) return;
    if (!canEditOrder) return;
    if (order.status === 'RELEASED') return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    await removeOrderItemAction(order.id, itemId);
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleRemoveSelectedItems() {
    if (!order || selectedItems.length === 0) return;
    if (!canEditOrder) return;
    if (order.status === 'RELEASED') return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    for (const itemId of selectedItems) {
      await deleteOrderItemAction(order.id, itemId);
    }
    setSelectedItems([]);
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleReactivateItem(itemId: string) {
    if (!order) return;
    if (!canEditOrder) return;
    if (order.status === 'RELEASED') return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    await updateOrderItemAction(order.id, itemId, { fulfilled: false });
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleToggleFulfilled(itemId: string, fulfilled: boolean) {
    if (!order) return;
    if (!canEditOrder) return;
    if (order.status === 'RELEASED') return;
    if (order.status === 'CONFIRMED') return;
    setIsSaving(true);
    await updateOrderItemAction(order.id, itemId, { fulfilled });
    await refreshOrderDataOnly();
    setIsSaving(false);
  }

  async function handleMarkAllFulfilled() {
    if (!order) return;
    if (!canEditOrder) return;
    if (order.status === 'RELEASED') return;
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

  async function handleSaveAttendedQty(item: OrderItem, draftOverride?: number) {
    if (!order) return;
    if (!canEditOrder) return;
    if (order.status === 'RELEASED') return;
    if (order.status === 'CONFIRMED') return;

    const requestedQty = Math.max(0, Number(item.originalQty ?? item.qty));
    const stockLimit = Math.max(requestedQty, getMaxOrderEditQty({
      currentQty: item.qty,
      variantStock: item.variantStockQty,
      reservedQty: item.variantReservedQty,
    }));
    const baseAttendedQty = getItemAttendedQty(item);
    const rawDraft = Number(draftOverride ?? attendedQtyDraft[item.id] ?? baseAttendedQty);
    const nextQty = clampOrderEditQty(Math.round(rawDraft), stockLimit, 0);

    if (nextQty === baseAttendedQty) return;

    setIsSaving(true);
    let result;

    if (nextQty <= 0) {
      result = await updateOrderItemAction(order.id, item.id, { fulfilled: false });
    } else {
      if (!isItemAttended(item)) {
        const fulfillResult = await updateOrderItemAction(order.id, item.id, { fulfilled: true });
        if (!fulfillResult.success) {
          toast.error(fulfillResult.error || tr('admin.orders.alerts.updateItem', 'Nao foi possivel atualizar o item do pedido'))
          setIsSaving(false);
          return;
        }
      }

      result = await updateOrderItemAction(order.id, item.id, {
        quantity: nextQty,
        unitPrice: item.unitPrice,
      });
    }

    if (result.success) {
      await refreshOrderDataOnly();
    } else {
      toast.error(result.error || tr('admin.orders.alerts.updateItem', 'Nao foi possivel atualizar o item do pedido'))
    }
    setIsSaving(false);
  }

  async function handleRemoveGroupItems(items: OrderItem[]) {
    if (!order || items.length === 0) return;
    if (!canEditOrder) return;
    if (order.status === 'CONFIRMED') return;

    setIsSaving(true);
    for (const item of items) {
      await deleteOrderItemAction(order.id, item.id);
    }
    await refreshOrderDataOnly();
    setGroupToRemove(null);
    setIsSaving(false);
  }

  async function handleReactivateGroupItems(items: OrderItem[]) {
    if (!order || items.length === 0) return;
    if (!canEditOrder) return;
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
  const deliveryStatusValue = order.status === 'SHIPPED'
    ? 'SHIPPED'
    : order.status === 'DELIVERED'
      ? 'DELIVERED'
      : order.status === 'CANCELLED'
        ? 'CANCELLED'
        : 'PENDING'
  const activeItemsCount = order.items.filter((item) => String(item.status || 'active').toLowerCase() === 'active').length
  const progressedItemsCount = order.items.filter((item) => {
    const normalizedStatus = String(item.status || 'active').toLowerCase()
    return normalizedStatus === 'attended' || normalizedStatus === 'removed'
  }).length
  const hasPendingFulfillmentCompletion = progressedItemsCount > 0 && activeItemsCount > 0
  const fulfillmentCompletionBlockMessage = hasPendingFulfillmentCompletion
    ? `Processo de atendimento iniciado. Ainda existem ${activeItemsCount} item(ns) em estado inicial (active). Finalize os itens (atendido ou não atendido) para liberar alteração de status e geração de link de pagamento.`
    : ''

  const orderStatusBadgeClass = (status: string) => {
    if (status === 'DELIVERED' || status === 'CONFIRMED' || status === 'INVOICED') return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    if (status === 'PENDING' || status === 'IN_ANALYSIS') return 'bg-amber-50 text-amber-600 border border-amber-100'
    if (status === 'RELEASED') return 'bg-blue-50 text-blue-600 border border-blue-100'
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
    if (status === 'PROCESSING') return 'bg-amber-50 text-amber-700 border border-amber-100'
    return 'bg-muted/60 text-muted-foreground border border-border/60'
  }

  const getLabelStatusLabel = (status?: string | null) => {
    switch (String(status || '').toUpperCase()) {
      case 'ISSUED':
        return tr('admin.orders.labelStatus.issued', 'Issued')
      case 'ERROR':
        return tr('admin.orders.labelStatus.error', 'Error')
      case 'PROCESSING':
        return tr('admin.orders.labelStatus.processing', 'Processing')
      default:
        return status || tr('admin.orders.labelStatus.none', 'No status')
    }
  }

  const canGenerateLabel = canEditOrder && !label
  const canRegenerateLabel = canEditOrder && label?.status === 'ERROR'
  const labelIsProcessing = label?.status === 'PROCESSING'
  const trackingLockedByLabel = useMemo(() => {
    if (order?.trackingSource === 'label') return true
    if (!label) return false
    if (label.status !== 'ISSUED' && label.status !== 'PROCESSING') return false
    return Boolean(label.trackingCode?.trim())
  }, [order?.trackingSource, label])

  // Calculate totals
  const requestedSubtotal = order.items.reduce((sum, item) => {
    const requestedQty = Math.max(0, Number(item.originalQty ?? item.qty));
    return sum + requestedQty * Math.max(0, Number(item.unitPrice || 0));
  }, 0);
  const hasFulfillmentProgress = progressedItemsCount > 0
  const attendedSubtotal = order.items
    .filter((item) => item.status !== 'removed' && isItemAttended(item))
    .reduce((sum, item) => sum + (getItemAttendedQty(item) * Math.max(0, Number(item.unitPrice || 0))), 0)
  const orderSubtotal = hasFulfillmentProgress
    ? Math.max(0, attendedSubtotal)
    : Math.max(0, Number(order.subtotal || 0));
  const couponDiscount = order.couponDiscount || 0;
  const tierDiscount = order.tierDiscount || 0;
  const compositionDiscount = Math.max(0, Number(order.compositionDiscountTotal || 0));
  const nonCompositionDiscount = Math.max(0, (order.discountTotal || 0) - compositionDiscount);
  const paymentMethodDiscount = Math.max(
    0,
    nonCompositionDiscount - couponDiscount - tierDiscount
  );
  const maxManualDiscount = Math.max(0, orderSubtotal + (order.shippingPrice || 0) - nonCompositionDiscount);
  const appliedManualDiscount = Math.min(Math.max(0, manualDiscount), maxManualDiscount);
  const totalDiscount = nonCompositionDiscount + appliedManualDiscount;
  const requestedTotal = Math.max(0, requestedSubtotal - totalDiscount + (order.shippingPrice || 0));
  const orderTotal = Math.max(0, orderSubtotal - totalDiscount + (order.shippingPrice || 0));
  const fulfilledItemsTotal = attendedSubtotal
  const fulfilledTotal = fulfilledItemsTotal > 0
    ? Math.max(0, fulfilledItemsTotal - totalDiscount + (order.shippingPrice || 0))
    : 0;

  const groupedItems = order.items
    .reduce((acc, item) => {
      const dimensions = getVariantDimensions(item)
      const groupDimensions = dimensions.length > 2 ? dimensions.slice(0, -2) : []
      const groupDimensionKey = groupDimensions
        .map((dimension) => `${dimension.normalizedKey}:${dimension.rawValue}`)
        .join('|') || '__base__'
      const assetKey = String(item.assetId || '-').trim();
      const groupKey = `${item.productId}::${assetKey}::${groupDimensionKey}`;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          key: groupKey,
          productName: item.nameSnapshot,
          sku: resolveProductSku(item),
          groupDimensions,
          imageUrl: item.assetImageUrl || item.imageUrl || null,
          items: [] as OrderItem[],
        };
      }

      acc[groupKey].items.push(item);
      return acc;
    }, {} as Record<string, { key: string; productName: string; sku: string; groupDimensions: VariantDimension[]; imageUrl: string | null; items: OrderItem[] }>);

  const groupedItemsList = Object.values(groupedItems)
    .sort((a, b) => {
      const skuCompare = String(a.sku || '').localeCompare(String(b.sku || ''), 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
      })
      if (skuCompare !== 0) return skuCompare
      const nameCompare = String(a.productName || '').localeCompare(String(b.productName || ''), 'pt-BR', {
        sensitivity: 'base',
      })
      if (nameCompare !== 0) return nameCompare
      return String(a.key || '').localeCompare(String(b.key || ''), 'pt-BR', { sensitivity: 'base' })
    });
  const mobilePanelTitle = mobileInfoPanel === 'customer'
    ? tr('admin.orders.customerInfo', 'Customer Information')
      : mobileInfoPanel === 'seller'
        ? tr('admin.orders.seller.title', 'Vendedora')
      : mobileInfoPanel === 'delivery'
      ? 'Logística'
    : mobileInfoPanel === 'status'
      ? tr('admin.orders.statusSection', 'Order Status')
      : mobileInfoPanel === 'invoice'
        ? tr('admin.orders.invoice.title', 'Nota Fiscal')
        : mobileInfoPanel === 'label'
          ? 'Etiqueta de Envio'
          : ''
  const mobilePanelDescription = mobileInfoPanel === 'customer'
    ? tr('admin.orders.customer.details', 'Dados de cadastro e entrega do cliente')
    : mobileInfoPanel === 'seller'
      ? tr('admin.orders.seller.description', 'Vendedora atribuída a este pedido')
    : mobileInfoPanel === 'delivery'
      ? 'Endereço, método e observação da entrega.'
    : mobileInfoPanel === 'status'
      ? tr('admin.orders.status.description', 'Atualize status, pagamento e rastreamento')
      : mobileInfoPanel === 'invoice'
        ? tr('admin.orders.invoice.description', 'Geração e acompanhamento da nota fiscal do pedido.')
        : mobileInfoPanel === 'label'
          ? 'Dados de rastreamento e etiqueta gerada pela transportadora.'
          : ''
  const orderSellerName = order?.assignedSellerName || null
  const orderHasSeller = Boolean(order?.assignedSellerId)
  const customerSellerName = customer?.assignedSellerName || null
  const customerHasSeller = Boolean(customer?.assignedSellerId)

  return (
    <div className="space-y-6 p-6 lg:p-8 print:space-y-4 print:p-0 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('admin.orders.dialog.error.title', 'Erro')}</DialogTitle>
            <DialogDescription>{errorDialogMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setErrorDialogOpen(false)}>
              {tr('admin.orders.dialog.error.close', 'Fechar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isOrderConfirmed && order.status !== 'RELEASED' && (
        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogContent
            className="flex h-[80vh] max-h-[80vh] w-[80vw]! max-w-[80vw]! flex-col overflow-hidden p-6 sm:h-[80vh] sm:max-h-[80vh] sm:w-[80vw]! sm:max-w-[80vw]!"
            style={{ width: '80vw', maxWidth: '80vw', height: '80vh', maxHeight: '80vh' }}
          >
            <DialogHeader className="shrink-0">
              <DialogTitle>Adicionar Produto ao Pedido</DialogTitle>
              <DialogDescription>
                Busque, bipar ou selecione um produto para adicionar ao pedido
              </DialogDescription>
            </DialogHeader>
            <AssistedOrderProductCatalog
              className="min-h-0 flex-1"
              disabled={isSaving || !canEditOrder}
              addButtonLabel="Adicionar ao Pedido"
              matrixDialogClassName="flex h-[80vh] max-h-[80vh] w-[80vw]! max-w-[80vw]! flex-col overflow-hidden p-0"
              getVariantMaxQuantity={(variant) => getMaxOrderEditQty({
                variantStock: variant.stock,
                currentQty: 0,
              })}
              onAddVariants={handleCatalogAddVariants}
              onBarcodeScan={handleCatalogBarcodeScan}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={labelChaveModalOpen} onOpenChange={setLabelChaveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chave NF-e</DialogTitle>
            <DialogDescription>
              {invoice
                ? "A nota fiscal deste pedido ainda não possui chave de acesso. Informe a chave NF-e (44 dígitos) para gerar a etiqueta."
                : "Nenhuma nota fiscal foi gerada para este pedido. Informe a chave NF-e (44 dígitos) para gerar a etiqueta."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="order-label-chave-nfe">Chave NF-e *</Label>
              <Input
                id="order-label-chave-nfe"
                value={labelChaveNfeInput}
                onChange={(event) =>
                  setLabelChaveNfeInput(normalizeChaveNfe(event.target.value).slice(0, 44))
                }
                placeholder="44 dígitos"
                inputMode="numeric"
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="order-label-numero-nfe">Número NF</Label>
              <Input
                id="order-label-numero-nfe"
                value={labelNumeroNfeInput}
                onChange={(event) => setLabelNumeroNfeInput(event.target.value)}
                autoComplete="off"
              />
            </div>
            {labelChaveFormError && (
              <p className="text-sm text-rose-600">{labelChaveFormError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLabelChaveModalOpen(false)}
              disabled={labelGenerating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmLabelChaveModal()}
              disabled={labelGenerating}
            >
              {labelGenerating
                ? labelChaveModalMode === "regenerate"
                  ? "Regenerando..."
                  : "Gerando..."
                : labelChaveModalMode === "regenerate"
                  ? "Regenerar etiqueta"
                  : "Gerar etiqueta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="print:hidden flex flex-wrap items-start justify-between gap-4 border-b pb-3">
        <div className="flex items-start gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-medium text-foreground flex items-center gap-2"><Package className="h-5 w-5 text-primary" />{tr('admin.orders.title', 'Order')} {orderDisplayCode}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <p className="capitalize">{formatDateLong(order.createdAt)}</p>
              <Badge variant="outline" className={`text-xs font-medium ${orderStatusBadgeClass(order.status)}`}>{orderStatusInfo.label}</Badge>
            </div>
          </div>
        </div>

        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:justify-end">
          {canCreateOrder ? (
            <Link href="/orders/new">
              <Button type="button" className="h-9 gap-2 rounded-full px-4">
                <Plus className="h-4 w-4" />
                <span>Novo Pedido</span>
              </Button>
            </Link>
          ) : null}
          {trackingCode?.trim() && (
            <Badge variant="outline" className="text-xs font-medium">
              {tr('admin.orders.tracking', 'Tracking')}: {trackingCode}
            </Badge>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-lg font-medium">{tr('admin.orders.title', 'Order')} {orderDisplayCode}</h1>
        <p className="text-sm text-muted-foreground capitalize">{formatDateLong(order.createdAt)}</p>
        {trackingCode?.trim() && (
          <p className="text-sm mt-1">{tr('admin.orders.trackingCode', 'Tracking Code')}: {trackingCode}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:hidden print:hidden">
            <Button type="button" variant="outline" className="h-auto justify-start gap-2 px-3 py-2" onClick={() => setMobileInfoPanel('customer')}>
              <Package className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Cliente</span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-2 px-3 py-2" onClick={() => setMobileInfoPanel('seller')}>
              <UserRound className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Vendedora</span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-2 px-3 py-2" onClick={() => setMobileInfoPanel('delivery')}>
              <Truck className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Logística</span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-2 px-3 py-2" onClick={() => setMobileInfoPanel('status')}>
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Status</span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-2 px-3 py-2" onClick={() => setMobileInfoPanel('invoice')}>
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Nota Fiscal</span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-2 px-3 py-2" onClick={() => setMobileInfoPanel('label')}>
              <Printer className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Etiqueta</span>
            </Button>
          </div>

          <Drawer open={mobileInfoPanel !== null} onOpenChange={(open) => !open && setMobileInfoPanel(null)}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="text-left">
                <DrawerTitle>{mobilePanelTitle}</DrawerTitle>
                <DrawerDescription>{mobilePanelDescription}</DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                {mobileInfoPanel === 'customer' && (
                  <div className="space-y-3 text-sm">
                    {customer ? (
                      <>
                        <div>
                          <p className="font-semibold">{customer.companyName}</p>
                          <p className="text-muted-foreground">{customer.cnpj}</p>
                        </div>
                        <Separator />
                        <div className="space-y-1.5">
                          {customer.contactName && customer.contactName.trim().toLowerCase() !== customer.companyName.trim().toLowerCase() ? (
                            <p className="font-medium">{customer.contactName}</p>
                          ) : null}
                          <p className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{customer.phone}</p>
                          <p className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{customer.email}</p>
                        </div>
                        <Separator />
                        <div className="text-muted-foreground space-y-1">
                          <p className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 mt-0.5" />
                            <span>
                              {order.shippingStreet}, {order.shippingNumber}
                              {order.shippingComplement ? ` - ${order.shippingComplement}` : ''}
                            </span>
                          </p>
                          {order.shippingComplement && <p>{order.shippingComplement}</p>}
                          <p>{order.shippingCity} - {order.shippingState}</p>
                          <p>{tr('admin.orders.print.zip', 'ZIP')}: {order.shippingZipCode}</p>
                        </div>
                        <Separator />
                        <div className="space-y-1 text-muted-foreground">
                          <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{tr('admin.orders.customer.origin', 'Origin')}: {getOrderOriginLabel(locale, order.origin)}</p>
                          <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" />{tr('admin.orders.customer.registeredAt', 'Registered')}: {formatDate(customer.createdAt)}</p>
                          <p className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" />{tr('admin.orders.customer.lastActivity', 'Last activity')}: {formatDate(customer.updatedAt)}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground">{tr('admin.orders.customerNotFound', 'Customer not found')}</p>
                    )}
                  </div>
                )}

                {mobileInfoPanel === 'seller' && (
                  <div className="space-y-3 text-sm">
                    {orderHasSeller ? (
                      <div className="space-y-1.5">
                        <p className="font-semibold">{orderSellerName || tr('admin.orders.seller.unnamed', 'Vendedora')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-muted-foreground">
                          {tr('admin.orders.seller.missing', 'Este pedido não possui vendedora atribuída.')}
                        </p>
                        {customerHasSeller ? (
                          <>
                            <p className="text-sm">
                              {tr('admin.orders.seller.customerSeller', 'Vendedora do cliente')}:{' '}
                              <span className="font-medium text-foreground">{customerSellerName || customer?.assignedSellerId}</span>
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAssignSellerFromCustomer}
                              disabled={isAssigningSeller || !canEditOrder}
                            >
                              {isAssigningSeller ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserRound className="mr-2 h-4 w-4" />
                              )}
                              {tr('admin.orders.seller.assignFromCustomer', 'Atribuir vendedora do cliente')}
                            </Button>
                          </>
                        ) : (
                          <p className="text-muted-foreground">
                            {tr('admin.orders.seller.noCustomerSeller', 'Cliente não possui vendedora atribuída')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {mobileInfoPanel === 'status' && (
                  <div className="space-y-4 text-sm">
                    <div className="space-y-2">
                      <Label>{tr('admin.orders.payment', 'Payment')}</Label>
                      <Select value={order.paymentStatus || 'PENDING'} onValueChange={handlePaymentStatusChange} disabled={isSaving || !canEditOrder || (!canMarkOrderPaid && !canManageReturns) || hasPendingFulfillmentCompletion}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">{PAYMENT_STATUS_LABELS.PENDING.label}</SelectItem>
                          {(canMarkOrderPaid || order.paymentStatus === 'PAID') ? <SelectItem value="PAID" disabled={!canMarkOrderPaid}>{PAYMENT_STATUS_LABELS.PAID.label}</SelectItem> : null}
                          {(canMarkOrderPaid || order.paymentStatus === 'PARTIAL') ? <SelectItem value="PARTIAL" disabled={!canMarkOrderPaid}>{PAYMENT_STATUS_LABELS.PARTIAL.label}</SelectItem> : null}
                          {(canManageReturns || order.paymentStatus === 'REFUNDED') ? <SelectItem value="REFUNDED" disabled={!canManageReturns}>{PAYMENT_STATUS_LABELS.REFUNDED.label}</SelectItem> : null}
                          {(canManageReturns || order.paymentStatus === 'CANCELLED') ? <SelectItem value="CANCELLED" disabled={!canManageReturns}>{PAYMENT_STATUS_LABELS.CANCELLED.label}</SelectItem> : null}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{tr('admin.billing.paymentMethod', 'Payment Method')}</Label>
                      <Select value={order.paymentMethod || 'PIX'} onValueChange={handlePaymentMethodChange} disabled={isSaving || !canEditOrder}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethodOptions.map((method) => (
                            <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={order.status} onValueChange={handleStatusChange} disabled={isSaving || !canEditOrder || hasPendingFulfillmentCompletion}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">{ORDER_STATUS_LABELS.PENDING.label}</SelectItem>
                          <SelectItem value="IN_ANALYSIS">{ORDER_STATUS_LABELS.IN_ANALYSIS.label}</SelectItem>
                          <SelectItem value="RELEASED">{ORDER_STATUS_LABELS.RELEASED.label}</SelectItem>
                          <SelectItem value="CONFIRMED">{ORDER_STATUS_LABELS.CONFIRMED.label}</SelectItem>
                          <SelectItem value="PROCESSING">{ORDER_STATUS_LABELS.PROCESSING.label}</SelectItem>
                          <SelectItem value="INVOICED">{ORDER_STATUS_LABELS.INVOICED.label}</SelectItem>
                          {(canManageShipping || order.status === 'SHIPPED') ? (
                            <SelectItem value="SHIPPED" disabled={!canManageShipping}>{ORDER_STATUS_LABELS.SHIPPED.label}</SelectItem>
                          ) : null}
                          {(canManageShipping || order.status === 'DELIVERED') ? (
                            <SelectItem value="DELIVERED" disabled={!canManageShipping}>{ORDER_STATUS_LABELS.DELIVERED.label}</SelectItem>
                          ) : null}
                          {(canCancelOrder || order.status === 'CANCELLED') ? (
                            <SelectItem value="CANCELLED" disabled={!canCancelOrder}>{ORDER_STATUS_LABELS.CANCELLED.label}</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{tr('admin.orders.delivery', 'Delivery')}</Label>
                      <Select value={deliveryStatusValue} disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">{tr('admin.orders.deliveryStatus.pending', 'Pending')}</SelectItem>
                          <SelectItem value="PROCESSING">{tr('admin.orders.deliveryStatus.processing', 'Preparing')}</SelectItem>
                          {(canManageShipping || order.status === 'SHIPPED') ? <SelectItem value="SHIPPED" disabled={!canManageShipping}>{tr('admin.orders.deliveryStatus.shipped', 'In Transit')}</SelectItem> : null}
                          {(canManageShipping || order.status === 'DELIVERED') ? <SelectItem value="DELIVERED" disabled={!canManageShipping}>{tr('admin.orders.deliveryStatus.delivered', 'Delivered')}</SelectItem> : null}
                          {(canCancelOrder || order.status === 'CANCELLED') ? <SelectItem value="CANCELLED" disabled={!canCancelOrder}>{tr('admin.orders.deliveryStatus.cancelled', 'Returned')}</SelectItem> : null}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{tr('admin.orders.trackingCode', 'Tracking Code')}</Label>
                      <Input
                        value={trackingCode}
                        onFocus={() => {
                          if (canEditOrder && canManageShipping && !trackingLockedByLabel) {
                            setEditingTracking(true)
                          }
                        }}
                        onChange={(event) => setTrackingCode(event.target.value)}
                        onBlur={handleTrackingBlur}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleTrackingBlur();
                          }
                        }}
                        placeholder={tr('admin.orders.trackingPlaceholder', 'Ex: BR123456789XX')}
                        disabled={isSaving || !canEditOrder || !canManageShipping || trackingLockedByLabel}
                        readOnly={trackingLockedByLabel}
                        className={trackingLockedByLabel ? "bg-muted font-mono" : undefined}
                      />
                      {trackingLockedByLabel && (
                        <p className="text-xs text-muted-foreground">
                          Preenchido automaticamente pela etiqueta de envio.
                        </p>
                      )}
                      {trackingSaved && (
                        <p className="text-xs text-emerald-600">{tr('admin.orders.saved', 'Saved')}</p>
                      )}
                    </div>
                  </div>
                )}

                {mobileInfoPanel === 'delivery' && (
                  <div className="space-y-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Endereço de entrega</Label>
                      <p>
                        {order.shippingStreet}, {order.shippingNumber}
                        {order.shippingComplement ? ` - ${order.shippingComplement}` : ''}
                      </p>
                      <p className="text-muted-foreground">
                        {order.shippingNeighborhood} - {order.shippingCity}/{order.shippingState} · CEP {order.shippingZipCode}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Método de entrega</Label>
                      <p className="font-medium">{order.shippingName || '-'}</p>
                      {order.shippingMethodCode ? (
                        <p className="text-xs text-muted-foreground">Código: {order.shippingMethodCode}</p>
                      ) : null}
                      {typeof order.shippingDeliveryDays === 'number' && order.shippingDeliveryDays >= 0 ? (
                        <p className="text-xs text-muted-foreground">Prazo: {order.shippingDeliveryDays} dia(s) útil(eis)</p>
                      ) : null}
                    </div>

                    <Separator />

                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Observação da entrega</Label>
                      <p className="whitespace-pre-wrap">{order.shippingNote || 'Nenhuma observação de entrega'}</p>
                    </div>
                  </div>
                )}

                {mobileInfoPanel === 'invoice' && (
                  <div className="space-y-4 text-sm">
                    {invoice?.status !== 'AUTHORIZED' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {canEditOrder && invoiceIsAwaitingProvider && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRefreshInvoiceStatus}
                            disabled={invoiceRefreshing || invoiceGenerating || isSaving || !invoice?.integrationReferenceId}
                            title={!invoice?.integrationReferenceId ? tr('admin.orders.invoice.missingReference', 'A nota ainda não possui referência de integração para consulta') : undefined}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {invoiceRefreshing ? tr('admin.orders.invoice.refreshing', 'Consultando...') : tr('admin.orders.invoice.refresh', 'Consultar status')}
                          </Button>
                        )}
                        {canEditOrder && canGenerateInvoice && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleGenerateInvoice}
                            disabled={invoiceGenerating || invoiceRefreshing || isSaving}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            {invoice ? tr('admin.orders.invoice.regenerate', 'Gerar NF novamente') : tr('admin.orders.invoice.generate', 'Gerar NF')}
                          </Button>
                        )}
                      </div>
                    )}
                    {invoiceLoading ? (
                      <p className="text-muted-foreground">{tr('admin.orders.invoice.loading', 'Carregando nota fiscal...')}</p>
                    ) : !invoice ? (
                      <p className="text-muted-foreground">{tr('admin.orders.invoice.empty', 'Nenhuma nota fiscal gerada para este pedido.')}</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{tr('admin.orders.table.status', 'Status')}</span>
                          <Badge variant="outline" className={getInvoiceStatusBadgeClass(invoice.status)}>
                            {getInvoiceStatusLabel(invoice.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{tr('admin.orders.invoice.number', 'Invoice Number')}</span>
                          <span className="font-medium">{invoice.nfNumber || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{tr('admin.orders.invoice.accessKey', 'Access Key')}</span>
                          <span className="max-w-56 truncate font-medium" title={invoice.accessKey || undefined}>{invoice.accessKey || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Gerada em</span>
                          <span className="font-medium">{invoice.issuedAt ? formatDate(invoice.issuedAt) : '-'}</span>
                        </div>
                        {invoiceFiscalSummary && (
                          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {tr('admin.orders.invoice.fiscalContext', 'Contexto fiscal')}
                              </span>
                              {invoiceFiscalSummary.selectionMode && (
                                <Badge variant="secondary" className="font-normal">
                                  {invoiceFiscalSummary.selectionMode}
                                </Badge>
                              )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">{tr('admin.orders.invoice.operationNature', 'Natureza da operação')}</p>
                                <p className="font-medium leading-snug">{invoiceFiscalSummary.nature || '-'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">{tr('admin.orders.invoice.emitter', 'Emitente fiscal')}</p>
                                <p className="font-medium leading-snug">{invoiceFiscalSummary.emitterName || '-'}</p>
                                <p className="text-xs text-muted-foreground">CNPJ: {invoiceFiscalSummary.emitterCnpj || '-'}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {(invoicePdfHref || invoiceXmlHref) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {invoicePdfHref && (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={invoicePdfHref} target="_blank" rel="noopener noreferrer">
                                  <FileText className="mr-2 h-4 w-4" />
                                  PDF
                                </Link>
                              </Button>
                            )}
                            {invoiceXmlHref && (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={invoiceXmlHref} target="_blank" rel="noopener noreferrer">
                                  <FileText className="mr-2 h-4 w-4" />
                                  XML
                                </Link>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {mobileInfoPanel === 'label' && (
                  <div className="space-y-4 text-sm">
                    {labelLoading ? (
                      <p className="text-muted-foreground">Carregando etiqueta...</p>
                    ) : !label ? (
                      <div className="space-y-3">
                        <p className="text-muted-foreground">Nenhuma etiqueta gerada para este pedido.</p>
                        {canGenerateLabel && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleGenerateLabelClick}
                            disabled={labelGenerating || isSaving}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            {labelGenerating ? 'Gerando...' : 'Gerar etiqueta'}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant="outline" className={getLabelStatusBadgeClass(label.status)}>
                            {getLabelStatusLabel(label.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Rastreamento</span>
                          <span className="font-medium font-mono">{label.trackingCode || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Transportadora</span>
                          <span className="font-medium">{label.carrier || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Integração</span>
                          <span className="font-medium">{label.integrationName || '-'}</span>
                        </div>
                        {label.errorMessage && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Erro</span>
                            <span className="font-medium text-rose-600 max-w-56 text-right">{label.errorMessage}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Emitida em</span>
                          <span className="font-medium">{label.issuedAt ? formatDate(label.issuedAt) : '-'}</span>
                        </div>
                        {label.pdfUrl && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={label.pdfUrl} target="_blank">
                                <FileText className="mr-2 h-4 w-4" />
                                Etiqueta PDF
                              </Link>
                            </Button>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {labelIsProcessing && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRefreshLabel}
                              disabled={labelLoading || labelGenerating || isSaving}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Atualizar status
                            </Button>
                          )}
                          {canRegenerateLabel && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRegenerateLabelClick}
                              disabled={labelGenerating || isSaving}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Regenerar
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>

          <Card className="hidden md:block print:block rounded-xl border-border/20 shadow-non gap-0">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                {tr('admin.orders.customerInfo', 'Customer Information')}
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-4">
              {customer ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold">{customer.companyName}</p>
                    <p className="text-muted-foreground">{customer.cnpj}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    {customer.contactName && customer.contactName.trim().toLowerCase() !== customer.companyName.trim().toLowerCase() ? (
                      <p className="font-medium">{customer.contactName}</p>
                    ) : null}
                    <p className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{customer.phone}</p>
                    <p className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{customer.email}</p>
                  </div>
                  <Separator />
                  <div className="text-muted-foreground space-y-1">
                    <p className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 mt-0.5" />
                      <span>
                        {order.shippingStreet}, {order.shippingNumber}
                        {order.shippingComplement ? ` - ${order.shippingComplement}` : ''}
                      </span>
                    </p>
                    {order.shippingComplement && <p>{order.shippingComplement}</p>}
                    <p>{order.shippingCity} - {order.shippingState}</p>
                    <p>{tr('admin.orders.print.zip', 'ZIP')}: {order.shippingZipCode}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1 text-muted-foreground">
                    <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{tr('admin.orders.customer.origin', 'Origin')}: {getOrderOriginLabel(locale, order.origin)}</p>
                    <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" />{tr('admin.orders.customer.registeredAt', 'Registered')}: {formatDate(customer.createdAt)}</p>
                    <p className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" />{tr('admin.orders.customer.lastActivity', 'Last activity')}: {formatDate(customer.updatedAt)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{tr('admin.orders.customerNotFound', 'Customer not found')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="hidden md:block print:block rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                {tr('admin.orders.seller.title', 'Vendedora')}
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-4">
              {orderHasSeller ? (
                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold">{orderSellerName || tr('admin.orders.seller.unnamed', 'Vendedora')}</p>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {tr('admin.orders.seller.missing', 'Este pedido não possui vendedora atribuída.')}
                  </p>
                  {customerHasSeller ? (
                    <>
                      <p>
                        {tr('admin.orders.seller.customerSeller', 'Vendedora do cliente')}:{' '}
                        <span className="font-medium text-foreground">{customerSellerName || customer?.assignedSellerId}</span>
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAssignSellerFromCustomer}
                        disabled={isAssigningSeller || !canEditOrder}
                        className="print:hidden"
                      >
                        {isAssigningSeller ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UserRound className="mr-2 h-4 w-4" />
                        )}
                        {tr('admin.orders.seller.assignFromCustomer', 'Atribuir vendedora do cliente')}
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      {tr('admin.orders.seller.noCustomerSeller', 'Cliente não possui vendedora atribuída')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hidden md:block print:hidden rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Logística
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-border/20 pt-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Endereço de entrega</Label>
                <p className="text-sm">
                  {order.shippingStreet}, {order.shippingNumber}
                  {order.shippingComplement ? ` - ${order.shippingComplement}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.shippingNeighborhood} - {order.shippingCity}/{order.shippingState} · CEP {order.shippingZipCode}
                </p>
              </div>

              <Separator />

              <div className="space-y-1">
                <Label className="text-muted-foreground">Método de entrega</Label>
                <p className="text-sm font-medium">{order.shippingName || '-'}</p>
                {order.shippingMethodCode ? (
                  <p className="text-xs text-muted-foreground">Código: {order.shippingMethodCode}</p>
                ) : null}
                {typeof order.shippingDeliveryDays === 'number' && order.shippingDeliveryDays >= 0 ? (
                  <p className="text-xs text-muted-foreground">Prazo: {order.shippingDeliveryDays} dia(s) útil(eis)</p>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-1">
                <Label className="text-muted-foreground">Observação da entrega</Label>
                <p className="text-sm whitespace-pre-wrap">{order.shippingNote || 'Nenhuma observação de entrega'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hidden md:block print:hidden rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader>
              <CardTitle className="text-base">{tr('admin.orders.statusSection', 'Order Status')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-border/20 pt-6">
              <div className="space-y-2">
                <Label>{tr('admin.billing.paymentMethod', 'Payment Method')}</Label>
                <Select value={order.paymentMethod || 'PIX'} onValueChange={handlePaymentMethodChange} disabled={isSaving || !canEditOrder}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethodOptions.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr('admin.orders.payment', 'Payment')}</Label>
                <Select value={order.paymentStatus || 'PENDING'} onValueChange={handlePaymentStatusChange} disabled={isSaving || !canEditOrder || (!canMarkOrderPaid && !canManageReturns) || hasPendingFulfillmentCompletion}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{PAYMENT_STATUS_LABELS.PENDING.label}</SelectItem>
                    {(canMarkOrderPaid || order.paymentStatus === 'PAID') ? <SelectItem value="PAID" disabled={!canMarkOrderPaid}>{PAYMENT_STATUS_LABELS.PAID.label}</SelectItem> : null}
                    {(canMarkOrderPaid || order.paymentStatus === 'PARTIAL') ? <SelectItem value="PARTIAL" disabled={!canMarkOrderPaid}>{PAYMENT_STATUS_LABELS.PARTIAL.label}</SelectItem> : null}
                    {(canManageReturns || order.paymentStatus === 'REFUNDED') ? <SelectItem value="REFUNDED" disabled={!canManageReturns}>{PAYMENT_STATUS_LABELS.REFUNDED.label}</SelectItem> : null}
                    {(canManageReturns || order.paymentStatus === 'CANCELLED') ? <SelectItem value="CANCELLED" disabled={!canManageReturns}>{PAYMENT_STATUS_LABELS.CANCELLED.label}</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={order.status} onValueChange={handleStatusChange} disabled={isSaving || !canEditOrder || hasPendingFulfillmentCompletion}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{ORDER_STATUS_LABELS.PENDING.label}</SelectItem>
                    <SelectItem value="IN_ANALYSIS">{ORDER_STATUS_LABELS.IN_ANALYSIS.label}</SelectItem>
                    <SelectItem value="RELEASED">{ORDER_STATUS_LABELS.RELEASED.label}</SelectItem>
                    <SelectItem value="CONFIRMED">{ORDER_STATUS_LABELS.CONFIRMED.label}</SelectItem>
                    <SelectItem value="PROCESSING">{ORDER_STATUS_LABELS.PROCESSING.label}</SelectItem>
                    <SelectItem value="INVOICED">{ORDER_STATUS_LABELS.INVOICED.label}</SelectItem>
                    {(canManageShipping || order.status === 'SHIPPED') ? (
                      <SelectItem value="SHIPPED" disabled={!canManageShipping}>{ORDER_STATUS_LABELS.SHIPPED.label}</SelectItem>
                    ) : null}
                    {(canManageShipping || order.status === 'DELIVERED') ? (
                      <SelectItem value="DELIVERED" disabled={!canManageShipping}>{ORDER_STATUS_LABELS.DELIVERED.label}</SelectItem>
                    ) : null}
                    {(canCancelOrder || order.status === 'CANCELLED') ? (
                      <SelectItem value="CANCELLED" disabled={!canCancelOrder}>{ORDER_STATUS_LABELS.CANCELLED.label}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr('admin.orders.delivery', 'Delivery')}</Label>
                <Select value={deliveryStatusValue} disabled>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{tr('admin.orders.deliveryStatus.pending', 'Pending')}</SelectItem>
                    <SelectItem value="PROCESSING">{tr('admin.orders.deliveryStatus.processing', 'Preparing')}</SelectItem>
                    {(canManageShipping || order.status === 'SHIPPED') ? <SelectItem value="SHIPPED" disabled={!canManageShipping}>{tr('admin.orders.deliveryStatus.shipped', 'In Transit')}</SelectItem> : null}
                    {(canManageShipping || order.status === 'DELIVERED') ? <SelectItem value="DELIVERED" disabled={!canManageShipping}>{tr('admin.orders.deliveryStatus.delivered', 'Delivered')}</SelectItem> : null}
                    {(canCancelOrder || order.status === 'CANCELLED') ? <SelectItem value="CANCELLED" disabled={!canCancelOrder}>{tr('admin.orders.deliveryStatus.cancelled', 'Returned')}</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr('admin.orders.trackingCode', 'Tracking Code')}</Label>
                <Input
                  value={trackingCode}
                  onFocus={() => {
                    if (canEditOrder && canManageShipping && !trackingLockedByLabel) {
                      setEditingTracking(true)
                    }
                  }}
                  onChange={(event) => setTrackingCode(event.target.value)}
                  onBlur={handleTrackingBlur}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleTrackingBlur();
                    }
                  }}
                  placeholder={tr('admin.orders.trackingPlaceholder', 'Ex: BR123456789XX')}
                  disabled={isSaving || !canEditOrder || !canManageShipping || trackingLockedByLabel}
                  readOnly={trackingLockedByLabel}
                  className={trackingLockedByLabel ? "bg-muted font-mono" : undefined}
                />
                {trackingLockedByLabel && (
                  <p className="text-xs text-muted-foreground">
                    Preenchido automaticamente pela etiqueta de envio.
                  </p>
                )}
                {trackingSaved && (
                  <p className="text-xs text-emerald-600">{tr('admin.orders.saved', 'Saved')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="hidden md:block print:hidden rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{tr('admin.orders.invoice.title', 'Nota Fiscal')}</CardTitle>
                <CardDescription>{tr('admin.orders.invoice.description', 'Geração e acompanhamento da nota fiscal do pedido.')}</CardDescription>
              </div>
              {invoice?.status !== 'AUTHORIZED' && (
                <div className="flex items-center gap-2">
                  {canEditOrder && invoiceIsAwaitingProvider && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRefreshInvoiceStatus}
                      disabled={invoiceRefreshing || invoiceGenerating || isSaving || !invoice?.integrationReferenceId}
                      title={!invoice?.integrationReferenceId ? tr('admin.orders.invoice.missingReference', 'A nota ainda não possui referência de integração para consulta') : undefined}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {invoiceRefreshing ? tr('admin.orders.invoice.refreshing', 'Consultando...') : tr('admin.orders.invoice.refresh', 'Consultar status')}
                    </Button>
                  )}
                  {canEditOrder && canGenerateInvoice && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateInvoice}
                      disabled={invoiceGenerating || invoiceRefreshing || isSaving}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {invoice ? tr('admin.orders.invoice.regenerate', 'Gerar NF novamente') : tr('admin.orders.invoice.generate', 'Gerar NF')}
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4 border-t border-border/20 pt-6">
              {invoiceLoading ? (
                <p className="text-sm text-muted-foreground">{tr('admin.orders.invoice.loading', 'Carregando nota fiscal...')}</p>
              ) : !invoice ? (
                <p className="text-sm text-muted-foreground">{tr('admin.orders.invoice.empty', 'Nenhuma nota fiscal gerada para este pedido.')}</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{tr('admin.orders.table.status', 'Status')}</span>
                    <Badge variant="outline" className={getInvoiceStatusBadgeClass(invoice.status)}>
                      {getInvoiceStatusLabel(invoice.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{tr('admin.orders.invoice.number', 'Invoice Number')}</span>
                    <span className="font-medium">{invoice.nfNumber || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{tr('admin.orders.invoice.accessKey', 'Access Key')}</span>
                    <span className="max-w-56 truncate font-medium" title={invoice.accessKey || undefined}>{invoice.accessKey || '-'}</span>
                  </div>
                  {/* <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{tr('admin.orders.invoice.integration', 'Integration')}</span>
                    <span className="font-medium">{invoice.integrationName || '-'}</span>
                  </div> */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Gerada em</span>
                    <span className="font-medium">{invoice.issuedAt ? formatDate(invoice.issuedAt) : '-'}</span>
                  </div>
                  {invoiceFiscalSummary && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {tr('admin.orders.invoice.fiscalContext', 'Contexto fiscal')}
                        </span>
                        {invoiceFiscalSummary.selectionMode && (
                          <Badge variant="secondary" className="font-normal">
                            {invoiceFiscalSummary.selectionMode}
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{tr('admin.orders.invoice.operationNature', 'Natureza da operação')}</p>
                          <p className="font-medium leading-snug">{invoiceFiscalSummary.nature || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{tr('admin.orders.invoice.emitter', 'Emitente fiscal')}</p>
                          <p className="font-medium leading-snug">{invoiceFiscalSummary.emitterName || '-'}</p>
                          <p className="text-xs text-muted-foreground">CNPJ: {invoiceFiscalSummary.emitterCnpj || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {(invoicePdfHref || invoiceXmlHref) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {invoicePdfHref && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={invoicePdfHref} target="_blank" rel="noopener noreferrer">
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                          </Link>
                        </Button>
                      )}
                      {invoiceXmlHref && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={invoiceXmlHref} target="_blank" rel="noopener noreferrer">
                            <FileText className="mr-2 h-4 w-4" />
                            XML
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hidden md:block print:hidden rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Etiqueta de Envio</CardTitle>
                <CardDescription>Dados de rastreamento e etiqueta gerada pela transportadora.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {canEditOrder && labelIsProcessing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshLabel}
                    disabled={labelLoading || labelGenerating || isSaving}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {labelLoading ? 'Consultando...' : 'Atualizar status'}
                  </Button>
                )}
                {canRegenerateLabel && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerateLabelClick}
                    disabled={labelGenerating || labelLoading || isSaving}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {labelGenerating ? 'Regenerando...' : 'Regenerar'}
                  </Button>
                )}
                {canGenerateLabel && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateLabelClick}
                    disabled={labelGenerating || labelLoading || isSaving}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {labelGenerating ? 'Gerando...' : 'Gerar etiqueta'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-border/20 pt-6">
              {labelLoading ? (
                <p className="text-sm text-muted-foreground">Carregando etiqueta...</p>
              ) : !label ? (
                <p className="text-sm text-muted-foreground">Nenhuma etiqueta gerada para este pedido.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className={getLabelStatusBadgeClass(label.status)}>
                      {getLabelStatusLabel(label.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Rastreamento</span>
                    <span className="font-medium font-mono">{label.trackingCode || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Transportadora</span>
                    <span className="font-medium">{label.carrier || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Integração</span>
                    <span className="font-medium">{label.integrationName || '-'}</span>
                  </div>
                  {label.errorMessage && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Erro</span>
                      <span className="font-medium text-rose-600 max-w-56 text-right">{label.errorMessage}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Emitida em</span>
                    <span className="font-medium">{label.issuedAt ? formatDate(label.issuedAt) : '-'}</span>
                  </div>
                  {label.pdfUrl && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={label.pdfUrl} target="_blank">
                          <FileText className="mr-2 h-4 w-4" />
                          Etiqueta PDF
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Drawer
            direction="right"
            open={communicationPanel !== null}
            onOpenChange={(open) => !open && setCommunicationPanel(null)}
          >
            <DrawerContent className="w-full sm:max-w-xl">
              <DrawerHeader className="text-left border-b border-border/20 px-5 py-4">
                <DrawerTitle>
                  <span className="inline-flex items-center gap-2">
                    {communicationPanel === 'message' ? (
                      <Send className="h-4 w-4 text-primary" />
                    ) : (
                      <Webhook className="h-4 w-4 text-primary" />
                    )}
                    {communicationPanel === 'message' ? 'Disparo de Mensagem ao Cliente' : 'Disparo Manual de Webhook'}
                  </span>
                </DrawerTitle>
                <DrawerDescription className="mt-1">
                  {communicationPanel === 'message'
                    ? 'Selecione trigger e canal para enviar usando o template ativo da mensageria.'
                    : 'Dispare manualmente o evento de webhook do pedido usando o fluxo padrão do backend.'}
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {communicationPanel === 'message' ? (
                  <Card className="rounded-xl border-border/30 shadow-none">
                    <CardContent className="pt-5 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Trigger</Label>
                          <Select value={messageTrigger} onValueChange={(value) => setMessageTrigger(value as typeof messageTrigger)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ORDER_CREATED">Novo Pedido</SelectItem>
                              <SelectItem value="ORDER_INVOICE_GENERATED">NF Gerada</SelectItem>
                              <SelectItem value="ORDER_CONFIRMED">Pedido Confirmado</SelectItem>
                              <SelectItem value="ORDER_PROCESSING">Pedido em Separacao</SelectItem>
                              <SelectItem value="ORDER_SHIPPED">Pedido Enviado</SelectItem>
                              <SelectItem value="ORDER_DELIVERED">Pedido Entregue</SelectItem>
                              <SelectItem value="ORDER_CANCELLED">Pedido Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Canal</Label>
                          <Select value={messageChannel} onValueChange={(value) => setMessageChannel(value as typeof messageChannel)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                              <SelectItem value="EMAIL">E-mail</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => { void handleDispatchOrderMessage() }} disabled={!canSendMessages || isDispatchingMessage || isSaving}>
                          {isDispatchingMessage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          {isDispatchingMessage ? 'Disparando...' : 'Disparar Mensagem'}
                        </Button>
                        {dispatchFeedback ? (
                          <p className="text-sm text-muted-foreground">{dispatchFeedback}</p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {communicationPanel === 'webhook' ? (
                  <Card className="rounded-xl border-border/30 shadow-none">
                    <CardContent className="pt-5 space-y-4">
                      <div className="space-y-2">
                        <Label>Evento</Label>
                        <Select value={webhookEvent} onValueChange={(value) => setWebhookEvent(value as typeof webhookEvent)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="order.created">order.created</SelectItem>
                            <SelectItem value="order.updated">order.updated</SelectItem>
                            <SelectItem value="order.confirmed">order.confirmed</SelectItem>
                            <SelectItem value="order.payment_confirmed">order.payment_confirmed</SelectItem>
                            <SelectItem value="order.shipped">order.shipped</SelectItem>
                            <SelectItem value="order.delivered">order.delivered</SelectItem>
                            <SelectItem value="order.cancelled">order.cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => { void handleDispatchOrderWebhook() }} disabled={isDispatchingWebhook || isSaving}>
                          {isDispatchingWebhook ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Webhook className="h-4 w-4 mr-2" />}
                          {isDispatchingWebhook ? 'Disparando...' : 'Disparar Webhook'}
                        </Button>
                        {webhookDispatchFeedback ? (
                          <p className="text-sm text-muted-foreground">{webhookDispatchFeedback}</p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </DrawerContent>
          </Drawer>

          <Dialog open={messageDispatchResultOpen} onOpenChange={setMessageDispatchResultOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="shrink-0 pr-8 text-left">
                <DialogTitle>Mensagem disparada</DialogTitle>
                <DialogDescription>{dispatchFeedback}</DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pre-visualizacao enviada</p>
                  {/[<][^>]+[>]/.test(dispatchPreview) ? (
                    <div className="rounded-md border border-border/60 bg-background p-3">
                      <div className="mx-auto w-full max-w-full rounded-md border border-border/60 bg-white px-5 py-4 text-[15px] leading-7 text-zinc-900 shadow-sm [&_a]:text-blue-700 [&_a]:underline [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:my-4 [&_hr]:border-zinc-200 [&_br]:leading-6"
                        dangerouslySetInnerHTML={{ __html: dispatchPreviewHtml || dispatchPreview }}
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/60 bg-background p-3">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{dispatchPreview}</p>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={webhookDispatchResultOpen} onOpenChange={setWebhookDispatchResultOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="shrink-0 pr-8 text-left">
                <DialogTitle>Webhook disparado</DialogTitle>
                <DialogDescription>{webhookDispatchFeedback}</DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {webhookDispatchPayload ? (
                  <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Campos enviados
                    </p>
                    <pre className="max-h-[55vh] overflow-auto rounded-md bg-background p-3 text-xs leading-5 text-foreground whitespace-pre-wrap wrap-break-word">
                      {JSON.stringify(webhookDispatchPayload, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Nenhum payload disponível.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 print:hidden">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="rounded-xl border-border/20 shadow-none p-0">
                <CardContent className="flex items-center gap-4 pt-5 pb-5">
                  <div className="h-12 w-12 rounded-xl bg-sky-100 text-sky-600 grid place-items-center">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Solicitado</p>
                    <p className="text-xl font-medium leading-tight">R$ {requestedTotal.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/20 shadow-none p-0">
                <CardContent className="flex items-center gap-4 pt-5 pb-5">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center">
                    <Boxes className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Atendido</p>
                    <p className="text-xl font-medium leading-tight">R$ {fulfilledTotal.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/20 shadow-none p-0">
                <CardContent className="flex items-center gap-4 pt-5 pb-5">
                  <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 grid place-items-center">
                    <Percent className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">% Atendida</p>
                    <p className="text-xl font-medium leading-tight text-amber-600">
                      {requestedTotal > 0 ? `${((fulfilledTotal / requestedTotal) * 100).toFixed(1)}%` : '0.0%'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Items */}
        <div className="space-y-4">
          {hasPendingFulfillmentCompletion ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Atenção: finalize o processo de atendimento</p>
              <p className="mt-1 text-amber-800">{fulfillmentCompletionBlockMessage}</p>
            </div>
          ) : null}

          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Produtos do Pedido ({groupedItemsList.length})</CardTitle>
                <CardDescription>
                  Itens agrupados por produto/cor com edição rápida por matriz
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {!isOrderConfirmed && order.status !== 'RELEASED' && selectedItems.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-muted-foreground">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Selecionados ({selectedItems.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir {selectedItems.length} item(ns) do pedido?
                          Essa ação remove o item definitivamente.
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
              </div>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              <div className="flex flex-wrap items-center gap-4 pb-4 text-xs text-muted-foreground">
                <span className="font-medium">Legenda:</span>
                <span>Estoque atual: mostrado no editor da celula</span>
                <span>Solicitado: numero superior da celula</span>
                <span>Atendido: numero inferior da celula</span>
              </div>
              <div className="space-y-5">
                {groupedItemsList.map((group) => {
                  const groupAllRemoved = group.items.length > 0 && group.items.every((item) => item.status === 'removed')
                  const groupRequested = group.items.reduce((sum, item) => sum + Number(item.originalQty ?? item.qty), 0)
                  const groupFulfilled = group.items.reduce((sum, item) => sum + getItemAttendedQty(item), 0)
                  const groupSubtotal = group.items.reduce((sum, item) => {
                    const requestedQty = Number(item.originalQty ?? item.qty)
                    return sum + requestedQty * Number(item.unitPrice || 0)
                  }, 0)
                  const groupAttendedSubtotal = group.items.reduce((sum, item) => {
                    const attendedQty = getItemAttendedQty(item)
                    return sum + attendedQty * Number(item.unitPrice || 0)
                  }, 0)
                  const matrixEntries = group.items.map((item) => {
                    const dimensions = getVariantDimensions(item)
                    const remainingDimensions = dimensions.slice(group.groupDimensions.length)
                    const sizeDimension = [...remainingDimensions].reverse().find((dimension) => dimension.normalizedKey === 'size')
                    const columnDimension = sizeDimension
                      || (remainingDimensions.length >= 1
                        ? remainingDimensions[remainingDimensions.length - 1]
                        : {
                            rawKey: '__column__',
                            normalizedKey: '__column__',
                            label: tr('admin.orders.attribute.variation', 'Variation'),
                            rawValue: '__single__',
                            displayValue: tr('admin.orders.attribute.noVariation', 'Sem variacao'),
                          })
                    const rowCandidate = remainingDimensions.find((dimension) => dimension.rawKey !== columnDimension.rawKey || dimension.rawValue !== columnDimension.rawValue)
                    const rowDimension = rowCandidate
                      || {
                        rawKey: '__row__',
                        normalizedKey: '__row__',
                        label: tr('admin.orders.attribute.group', 'Grupo'),
                        rawValue: '__single__',
                        displayValue: tr('admin.orders.attribute.single', 'Item'),
                      }

                    return {
                      item,
                      rowDimension,
                      columnDimension,
                      allDimensions: dimensions,
                    }
                  })

                  const rowDimensionLabel = matrixEntries[0]?.rowDimension.label || tr('admin.orders.attribute.group', 'Grupo')
                  const uniqueRows = Array.from(new Map(matrixEntries.map((entry) => [entry.rowDimension.rawValue || '__row__', entry.rowDimension])).values())
                    .sort(compareVariantDimensionValues)
                  const uniqueColumns = Array.from(new Map(matrixEntries.map((entry) => [entry.columnDimension.rawValue || '__column__', entry.columnDimension])).values())
                    .sort(compareVariantDimensionValues)

                  const matrixLookup: Record<string, Record<string, Array<typeof matrixEntries[number]>>> = {}
                  for (const entry of matrixEntries) {
                    const rowKey = entry.rowDimension.rawValue || '__row__'
                    const columnKey = entry.columnDimension.rawValue || '__column__'
                    if (!matrixLookup[rowKey]) matrixLookup[rowKey] = {}
                    if (!matrixLookup[rowKey][columnKey]) matrixLookup[rowKey][columnKey] = []
                    matrixLookup[rowKey][columnKey].push(entry)
                  }
                  const distinctGroupColors = new Set(
                    group.items
                      .flatMap((item) => getVariantDimensions(item))
                      .filter((dimension) => dimension.normalizedKey === 'color')
                      .map((dimension) => dimension.rawValue)
                      .filter(Boolean)
                  ).size

                  const groupSummary = group.groupDimensions
                    .filter((dimension) => !(dimension.normalizedKey === 'color' && distinctGroupColors <= 1))
                    .map((dimension) => `${dimension.label}: ${dimension.displayValue}`)
                    .join(' · ')

                  return (
                    <div key={group.key} className={`rounded-xl border border-border/20 ${groupAllRemoved ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-md bg-muted overflow-hidden grid place-items-center text-xs text-muted-foreground">
                            <button
                              type="button"
                              className="h-full w-full cursor-pointer"
                              onClick={() => {
                                const groupedVariants = group.items.reduce((acc, entry) => {
                                  const attributes = resolveVariantAttributes(entry)
                                  const variantKey = attributes
                                    .map((attribute) => `${attribute.key}:${attribute.value}`)
                                    .join('|')

                                  if (!acc[variantKey]) {
                                    acc[variantKey] = { variantKey, attributes, requestedQty: 0, attendedQty: 0 }
                                  }

                                  acc[variantKey].requestedQty += Number(entry.originalQty ?? entry.qty)
                                  acc[variantKey].attendedQty += getItemAttendedQty(entry)
                                  return acc
                                }, {} as Record<string, { variantKey: string; attributes: Array<{ key: string; value: string }>; requestedQty: number; attendedQty: number }>)

                                setProductPreview({
                                  productName: group.productName,
                                  imageUrl: group.imageUrl,
                                  sku: group.sku,
                                  variants: Object.values(groupedVariants),
                                })
                              }}
                            >
                              {group.imageUrl ? (
                                <CloudflareImage
                                  src={group.imageUrl}
                                  cloudflare={{ width: 48, height: 48, fit: "cover", dpr: 2 }}
                                  alt={group.productName}
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>IMG</span>
                              )}
                            </button>
                          </div>
                          <div>
                            <p className="font-medium">{group.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {group.sku}{groupSummary ? ` | ${groupSummary}` : ''}
                            </p>
                          </div>
                          {groupAllRemoved ? (
                            <Badge variant="outline" className="text-xs font-medium bg-rose-50 text-rose-600 border border-rose-100">Grupo removido</Badge>
                          ) : null}
                        </div>
                        {canEditOrder && !isOrderConfirmed && order.status !== 'RELEASED' && groupAllRemoved ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isSaving}
                            onClick={() => handleReactivateGroupItems(group.items)}
                            title="Reativar itens removidos"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : canEditOrder && !isOrderConfirmed && order.status !== 'RELEASED' ? (
                          <AlertDialog
                            open={groupToRemove === group.key}
                            onOpenChange={(open) => setGroupToRemove(open ? group.key : null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                disabled={isSaving}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir itens do produto</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir {group.items.length} item(ns) deste produto do pedido?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveGroupItems(group.items)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-t border-border/20">
                          <thead>
                            <tr className="bg-muted/20 border-b border-border/10">
                              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground min-w-35">{rowDimensionLabel}</th>
                              {uniqueColumns.map((column) => (
                                <th key={column.rawValue || '__empty-column'} className="text-center px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                  {column.displayValue}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {uniqueRows.map((row, rowIdx) => {
                              const rowColorDot = row.normalizedKey === 'color' ? getColorDot(row.rawValue || null, initialAttributeLabels.colorHex) : null

                              return (
                                <tr key={row.rawValue || `empty-row-${rowIdx}`} className={`border-b border-border/10 last:border-0 ${rowIdx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                      {rowColorDot ? (
                                        <span
                                          className="inline-block h-3.5 w-3.5 rounded-full shrink-0 border border-black/10"
                                          style={{ background: rowColorDot }}
                                        />
                                      ) : null}
                                      <span className="text-sm font-medium">{row.displayValue}</span>
                                    </div>
                                  </td>

                                  {uniqueColumns.map((column) => {
                                    const entries = matrixLookup[row.rawValue || '__row__']?.[column.rawValue || '__column__'] || []

                                    if (entries.length === 0) {
                                      return (
                                        <td key={`${row.rawValue}-${column.rawValue}-empty`} className="text-center px-4 py-3.5">
                                          <span className="text-muted-foreground/25 text-xs select-none">—</span>
                                        </td>
                                      )
                                    }
                                    return (
                                      <td
                                        key={`${row.rawValue || '__row__'}-${column.rawValue || '__column__'}-cell`}
                                        className="text-center px-4 py-3.5"
                                      >
                                        <div className="space-y-1.5">
                                          {entries.map(({ item }) => {
                                            const requestedQty = Number(item.originalQty ?? item.qty)
                                            const isAttended = isItemAttended(item)
                                            const baseAttendedQty = getItemAttendedQty(item)
                                            const attendedQty = Number(attendedQtyDraft[item.id] ?? baseAttendedQty)
                                            const isRemoved = item.status === 'removed'
                                            const isManagerAdded = item.origin === 'manager_added'
                                            const stockLimit = Math.max(requestedQty, getMaxOrderEditQty({
                                              currentQty: item.qty,
                                              variantStock: item.variantStockQty,
                                              reservedQty: item.variantReservedQty,
                                            }))
                                            const normalizedAttendedQty = clampOrderEditQty(attendedQty, stockLimit, 0)
                                            const hasAttendedQtyChanges = normalizedAttendedQty !== baseAttendedQty
                                            const isOpen = openCellId === item.id

                                            const cellContent = (
                                              <div className="flex flex-col items-center gap-0.5 select-none">
                                                {isManagerAdded ? (
                                                  <span
                                                    title={getOrderItemOriginLabel(locale, item.origin)}
                                                    className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
                                                  >
                                                    {tr('admin.orders.itemOrigin.manager_added', 'Gestor')}
                                                  </span>
                                                ) : null}
                                                <span title={`Solicitado: ${requestedQty}`} className="text-[10px] text-muted-foreground/60 tabular-nums leading-none">{requestedQty}</span>
                                                <span title={`Atendido: ${normalizedAttendedQty}`} className={`text-sm font-semibold tabular-nums leading-none ${isRemoved ? 'line-through text-muted-foreground/40' : isAttended ? 'text-emerald-600' : 'text-foreground'}`}>
                                                  {normalizedAttendedQty}
                                                </span>
                                                {isAttended && !isRemoved ? (
                                                  <span title="Atendido" className="mt-0.5 h-1 w-1 rounded-full bg-emerald-500" />
                                                ) : null}
                                              </div>
                                            )

                                            if (isOrderConfirmed || order.status === 'RELEASED' || !canEditOrder) {
                                              return (
                                                <div key={item.id} className={`rounded-md py-1 ${isRemoved ? 'bg-rose-50/40 dark:bg-rose-950/10' : isAttended ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}`}>
                                                  {cellContent}
                                                </div>
                                              )
                                            }

                                            return (
                                              <div
                                                key={item.id}
                                                className={`rounded-md transition-colors ${
                                                  isOpen
                                                    ? 'bg-primary/8 ring-1 ring-inset ring-primary/30'
                                                    : isRemoved
                                                      ? 'bg-rose-50/40 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                                                    : isAttended
                                                      ? 'bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                                      : isManagerAdded
                                                        ? 'bg-amber-50/50 ring-1 ring-inset ring-amber-200/80 hover:bg-amber-50 dark:bg-amber-950/10 dark:ring-amber-900/40 dark:hover:bg-amber-950/20'
                                                        : 'hover:bg-muted/60'
                                                }`}
                                              >
                                                <Popover
                                                  open={isOpen}
                                                  onOpenChange={(open) => {
                                                    if (!open && hasAttendedQtyChanges) {
                                                      void handleSaveAttendedQty(item)
                                                    }
                                                    setOpenCellId(open ? item.id : null)
                                                  }}
                                                >
                                                  <PopoverTrigger asChild>
                                                    <button type="button" className="w-full cursor-pointer py-1 focus:outline-none">
                                                      {cellContent}
                                                    </button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-64 border-border/50 p-0 shadow-lg" side="top" align="center" sideOffset={8}>
                                                    <div className="border-b border-border/40 px-4 pt-3 pb-2">
                                                      <p className="text-sm font-semibold leading-tight text-foreground">{group.productName}</p>
                                                      <p className="mt-0.5 text-xs text-muted-foreground">SKU: {group.sku}</p>
                                                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                        {resolveVariantAttributes(item).map((attribute, attributeIndex) => (
                                                          <span key={`${item.id}-${attribute.key}-${attributeIndex}`} className="text-xs text-muted-foreground">
                                                            <span className="font-medium text-foreground">{attribute.key}:</span> {attribute.value}
                                                          </span>
                                                        ))}
                                                      </div>
                                                    </div>

                                                    <div className="space-y-3 px-4 py-3">
                                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>Estoque atual</span>
                                                        <span className="font-semibold tabular-nums text-foreground">
                                                          {resolveVariantAvailableQty(
                                                            Number(item.variantStockQty || 0),
                                                            Number(item.variantReservedQty || 0),
                                                          )}
                                                        </span>
                                                      </div>

                                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>Solicitado</span>
                                                        <span className="font-semibold tabular-nums text-foreground">{requestedQty}</span>
                                                      </div>

                                                      <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground">Atendido</span>
                                                        <div className="flex items-center gap-2">
                                                          <button
                                                            type="button"
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
                                                            disabled={isSaving || normalizedAttendedQty <= 0}
                                                            onClick={() => {
                                                              const next = Math.max(0, normalizedAttendedQty - 1)
                                                              setAttendedQtyDraft((prev) => ({ ...prev, [item.id]: next }))
                                                            }}
                                                          >
                                                            <span className="text-base font-medium leading-none">−</span>
                                                          </button>
                                                          <span className="w-8 text-center text-sm font-bold tabular-nums">{normalizedAttendedQty}</span>
                                                          <button
                                                            type="button"
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
                                                            disabled={isSaving || normalizedAttendedQty >= stockLimit}
                                                            onClick={() => {
                                                              const next = clampOrderEditQty(normalizedAttendedQty + 1, stockLimit, 0)
                                                              setAttendedQtyDraft((prev) => ({ ...prev, [item.id]: next }))
                                                            }}
                                                          >
                                                            <span className="text-base font-medium leading-none">+</span>
                                                          </button>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 px-3 pb-2">
                                                      <button
                                                        type="button"
                                                        className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${
                                                          isAttended
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                            : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                                                        }`}
                                                        disabled={isSaving}
                                                        onClick={async () => {
                                                          if (isAttended) {
                                                            await handleToggleFulfilled(item.id, false)
                                                            return
                                                          }

                                                          const requestedAttendedQty = clampOrderEditQty(requestedQty, stockLimit, 0)
                                                          setAttendedQtyDraft((prev) => ({ ...prev, [item.id]: requestedAttendedQty }))
                                                          await handleSaveAttendedQty(item, requestedAttendedQty)
                                                          setOpenCellId(null)
                                                        }}
                                                      >
                                                        <Check className="h-3.5 w-3.5" />
                                                        {isAttended ? 'Atendido' : isRemoved ? 'Reativar e marcar atendido' : 'Marcar atendido'}
                                                      </button>
                                                      {hasAttendedQtyChanges ? (
                                                        <button
                                                          type="button"
                                                          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                                                          disabled={isSaving}
                                                          onClick={async () => {
                                                            await handleSaveAttendedQty(item)
                                                            setOpenCellId(null)
                                                          }}
                                                        >
                                                          <Save className="h-3.5 w-3.5" />
                                                          Salvar
                                                        </button>
                                                      ) : null}
                                                    </div>

                                                    <div className="px-3 pb-3">
                                                      <button
                                                        type="button"
                                                        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-40 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300"
                                                        disabled={isSaving || isRemoved}
                                                        onClick={async () => {
                                                          await handleRemoveItem(item.id)
                                                          setOpenCellId(null)
                                                        }}
                                                      >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        {isRemoved ? 'Ja marcado como nao atendido' : 'Nao atendido'}
                                                      </button>
                                                    </div>
                                                  </PopoverContent>
                                                </Popover>
                                              </div>
                                            )
                                          })}
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

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/10 bg-muted/10 px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Solicitado: <span className="font-semibold tabular-nums text-foreground">{groupRequested}</span></span>
                        <span className="text-muted-foreground text-right">R$ <span className="tabular-nums">{groupSubtotal.toFixed(2)}</span></span>
                        <span className="text-muted-foreground">Atendido: <span className="font-semibold tabular-nums text-foreground">{groupFulfilled}</span></span>
                        <span className="text-muted-foreground text-right">R$ <span className="font-semibold tabular-nums text-foreground">{groupAttendedSubtotal.toFixed(2)}</span></span>
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
                    <CloudflareImage
                      src={productPreview.imageUrl}
                      cloudflare={{ width: 640, height: 640, fit: "cover", dpr: 2 }}
                      alt={productPreview.productName}
                      width={640}
                      height={640}
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
                  <span className="text-muted-foreground">
                    {hasFulfillmentProgress ? 'Subtotal (atendido)' : 'Subtotal'}
                  </span>
                  <span className="font-semibold tabular-nums">R$ {orderSubtotal.toFixed(2)}</span>
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
                            <p className="font-medium">Detalhes dos descontos</p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Cupom{order.couponCode ? ` (${order.couponCode})` : ''}</span>
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
                    {!editingShipping && canManageShipping ? (
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
                  <span className="text-base font-medium">Total</span>
                  <span className="text-right text-xl font-medium tabular-nums">R$ {orderTotal.toFixed(2)}</span>
                </div>
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
                  {canEditOrder ? (
                    <Button variant="outline" size="sm" onClick={() => setEditingNotes(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Observações
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <OrderPaymentsCard
            orderId={orderId}
            storeId={order?.storeId ?? null}
            paymentStatus={order?.paymentStatus}
            initialPayments={initialPayments}
            initialPaymentLinks={initialPaymentLinks}
            readOnly={!canEditOrder}
            paymentLinkLocked={hasPendingFulfillmentCompletion}
            paymentLinkLockReason={fulfillmentCompletionBlockMessage}
          />

          {canEditOrder || canSendMessages ? (
            <div className="print:hidden pl-1 space-y-1">
              {canSendMessages ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs font-normal text-muted-foreground inline-flex items-center gap-1.5"
                  onClick={() => setCommunicationPanel('message')}
                >
                  <Send className="h-3.5 w-3.5" />
                  Disparo de Mensagem ao Cliente
                </Button>
              ) : null}
              {canEditOrder ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs font-normal text-muted-foreground inline-flex items-center gap-1.5"
                  onClick={() => setCommunicationPanel('webhook')}
                >
                  <Webhook className="h-3.5 w-3.5" />
                  Disparo Manual de Webhook
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
          </div>
        </div>
      </div>

      <div className="print:hidden fixed bottom-22 md:bottom-6 right-4 md:right-6 z-50 flex items-center gap-3">
        {canEditOrder ? (
          <Button
            onClick={handleFloatingSaveClick}
            disabled={isSaving || isFloatingSaveLoading}
            className="h-14 w-30 px-6 rounded-full bg-primary hover:bg-primary/90 shadow-[0_4px_24px_rgba(0,0,0,0.25)] text-sm font-semibold gap-2"
          >
            {isSaving || isFloatingSaveLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            <span>{isSaving || isFloatingSaveLoading ? 'Salvando...' : 'Salvar'}</span>
          </Button>
        ) : null}

        <FloatingActionMenu
          className="relative bottom-auto right-auto"
          options={[
            ...(canEditOrder && !isOrderConfirmed && order.status !== 'RELEASED'
              ? [
                  {
                    label: 'Adicionar Produto',
                    Icon: <Plus className="h-4 w-4" />,
                    onClick: () => {
                      setAddProductOpen(true);
                    },
                  },
                ]
              : []),
            ...(canEditOrder && order.status !== 'RELEASED'
              ? [
                  {
                    label: 'Marcar Todos Atendidos',
                    Icon: <Check className="h-4 w-4" />,
                    onClick: () => {
                      void handleMarkAllFulfilled();
                    },
                  },
                ]
              : []),
            {
              label: 'Imprimir Pedido',
              Icon: <FileText className="h-4 w-4" />,
              onClick: () => {
                void handleExportPdf();
              },
            },
            {
              label: 'Imprimir Romaneio',
              Icon: <FileText className="h-4 w-4" />,
              onClick: () => {
                void handlePrintRomaneio();
              },
            },
            {
              label: 'Imprimir Etiqueta',
              Icon: <Printer className="h-4 w-4" />,
              onClick: () => {
                void handlePrintLabel();
              },
            },
            {
              label: 'WhatsApp',
              Icon: <Send className="h-4 w-4" />,
              onClick: () => {
                handleOpenWhatsApp();
              },
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
    </div>
  );
}
