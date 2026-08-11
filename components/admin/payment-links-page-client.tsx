"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CalendarIcon, CreditCard, Copy, Ban, Plus, RefreshCw, Eye, History, Pencil, MoreHorizontal, ExternalLink, Search, SlidersHorizontal, FilterX, Package, Check, ChevronsUpDown } from "lucide-react"

import {
  createManualPaymentLinkAction,
  cancelOrderPaymentLinkAction,
  getPaymentLinkDetailAction,
  listPaymentLinksAction,
  updateManualPaymentLinkAction,
} from "@/lib/actions/orders"
import { getCustomersAction } from "@/lib/actions/customers"
import { useAdminStore } from "@/contexts/admin-store-context"
import { buildStorefrontUrl } from "@/lib/storefront-url"
import { cn } from "@/lib/utils"
import CurrencyInput from "@/components/form/CurrencyInput"
import AdminPaginationControls from "@/components/admin/admin-pagination-controls"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type PaymentLinkSummary = {
  id: number
  store_id: number
  order_id: number | null
  customer_id: number | null
  customer_name?: string | null
  token: string
  status: string
  amount_cents: number
  expires_at: string | null
  open_count: number
  attempt_count: number
  created_at: string
  meta: Record<string, unknown> | null
}

interface PaymentLinksPageClientProps {
  initialItems: PaymentLinkSummary[]
  initialTotal: number
  initialLimit?: number
  initialPage?: number
}

const PAYMENT_LINK_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function parsePaymentLinkPageLimit(value?: string | number | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return PAYMENT_LINK_PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAYMENT_LINK_PAGE_SIZE_OPTIONS)[number]) ? parsed : 20
}

type CustomerOption = {
  id: number
  label: string
  email: string | null
  document: string | null
}

type PaymentLinkCustomerSummary = {
  id: number
  name: string | null
  email: string
  document: string | null
}

type PaymentLinkDetail = {
  link: PaymentLinkSummary & {
    description?: string | null
  }
  customer?: PaymentLinkCustomerSummary | null
}

type PaymentType = "PIX" | "BOLETO" | "CARD"

const PAYMENT_TYPE_OPTIONS: Array<{ value: PaymentType; label: string; description: string }> = [
  { value: "PIX", label: "PIX", description: "Pagamento instantâneo" },
  { value: "BOLETO", label: "Boleto", description: "Geração de boleto bancário" },
  { value: "CARD", label: "Cartão", description: "Cartão com tokenização no storefront" },
]

function defaultExpirationDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100)
}

function formatDateTime(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date)
}

function buildPaymentLinkPublicUrl(
  storefrontUrl: string,
  token: string,
  isPrivateStorefront = false,
  origin?: string,
): string {
  const pathPrefix = isPrivateStorefront ? "/private" : ""
  return buildStorefrontUrl(
    storefrontUrl,
    `${pathPrefix}/payment-links/${encodeURIComponent(token)}`,
    origin,
  )
}

function inferPaymentType(meta: Record<string, unknown> | null): "PIX" | "BOLETO" | "CARD" {
  const raw = String(meta?.payment_type || "").trim().toUpperCase()
  if (raw === "BOLETO") return "BOLETO"
  if (raw === "CARD" || raw === "CARTAO" || raw === "CARTAO_EXTERNO") return "CARD"
  return "PIX"
}

function extractAcceptedPaymentTypes(meta: Record<string, unknown> | null): PaymentType[] {
  const entries = Array.isArray(meta?.payment_types)
    ? meta?.payment_types
    : meta?.accepted_payment_types
  const normalized = Array.from(
    new Set(
      (Array.isArray(entries) ? entries : [meta?.payment_type])
        .map((entry) => String(entry || "").trim().toUpperCase())
        .filter((entry) => entry === "PIX" || entry === "BOLETO" || entry === "CARD")
    )
  ) as PaymentType[]

  return normalized.length > 0 ? normalized : [inferPaymentType(meta)]
}

function getPaymentLinkStatusChipClass(status: string): string {
  const normalized = String(status || "").trim().toUpperCase()

  if (normalized === "ACTIVE") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700"
  }

  if (normalized === "COMPLETED") {
    return "border-blue-300 bg-blue-50 text-blue-700"
  }

  if (normalized === "CANCELLED" || normalized === "FAILED") {
    return "border-rose-300 bg-rose-50 text-rose-700"
  }

  if (normalized === "EXPIRED") {
    return "border-amber-300 bg-amber-50 text-amber-700"
  }

  return "border-border bg-muted text-foreground"
}

