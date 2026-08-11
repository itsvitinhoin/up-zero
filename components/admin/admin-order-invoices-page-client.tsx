"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  FilterX,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import type { OrderInvoice } from "@/lib/types"
import { getFiscalNaturesAction, type FiscalOperationNature } from "@/lib/actions/fiscal"
import type { CreateStandaloneInvoiceRequest } from "@/lib/actions/orders"
import { createStandaloneInvoiceAction } from "@/lib/actions/orders"
import CurrencyInput from "@/components/form/CurrencyInput"
import IntegerInput from "@/components/form/IntegerInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import AdminPaginationControls from "@/components/admin/admin-pagination-controls"

interface AdminOrderInvoicesPageClientProps {
  initialInvoices: OrderInvoice[]
  statsInvoices?: OrderInvoice[]
  operationNatures?: FiscalOperationNature[]
  currentPage?: number
  pageSize?: number
  totalCount?: number
  totalPages?: number
  initialSearch?: string
  initialStatus?: string
  initialInvoiceType?: string
}

const INVOICE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function parseInvoicePageLimit(value?: string | number | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return INVOICE_PAGE_SIZE_OPTIONS.includes(parsed as (typeof INVOICE_PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : 20
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "PENDING", label: "Pendente" },
  { value: "PROCESSING", label: "Processando" },
  { value: "AUTHORIZED", label: "Autorizada" },
  { value: "REJECTED", label: "Rejeitada" },
  { value: "CANCELLED", label: "Cancelada" },
  { value: "ERROR", label: "Erro" },
]

const INVOICE_TYPE_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "order", label: "Vinculada a pedido" },
  { value: "standalone", label: "NF avulsa" },
]

function getStatusBadgeVariant(
  status: OrderInvoice["status"],
): "emerald" | "amber" | "rose" | "slate" {
  if (status === "AUTHORIZED") return "emerald"
  if (status === "PENDING" || status === "PROCESSING") return "amber"
  if (status === "REJECTED" || status === "ERROR") return "rose"
  return "slate"
}

function getStatusDotClassName(status: OrderInvoice["status"]): string {
  if (status === "AUTHORIZED") return "bg-emerald-400"
  if (status === "PENDING" || status === "PROCESSING") return "bg-amber-400"
  if (status === "REJECTED" || status === "ERROR") return "bg-rose-400"
  return "bg-slate-400"
}

function statusLabel(status: OrderInvoice["status"]): string {
  const found = STATUS_OPTIONS.find((entry) => entry.value === status)
  return found?.label || status
}

function formatDateTime(value: Date | string | null): string {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleString("pt-BR")
}

function formatShortOrderId(orderId: string | null): string {
  const cleaned = String(orderId || "").trim()
  if (!cleaned) return "-"
  return cleaned.slice(0, 8).toUpperCase()
}

function buildInvoiceProxyHref(invoice: OrderInvoice, kind: "pdf" | "xml"): string | null {
  const isStandalone = (invoice.invoiceType ?? "order") === "standalone"
  const invoiceId = String(invoice.id || "").trim()
  const orderId = String(invoice.orderId || "").trim()

  if (!invoiceId) return null
  if (!isStandalone && !orderId) return null

  return isStandalone
    ? `/api/admin/invoice-download?kind=${kind}&invoiceType=standalone&invoiceId=${encodeURIComponent(invoiceId)}`
    : `/api/admin/invoice-download?kind=${kind}&orderId=${encodeURIComponent(orderId)}`
}

// UI form item — price in decimal BRL (e.g. 19.90), converted to centavos on submit
type FormItem = {
  description: string
  ncm: string
  cfop: string
  unit: string
  quantity: number
  unit_price: number | null
}

const EMPTY_ITEM: FormItem = {
  description: "",
  ncm: "",
  cfop: "",
  unit: "UN",
  quantity: 1,
  unit_price: null,
}

function emptyForm() {
  return {
    operation_nature_id: "",
    // recipient
    name: "",
    cnpj: "",
    cpf: "",
    email: "",
    phone: "",
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    city_code: "",
    note: "",
    items: [{ ...EMPTY_ITEM }] as FormItem[],
  }
}