function getPaymentLinkStatusDotClass(status: string): string {
  const normalized = String(status || "").trim().toUpperCase()

  if (normalized === "ACTIVE") {
    return "bg-emerald-500"
  }

  if (normalized === "COMPLETED") {
    return "bg-blue-500"
  }

  if (normalized === "CANCELLED" || normalized === "FAILED") {
    return "bg-rose-500"
  }

  if (normalized === "EXPIRED") {
    return "bg-amber-500"
  }

  return "bg-slate-400"
}

export default function PaymentLinksPageClient({
  initialItems,
  initialTotal,
  initialLimit = 20,
  initialPage = 1,
}: PaymentLinksPageClientProps) {
  const { storefrontUrl, store } = useAdminStore()
  const pathname = usePathname()
  const router = useRouter()
  const isPrivateStorefront = Boolean(store?.maintenanceMode)
  const [items, setItems] = useState<PaymentLinkSummary[]>(initialItems)
  const [totalItems, setTotalItems] = useState<number>(initialTotal)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerSearch, setCustomerSearch] = useState<string>("")
  const [customerLoading, setCustomerLoading] = useState<boolean>(false)
  const [customerOpen, setCustomerOpen] = useState<boolean>(false)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("")
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage))
  const [selectedLimit, setSelectedLimit] = useState<number>(parsePaymentLinkPageLimit(initialLimit))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [selectedCustomerPreview, setSelectedCustomerPreview] = useState<CustomerOption | null>(null)
  const [amountValue, setAmountValue] = useState<number | null>(null)
  const [descriptionInput, setDescriptionInput] = useState<string>("")
  const [expiresAtInput, setExpiresAtInput] = useState<string>(defaultExpirationDate())
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>(["PIX"])
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null)
  const [editingLinkLoading, setEditingLinkLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, startTransition] = useTransition()
  const expirationDate = expiresAtInput ? new Date(`${expiresAtInput}T12:00:00`) : undefined

  useEffect(() => {
    if (!isCreateDrawerOpen) {
      setCustomerOpen(false)
      setCustomerSearch("")
      setCustomers([])
      setSelectedCustomerPreview(null)
      setSelectedCustomerId("")
      setAmountValue(null)
      setDescriptionInput("")
      setExpiresAtInput(defaultExpirationDate())
      setPaymentTypes(["PIX"])
      setEditingLinkId(null)
      setEditingLinkLoading(false)
    }
  }, [isCreateDrawerOpen])

  useEffect(() => {
    if (!isCreateDrawerOpen) return

    const handle = setTimeout(async () => {
      setCustomerLoading(true)
      const result = await getCustomersAction({
        status: "APPROVED",
        search: customerSearch.trim() || undefined,
      })

      if (!result.success || !result.data) {
        setCustomerLoading(false)
        return
      }

      const options = result.data
        .map((customer) => {
          const numericId = Number(customer.id)
          if (!Number.isFinite(numericId) || numericId <= 0) return null

          const primaryName = customer.contactName?.trim() || customer.companyName?.trim() || customer.tradeName?.trim()
          const label = primaryName || customer.email?.trim() || `Cliente #${numericId}`

          return {
            id: Math.trunc(numericId),
            label,
            email: customer.email?.trim() || null,
            document: customer.cnpj?.trim() || null,
          }
        })
        .filter((entry): entry is CustomerOption => Boolean(entry))

      setCustomers(options)
      setCustomerLoading(false)
    }, 250)

    return () => clearTimeout(handle)
  }, [isCreateDrawerOpen, customerSearch])

  const selectedCustomer = useMemo(
    () => customers.find((entry) => String(entry.id) === selectedCustomerId)
      || (selectedCustomerPreview && String(selectedCustomerPreview.id) === selectedCustomerId ? selectedCustomerPreview : null),
    [customers, selectedCustomerId, selectedCustomerPreview],
  )

  const totals = useMemo(() => {
    const activeCount = items.filter((entry) => entry.status === "ACTIVE").length
    const completedCount = items.filter((entry) => entry.status === "COMPLETED").length
    const cancelledCount = items.filter((entry) => entry.status === "CANCELLED").length
    const expiredCount = items.filter((entry) => entry.status === "EXPIRED").length
    return {
      total: totalItems,
      active: activeCount,
      completed: completedCount,
      cancelled: cancelledCount,
      expired: expiredCount,
    }
  }, [items, totalItems])

  const hasActiveFilters = statusFilter !== "ALL" || searchTerm.trim().length > 0

  const pageSize = selectedLimit
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const pageStart = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1
  const pageEnd = totalItems === 0 ? 0 : pageStart + Math.max(0, items.length - 1)

  function buildPaymentLinksQuery(input?: { page?: number; limit?: number }) {
    const params = new URLSearchParams()
    const nextLimit = parsePaymentLinkPageLimit(input?.limit ?? selectedLimit)
    const nextPage = Math.max(1, Number(input?.page ?? currentPage) || 1)

    if (nextLimit !== 20) {
      params.set('limit', String(nextLimit))
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage))
    }

    return params
  }

  function syncPaymentLinksUrl(input?: { page?: number; limit?: number }) {
    const params = buildPaymentLinksQuery(input)
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    window.history.replaceState(null, '', nextUrl)
  }

  useEffect(() => {
    setItems(initialItems)
    setTotalItems(initialTotal)
    setSelectedLimit(parsePaymentLinkPageLimit(initialLimit))
    setCurrentPage(Math.max(1, initialPage))
  }, [initialItems, initialTotal, initialLimit, initialPage])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  function applySearch(options?: { closeMobile?: boolean }) {
    setCurrentPage(1)
    setDebouncedSearchTerm(searchTerm.trim())
    syncPaymentLinksUrl({ page: 1, limit: selectedLimit })
    if (options?.closeMobile) {
      setMobileFiltersOpen(false)
    }
  }

  useEffect(() => {
    void refresh({ withInfo: false })
  }, [currentPage, statusFilter, debouncedSearchTerm, selectedLimit])

  async function refresh(options?: {
    nextStatus?: string
    nextPage?: number
    nextSearch?: string
    withInfo?: boolean
  }) {
    const resolvedStatus = typeof options?.nextStatus === "string" ? options.nextStatus : statusFilter
    const resolvedPage = Number(options?.nextPage || currentPage)
    const normalizedPage = Number.isFinite(resolvedPage) && resolvedPage > 0 ? Math.trunc(resolvedPage) : 1
    const resolvedSearch = String(options?.nextSearch ?? debouncedSearchTerm).trim()

    startTransition(async () => {
      setError(null)
      const result = await listPaymentLinksAction({
        status: resolvedStatus === "ALL" ? null : resolvedStatus,
        search: resolvedSearch || null,
        limit: pageSize,
        offset: (normalizedPage - 1) * pageSize,
      })

      if (!result.success || !result.data) {
        setError(result.error || "Erro ao carregar links")
        return
      }

      setItems(result.data.items as PaymentLinkSummary[])
      setTotalItems(Number(result.data.total) || 0)
      if (options?.withInfo) {
        setInfo("Histórico atualizado")
      }
    })
  }

  function applyStatusFilter(nextStatus: string) {
    setCurrentPage(1)
    setStatusFilter(nextStatus)
    syncPaymentLinksUrl({ page: 1, limit: selectedLimit })
  }

  function clearFilters() {
    setCurrentPage(1)
    setSearchTerm("")
    setDebouncedSearchTerm("")
    setStatusFilter("ALL")
    setMobileFiltersOpen(false)
    syncPaymentLinksUrl({ page: 1, limit: selectedLimit })
  }

  function applyPageLimit(nextLimit: number) {
    setSelectedLimit(nextLimit)
    setCurrentPage(1)
    syncPaymentLinksUrl({ page: 1, limit: nextLimit })
  }

  function handlePageChange(page: number) {
    const nextPage = Math.max(1, Math.min(totalPages, page))
    setCurrentPage(nextPage)
    syncPaymentLinksUrl({ page: nextPage, limit: selectedLimit })
  }

  async function handleCreateManual() {
    const numericCustomerId = Number(selectedCustomerId)
    if (!Number.isFinite(numericCustomerId) || numericCustomerId <= 0) {
      setError("Selecione o cliente")
      return
    }

    if (!Number.isFinite(Number(amountValue)) || Number(amountValue) <= 0) {
      setError("Informe um valor válido")
      return
    }

    if (!expiresAtInput) {
      setError("Selecione a data de expiração")
      return
    }

    if (paymentTypes.length === 0) {
      setError("Selecione ao menos um tipo de pagamento")
      return
    }

    startTransition(async () => {
      setError(null)
      setInfo(null)

      const result = editingLinkId
        ? await updateManualPaymentLinkAction(editingLinkId, {
            amountCents: Math.round(Number(amountValue) * 100),
            customerId: Math.trunc(numericCustomerId),
            description: descriptionInput,
            expiresAt: expiresAtInput,
            paymentTypes,
          })
        : await createManualPaymentLinkAction({
            amountCents: Math.round(Number(amountValue) * 100),
            customerId: Math.trunc(numericCustomerId),
            description: descriptionInput,
            expiresAt: expiresAtInput,
            paymentTypes,
          })

      if (!result.success || !result.data) {
        setError(result.error || (editingLinkId ? "Erro ao editar link avulso" : "Erro ao criar link avulso"))
        return
      }

      setInfo(
        editingLinkId
          ? `Link #${result.data.link.id} atualizado com sucesso`
          : `Link #${result.data.link.id} criado com sucesso`
      )
      setIsCreateDrawerOpen(false)
      await refresh({ withInfo: false })
    })
  }

  async function handleCancel(linkId: number) {
    startTransition(async () => {
      setError(null)
      setInfo(null)
      const result = await cancelOrderPaymentLinkAction(linkId, "cancelled_from_payment_links_screen")
      if (!result.success) {
        setError(result.error || "Erro ao cancelar link")
        return
      }

      setInfo(`Link #${linkId} cancelado`)
      await refresh({ withInfo: false })
    })
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setInfo("Link copiado")
    } catch {
      setError("Não foi possível copiar o link")
    }
  }

  async function handleOpenEdit(entry: PaymentLinkSummary) {
    setError(null)
    setInfo(null)
    setEditingLinkId(entry.id)
    setIsCreateDrawerOpen(true)
    setEditingLinkLoading(true)

    const detailResult = await getPaymentLinkDetailAction(entry.id)
    if (!detailResult.success || !detailResult.data) {
      setEditingLinkLoading(false)
      setError(detailResult.error || "Erro ao carregar link para edição")
      return
    }

    const detail = detailResult.data as PaymentLinkDetail
    const link = detail.link

    setAmountValue((Number(link.amount_cents) || 0) / 100)
    setDescriptionInput(String(link.description || ""))
    if (link.expires_at) {
      const expiresDate = new Date(link.expires_at)
      const year = expiresDate.getFullYear()
      const month = String(expiresDate.getMonth() + 1).padStart(2, "0")
      const day = String(expiresDate.getDate()).padStart(2, "0")
      setExpiresAtInput(`${year}-${month}-${day}`)
    } else {
      setExpiresAtInput(defaultExpirationDate())
    }
    setPaymentTypes(extractAcceptedPaymentTypes(link.meta))
    setSelectedCustomerId(String(link.customer_id || ""))

    if (detail.customer) {
      setSelectedCustomerPreview({
        id: detail.customer.id,
        label: detail.customer.name || detail.customer.email || `Cliente #${detail.customer.id}`,
        email: detail.customer.email || null,
        document: detail.customer.document || null,
      })
    }

    setEditingLinkLoading(false)
  }

  function togglePaymentType(nextType: PaymentType, checked: boolean) {
    setPaymentTypes((current) => {
      if (checked) {
        return current.includes(nextType) ? current : [...current, nextType]
      }
      const next = current.filter((entry) => entry !== nextType)
      return next
    })
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" />
              Operação financeira
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <CreditCard className="h-6 w-6 text-primary" />
              Links de Pagamento
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {items.length} links nesta página de {totalItems} resultados.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full md:hidden"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Abrir filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => void refresh({ withInfo: true })} disabled={loading} className="h-10 gap-2 rounded-full px-4">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              onClick={() => {
                setEditingLinkId(null)
                setIsCreateDrawerOpen(true)
              }}
              className="h-10 gap-2 rounded-full px-5"
            >
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </div>
        </div>
      </div>

      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de links no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por id, token, cliente ou pedido..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void applySearch({ closeMobile: true })}
              className="h-10 w-full rounded-full"
            >
              Buscar
            </Button>
            <select
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) => applyStatusFilter(event.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativo</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="FAILED">Falhou</option>
              <option value="EXPIRED">Expirado</option>
            </select>
            <Select
              value={String(selectedLimit)}
              onValueChange={(value) => {
                const nextLimit = Number.parseInt(value, 10)
                if (!Number.isFinite(nextLimit)) return
                applyPageLimit(nextLimit)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full">
                <SelectValue placeholder="Itens/pagina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por pagina</SelectItem>
                <SelectItem value="50">50 por pagina</SelectItem>
                <SelectItem value="100">100 por pagina</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearFilters}
              className="h-10 w-10 rounded-full self-end"
              aria-label="Limpar filtros"
              title="Limpar filtros"
              disabled={!hasActiveFilters}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
          <DrawerFooter>
            <Button type="button" className="w-full cursor-pointer bg-black text-white hover:bg-black/90" onClick={() => setMobileFiltersOpen(false)}>
              Fechar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Links</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{totals.total}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Ativos</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{totals.active}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Concluídos</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{totals.completed}</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2 text-blue-700">
              <Check className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-blue-300 to-blue-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Cancelados</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{totals.cancelled}</p>
            </div>
            <div className="rounded-full bg-rose-100 p-2 text-rose-700">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-rose-300 to-rose-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Expirados</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{totals.expired}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <History className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-amber-300 to-amber-500" />
        </div>
      </div>

      <form
        className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block"
        onSubmit={(event) => {
          event.preventDefault()
          void applySearch()
        }}
      >
        <div className="flex w-full flex-col items-stretch gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 xl:max-w-xl">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por id, token, cliente ou pedido..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
              Buscar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm sm:w-auto xl:w-44"
            value={statusFilter}
            onChange={(event) => applyStatusFilter(event.target.value)}
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="COMPLETED">Concluído</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="FAILED">Falhou</option>
            <option value="EXPIRED">Expirado</option>
          </select>
          <Select
            value={String(selectedLimit)}
            onValueChange={(value) => {
              const nextLimit = Number.parseInt(value, 10)
              if (!Number.isFinite(nextLimit)) return
              applyPageLimit(nextLimit)
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
              <SelectValue placeholder="Itens/pagina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 por pagina</SelectItem>
              <SelectItem value="50">50 por pagina</SelectItem>
              <SelectItem value="100">100 por pagina</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={clearFilters}
            className="h-10 w-10 shrink-0 rounded-full"
            aria-label="Limpar filtros"
            title="Limpar filtros"
            disabled={!hasActiveFilters}
          >
            <FilterX className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={() => void refresh({ withInfo: true })} disabled={loading} className="h-10 shrink-0 rounded-full px-4">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-medium">Status do Link:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Ativo</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-300" />Concluído</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" />Cancelado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />Expirado</span>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}

      <Card className="rounded-xl border border-border/20 shadow-none overflow-hidden p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead className="w-22.5">ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-32.5 text-center">Status</TableHead>
                <TableHead className="w-22.5 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => {
                const url = buildPaymentLinkPublicUrl(
                  storefrontUrl,
                  String(entry.token),
                  isPrivateStorefront,
                  undefined,
                )

                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer odd:bg-background even:bg-muted/25 hover:bg-muted/40"
                    onClick={() => router.push(`/payment-links/${entry.id}`)}
                  >
                    <TableCell>
                      <span className={`block h-2.5 w-2.5 rounded-full ${getPaymentLinkStatusDotClass(entry.status)}`} />
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-primary">
                      #{entry.id}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(entry.created_at)}</TableCell>
                    <TableCell>
                      {String(entry.customer_name || "").trim()
                        || (entry.customer_id ? `Cliente #${entry.customer_id}` : "-")}
                    </TableCell>
                    <TableCell
                      onClick={(event) => {
                        if (entry.order_id) event.stopPropagation()
                      }}
                    >
                      {entry.order_id ? (
                        <Link
                          href={`/orders/${entry.order_id}`}
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          #{entry.order_id}
                        </Link>
                      ) : (
                        "Avulso"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(entry.amount_cents)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {extractAcceptedPaymentTypes(entry.meta).map((type) => (
                          <Badge key={`${entry.id}-${type}`} variant="outline">{type}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`w-full justify-center text-xs ${getPaymentLinkStatusChipClass(entry.status)}`}
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label="Abrir ações do link"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild className="cursor-pointer">
                              <Link href={`/payment-links/${entry.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalhes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(entry)}
                              disabled={loading || Boolean(entry.order_id) || entry.status === "COMPLETED"}
                              className="cursor-pointer data-disabled:cursor-not-allowed"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopy(url)} className="cursor-pointer">
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(url, "_blank", "noopener,noreferrer")} className="cursor-pointer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCancel(entry.id)}
                              disabled={loading || entry.status !== "ACTIVE"}
                              className="cursor-pointer text-destructive focus:text-destructive data-disabled:cursor-not-allowed"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Cancelar link
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                    Nenhum link encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalItems > 0 ? (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          showing={{
            start: pageStart,
            end: pageEnd,
            total: totalItems,
          }}
        />
      ) : null}

      <Drawer open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen} direction="right">
        <DrawerContent className="w-full sm:w-[80vw] lg:w-3xl max-w-none p-0">
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b p-6 pb-4 text-left">
              <DrawerTitle className="flex items-center gap-2">
              {editingLinkId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingLinkId ? `Editar Link Avulso #${editingLinkId}` : "Novo Link Avulso"}
              </DrawerTitle>
              <DrawerDescription>
              {editingLinkId
                ? "Atualize dados do link manual enquanto ele não estiver pago."
                : "Use para cobranças fora do pedido, com tipo PIX, boleto ou cartão."}
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {editingLinkLoading ? (
                <p className="text-sm text-muted-foreground">Carregando dados do link...</p>
              ) : null}

              <div className="space-y-2">
                <Label>Cliente</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="w-full cursor-pointer justify-between"
                    >
                      <span className="truncate text-left">
                        {selectedCustomer
                          ? `${selectedCustomer.label}${selectedCustomer.email ? ` - ${selectedCustomer.email}` : ""}`
                          : "Selecione o cliente"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-md p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar cliente por nome, empresa, e-mail ou CNPJ"
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        {customerLoading ? <CommandEmpty>Buscando clientes...</CommandEmpty> : null}
                        {!customerLoading && customers.length === 0 ? (
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        ) : null}
                        {!customerLoading && customers.length > 0 ? (
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={`${customer.label} ${customer.email || ""} ${customer.document || ""}`}
                                className="cursor-pointer"
                                onSelect={() => {
                                  setSelectedCustomerId(String(customer.id))
                                  setSelectedCustomerPreview(customer)
                                  setCustomerOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomerId === String(customer.id) ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{customer.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {customer.email || "Sem e-mail"}
                                    {customer.document ? ` - ${customer.document}` : ""}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ) : null}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Todo link deve ficar vinculado a um cliente.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Valor</Label>
                <CurrencyInput
                  value={amountValue}
                  onChange={setAmountValue}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Expiração</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full cursor-pointer justify-between text-left font-normal",
                        !expirationDate && "text-muted-foreground"
                      )}
                    >
                      {expirationDate ? format(expirationDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                      <CalendarIcon className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expirationDate}
                      onSelect={(date) => {
                        if (!date) return
                        const year = date.getFullYear()
                        const month = String(date.getMonth() + 1).padStart(2, "0")
                        const day = String(date.getDate()).padStart(2, "0")
                        setExpiresAtInput(`${year}-${month}-${day}`)
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  O link ficará disponível até o fim do dia selecionado.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Tipos aceitos no pagamento</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PAYMENT_TYPE_OPTIONS.map((option) => {
                    const checked = paymentTypes.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                          checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => togglePaymentType(option.value, value === true)}
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  No storefront, o cliente verá apenas os meios marcados aqui.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="drawer-description">Descrição</Label>
                <Textarea
                  id="drawer-description"
                  value={descriptionInput}
                  onChange={(event) => setDescriptionInput(event.target.value)}
                  placeholder="Descreva a cobrança, itens ou contexto do link"
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>

            <DrawerFooter className="sticky bottom-0 border-t bg-background p-4 sm:p-6 flex-row! justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDrawerOpen(false)}
                disabled={loading || editingLinkLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateManual} disabled={loading || editingLinkLoading} className="gap-2">
                <CreditCard className="h-4 w-4" />
                {loading ? (editingLinkId ? "Salvando..." : "Criando...") : (editingLinkId ? "Salvar alterações" : "Criar Link")}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