export default function AdminOrderInvoicesPageClient({
  initialInvoices,
  statsInvoices,
  operationNatures = [],
  currentPage = 1,
  pageSize = 20,
  totalCount = 0,
  totalPages = 1,
  initialSearch = "",
  initialStatus = "all",
  initialInvoiceType = "all",
}: AdminOrderInvoicesPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState(initialInvoiceType)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [selectedLimit, setSelectedLimit] = useState<number>(parseInvoicePageLimit(pageSize))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [formResult, setFormResult] = useState<OrderInvoice | null>(null)
  const [isPending, startTransition] = useTransition()

  const [natures, setNatures] = useState<FiscalOperationNature[]>(operationNatures ?? [])
  useEffect(() => {
    getFiscalNaturesAction().then(setNatures).catch(() => {})
  }, [])

  useEffect(() => {
    setStatusFilter(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    setInvoiceTypeFilter(initialInvoiceType)
  }, [initialInvoiceType])

  useEffect(() => {
    setSearchInput(initialSearch)
    setSearchTerm(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setSelectedLimit(parseInvoicePageLimit(pageSize))
  }, [pageSize])

  const invoices = initialInvoices || []
  const statsSource = statsInvoices || invoices
  const isNumericOrderSearch = /^\d+$/.test(searchTerm.trim())

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch || isNumericOrderSearch) {
      return invoices
    }

    return invoices.filter((invoice) =>
      (invoice.orderId ?? "").toLowerCase().includes(normalizedSearch) ||
      formatShortOrderId(invoice.orderId).toLowerCase().includes(normalizedSearch) ||
      (invoice.nfNumber ?? "").toLowerCase().includes(normalizedSearch) ||
      (invoice.accessKey ?? "").toLowerCase().includes(normalizedSearch) ||
      String(invoice.id).includes(normalizedSearch),
    )
  }, [invoices, isNumericOrderSearch, searchTerm])

  const stats = useMemo(
    () => ({
      total: totalCount,
      authorized: statsSource.filter((invoice) => invoice.status === "AUTHORIZED").length,
      pending: statsSource.filter(
        (invoice) => invoice.status === "PENDING" || invoice.status === "PROCESSING",
      ).length,
      failed: statsSource.filter(
        (invoice) => invoice.status === "REJECTED" || invoice.status === "ERROR",
      ).length,
      standalone: statsSource.filter((invoice) => invoice.invoiceType === "standalone").length,
    }),
    [statsSource, totalCount],
  )

  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages))
  const pageStart = totalCount === 0 ? 0 : (safeCurrentPage - 1) * selectedLimit + 1
  const pageEnd =
    totalCount === 0 ? 0 : Math.min(totalCount, pageStart + Math.max(0, filteredInvoices.length - 1))

  function buildInvoicesQuery(input?: {
    page?: number
    limit?: number
    status?: string
    invoiceType?: string
    search?: string
  }) {
    const params = new URLSearchParams()
    const nextPage = Math.max(1, Number(input?.page ?? safeCurrentPage) || 1)
    const nextLimit = parseInvoicePageLimit(input?.limit ?? selectedLimit)
    const nextStatus = input?.status ?? statusFilter
    const nextInvoiceType = input?.invoiceType ?? invoiceTypeFilter
    const nextSearch = (input?.search ?? searchTerm).trim()

    if (nextPage > 1) params.set("page", String(nextPage))
    if (nextLimit !== 20) params.set("limit", String(nextLimit))
    if (nextStatus !== "all") params.set("status", nextStatus)
    if (nextInvoiceType !== "all") params.set("invoice_type", nextInvoiceType)
    if (nextSearch.length > 0) params.set("q", nextSearch)

    return params
  }

  function navigateWithParams(input?: {
    page?: number
    limit?: number
    status?: string
    invoiceType?: string
    search?: string
  }) {
    const params = buildInvoicesQuery(input)
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname)
    router.refresh()
  }

  function applyPageLimit(nextLimit: number) {
    setSelectedLimit(nextLimit)
    navigateWithParams({ page: 1, limit: nextLimit })
  }

  function handlePageChange(page: number) {
    navigateWithParams({ page })
  }

  const hasActiveFilter =
    searchTerm.trim().length > 0 || statusFilter !== "all" || invoiceTypeFilter !== "all"

  function handleSearchSubmit() {
    const nextSearch = searchInput.trim()
    setSearchTerm(nextSearch)
    setMobileFiltersOpen(false)
    navigateWithParams({ page: 1, search: nextSearch })
  }

  function clearFilters() {
    setSearchInput("")
    setSearchTerm("")
    setStatusFilter("all")
    setInvoiceTypeFilter("all")
    setMobileFiltersOpen(false)
    navigateWithParams({
      page: 1,
      search: "",
      status: "all",
      invoiceType: "all",
      limit: selectedLimit,
    })
  }

  function updateItem(index: number, field: keyof FormItem, value: string | number | null) {
    setForm((prev) => {
      const items = prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      )
      return { ...prev, items }
    })
  }

  function addItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  function openDialog() {
    setForm(emptyForm())
    setFormError(null)
    setFormResult(null)
    setSheetOpen(true)
  }

  function handleSubmit() {
    setFormError(null)

    const natureId = Number(form.operation_nature_id)
    if (!natureId) {
      setFormError("Selecione a natureza de operação.")
      return
    }
    if (!form.name.trim()) {
      setFormError("Nome do destinatário é obrigatório.")
      return
    }
    const hasCnpj = form.cnpj.trim().length > 0
    const hasCpf = form.cpf.trim().length > 0
    if (!hasCnpj && !hasCpf) {
      setFormError("Informe CNPJ ou CPF do destinatário.")
      return
    }
    if (!form.zip.trim() || !form.street.trim() || !form.number.trim() || !form.city.trim() || !form.state.trim() || !form.district.trim()) {
      setFormError("Preencha o endereço completo (CEP, logradouro, número, bairro, cidade, UF).")
      return
    }
    if (form.items.length === 0) {
      setFormError("Adicione ao menos um item.")
      return
    }
    for (const [i, item] of form.items.entries()) {
      if (!item.description.trim()) { setFormError(`Item ${i + 1}: descrição obrigatória.`); return }
      if (!item.ncm.trim()) { setFormError(`Item ${i + 1}: NCM obrigatório.`); return }
      if (item.quantity <= 0) { setFormError(`Item ${i + 1}: quantidade inválida.`); return }
      if (!item.unit_price || item.unit_price <= 0) { setFormError(`Item ${i + 1}: preço inválido.`); return }
    }

    const payload: CreateStandaloneInvoiceRequest = {
      operation_nature_id: natureId,
      recipient: {
        name: form.name.trim(),
        ...(hasCnpj ? { cnpj: form.cnpj.replace(/\D/g, "") } : {}),
        ...(hasCpf ? { cpf: form.cpf.replace(/\D/g, "") } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        zip: form.zip.replace(/\D/g, ""),
        street: form.street.trim(),
        number: form.number.trim(),
        ...(form.complement.trim() ? { complement: form.complement.trim() } : {}),
        district: form.district.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        ...(form.city_code.trim() ? { city_code: form.city_code.trim() } : {}),
      },
      items: form.items.map((item) => ({
        description: item.description.trim(),
        ncm: item.ncm.replace(/\D/g, ""),
        ...(item.cfop?.trim() ? { cfop: item.cfop.trim() } : {}),
        ...(item.unit?.trim() ? { unit: item.unit.trim() } : {}),
        quantity: Number(item.quantity),
        unit_price_cents: Math.round((item.unit_price ?? 0) * 100),
      })),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    }

    startTransition(async () => {
      const result = await createStandaloneInvoiceAction(payload)
      if (result.success && result.data) {
        setFormResult(result.data)
      } else {
        setFormError(result.error || "Erro ao emitir NF avulsa.")
      }
    })
  }

  function renderInvoiceActions(invoice: OrderInvoice) {
    return (
      <div className="flex items-center justify-end gap-2">
        {invoice.invoiceType !== "standalone" && invoice.orderId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${invoice.orderId}`}>
              Abrir pedido
              <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
        {invoice.pdfUrl && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildInvoiceProxyHref(invoice, "pdf") || "#"} target="_blank" rel="noopener noreferrer">
              PDF
            </Link>
          </Button>
        )}
        {invoice.xmlUrl && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildInvoiceProxyHref(invoice, "xml") || "#"} target="_blank" rel="noopener noreferrer">
              XML
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Fiscal
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              <FileText className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              Notas Fiscais
            </h1>
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground sm:text-sm">
              {hasActiveFilter
                ? `${filteredInvoices.length} notas nesta página com os filtros atuais.`
                : `${stats.total} notas fiscais registradas na loja.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-full px-4"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline sm:ml-2">Atualizar</span>
            </Button>
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
            <Button size="sm" className="h-10 gap-2 rounded-full px-4 sm:px-5" onClick={openDialog}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova NF</span>
            </Button>
          </div>
        </div>
      </div>

      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de notas fiscais no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pedido, número NF, chave ou ID..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    handleSearchSubmit()
                  }
                }}
                className="pl-9 pr-24"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-1 top-1/2 h-8 -translate-y-1/2"
                onClick={handleSearchSubmit}
              >
                Buscar
              </Button>
            </div>
            <Select
              value={invoiceTypeFilter}
              onValueChange={(value) => {
                setInvoiceTypeFilter(value)
                navigateWithParams({ page: 1, invoiceType: value })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                navigateWithParams({ page: 1, status: value })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabled={!hasActiveFilter}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" className="w-full bg-black text-white hover:bg-black/90">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Total
              </p>
              <p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{stats.total}</p>
              <p className="mt-2 text-xs text-muted-foreground">{stats.standalone} avulsas</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Autorizadas
              </p>
              <p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{stats.authorized}</p>
              <p className="mt-2 text-xs text-muted-foreground">documentos válidos</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Em andamento
              </p>
              <p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{stats.pending}</p>
              <p className="mt-2 text-xs text-muted-foreground">pendente ou processando</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-amber-300 to-amber-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Rejeitadas/Erro
              </p>
              <p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{stats.failed}</p>
              <p className="mt-2 text-xs text-muted-foreground">falha na emissão</p>
            </div>
            <div className="rounded-full bg-rose-100 p-2 text-rose-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-rose-300 to-rose-500" />
        </div>
      </div>

      <form
        className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block"
        onSubmit={(event) => {
          event.preventDefault()
          handleSearchSubmit()
        }}
      >
        <div className="flex w-full flex-col items-stretch gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 xl:max-w-xl">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pedido, número NF, chave ou ID..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    handleSearchSubmit()
                  }
                }}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
              Buscar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
          <Select
            value={invoiceTypeFilter}
            onValueChange={(value) => {
              setInvoiceTypeFilter(value)
              navigateWithParams({ page: 1, invoiceType: value })
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              navigateWithParams({ page: 1, status: value })
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            disabled={!hasActiveFilter}
          >
            <FilterX className="h-4 w-4" />
          </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-medium">Legenda:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              Autorizada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              Pendente/Processando
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              Rejeitada/Erro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-300" />
              NF avulsa
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
              Pedido
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredInvoices.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card px-6 py-10 text-center text-muted-foreground shadow-sm">
            Nenhuma nota fiscal encontrada.
          </div>
        ) : (
          filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="overflow-hidden gap-0 border-border/60 py-0 shadow-sm">
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {invoice.invoiceType === "standalone" ? (
                      <Badge variant="violet" className="text-xs">
                        NF avulsa
                      </Badge>
                    ) : (
                      <div>
                        <p className="font-medium">{formatShortOrderId(invoice.orderId)}</p>
                        <Badge variant="sky" className="mt-1 text-xs">
                          Pedido
                        </Badge>
                      </div>
                    )}
                    <p className="mt-2 font-mono text-xs">{invoice.nfNumber || "Sem número NF"}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(invoice.status)} className="shrink-0">
                    {statusLabel(invoice.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(invoice.updatedAt)}</p>
                {renderInvoiceActions(invoice)}
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="hidden overflow-hidden rounded-xl border border-border/20 p-0 shadow-none md:block">
        {filteredInvoices.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Nenhuma nota fiscal encontrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Pedido / Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Número NF</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="odd:bg-background even:bg-muted/25 hover:bg-muted/40"
                >
                  <TableCell>
                    <span
                      className={`block h-2.5 w-2.5 rounded-full ${getStatusDotClassName(invoice.status)}`}
                    />
                  </TableCell>
                  <TableCell>
                    {invoice.invoiceType === "standalone" ? (
                      <Badge variant="violet" className="text-xs">
                        NF avulsa
                      </Badge>
                    ) : (
                      <div className="space-y-1">
                        <span className="font-medium">{formatShortOrderId(invoice.orderId)}</span>
                        <p className="text-xs text-muted-foreground">{invoice.orderId}</p>
                        <Badge variant="sky" className="text-xs">
                          Pedido
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>
                      {statusLabel(invoice.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{invoice.nfNumber || "-"}</TableCell>
                  <TableCell>{formatDateTime(invoice.updatedAt)}</TableCell>
                  <TableCell className="text-right">{renderInvoiceActions(invoice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {totalCount > 0 ? (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          showing={{
            start: pageStart,
            end: pageEnd,
            total: totalCount,
          }}
        />
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Nova NF avulsa — drawer lateral                                      */}
      {/* ------------------------------------------------------------------ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          className="w-full sm:w-[80vw] lg:w-[80vw] sm:max-w-none overflow-y-auto p-0 flex flex-col [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex-1 flex flex-col p-6 space-y-5">
            <SheetHeader className="p-0">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-base font-semibold">Emitir NF avulsa</SheetTitle>
                <SheetClose asChild>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>

            {formResult ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-emerald-700">
                  NF enviada para emissão. Status: <strong>{formResult.status}</strong>
                  {formResult.nfNumber ? ` — Número: ${formResult.nfNumber}` : ""}
                </p>
                {formResult.errorMessage && (
                  <p className="text-sm text-rose-600">{formResult.errorMessage}</p>
                )}
                <div className="flex gap-2">
                  {formResult.pdfUrl && (
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                      <Link href={buildInvoiceProxyHref(formResult, "pdf") || "#"} target="_blank" rel="noopener noreferrer">
                        PDF
                      </Link>
                    </Button>
                  )}
                  {formResult.xmlUrl && (
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                      <Link href={buildInvoiceProxyHref(formResult, "xml") || "#"} target="_blank" rel="noopener noreferrer">
                        XML
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="cursor-pointer" onClick={openDialog}>
                    Emitir outra
                  </Button>
                  <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setSheetOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Natureza de operação */}
                <div className="space-y-1.5">
                  <Label>Natureza de operação *</Label>
                  <Select
                    value={form.operation_nature_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, operation_nature_id: v }))}
                    disabled={natures.length === 0}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder={natures.length === 0 ? "Nenhuma natureza cadastrada" : "Selecione..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {natures.map((n) => (
                        <SelectItem key={n.id} value={String(n.id)} className="cursor-pointer">
                          {n.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {natures.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Nenhuma natureza de operação cadastrada. Acesse{" "}
                      <a href="/settings/fiscal" className="underline font-medium" target="_blank" rel="noreferrer">
                        Configurações → Fiscal
                      </a>{" "}
                      para cadastrar.
                    </p>
                  )}
                </div>

                {/* Destinatário */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Destinatário</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Nome / Razão social *</Label>
                      <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>CNPJ</Label>
                      <Input placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>CPF</Label>
                      <Input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>E-mail</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Telefone</Label>
                      <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>CEP *</Label>
                      <Input placeholder="00000-000" value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Logradouro *</Label>
                      <Input value={form.street} onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Número *</Label>
                      <Input value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Complemento</Label>
                      <Input value={form.complement} onChange={(e) => setForm((p) => ({ ...p, complement: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Bairro *</Label>
                      <Input value={form.district} onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Cidade *</Label>
                      <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>UF *</Label>
                      <Input maxLength={2} value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Cód. IBGE cidade</Label>
                      <Input value={form.city_code} onChange={(e) => setForm((p) => ({ ...p, city_code: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Itens */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Itens</p>
                    <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={addItem}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Adicionar item
                    </Button>
                  </div>
                  {form.items.map((item, index) => (
                    <div key={index} className="rounded-lg border border-border/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Item {index + 1}</p>
                        {form.items.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => removeItem(index)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label>Descrição *</Label>
                          <Input value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-5">
                          <div className="space-y-1">
                            <Label>NCM *</Label>
                            <Input placeholder="00000000" value={item.ncm} onChange={(e) => updateItem(index, "ncm", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>CFOP</Label>
                            <Input placeholder="ex: 5102" value={item.cfop ?? ""} onChange={(e) => updateItem(index, "cfop", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Unidade</Label>
                            <Input placeholder="UN" value={item.unit ?? ""} onChange={(e) => updateItem(index, "unit", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Quantidade *</Label>
                            <IntegerInput
                              min={1}
                              value={item.quantity}
                              onChange={(value) => updateItem(index, "quantity", value ?? 0)}
                              inputClassName="text-left"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Preço unitário *</Label>
                            <CurrencyInput
                              value={item.unit_price}
                              onChange={(value) => updateItem(index, "unit_price", value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Observação */}
                <div className="space-y-1.5">
                  <Label>Observação</Label>
                  <Textarea
                    rows={2}
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  />
                </div>

                {formError && (
                  <p className="text-sm text-rose-600">{formError}</p>
                )}
              </>
            )}
          </div>

          {!formResult && (
            <div className="sticky bottom-0 bg-background border-t p-4 flex justify-end gap-2">
              <Button variant="outline" className="cursor-pointer" onClick={() => setSheetOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button className="cursor-pointer" onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Emitindo..." : "Emitir NF"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
