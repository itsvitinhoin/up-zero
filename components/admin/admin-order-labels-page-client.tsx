"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  FilterX,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import type { OrderLabel } from "@/lib/types"
import {
  createStandaloneLabelAction,
  type CreateStandaloneLabelRequest,
  deleteOrderLabelAction,
  getOrderLabelAction,
  regenerateStandaloneLabelAction,
  refreshStandaloneLabelAction,
} from "@/lib/actions/orders"
import AddressInput from "@/components/form/AddressInput"
import CpfCnpjInput from "@/components/form/CpfCnpjInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import AdminPaginationControls from "@/components/admin/admin-pagination-controls"
import { usePathname, useRouter } from "next/navigation"

interface AdminOrderLabelsPageClientProps {
  initialLabels: OrderLabel[]
  statsLabels?: OrderLabel[]
  currentPage?: number
  pageSize?: number
  totalCount?: number
  totalPages?: number
  initialSearch?: string
  initialStatus?: string
  initialLabelMode?: string
}

const LABEL_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function parseLabelPageLimit(value?: string | number | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return LABEL_PAGE_SIZE_OPTIONS.includes(parsed as (typeof LABEL_PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : 20
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "PROCESSING", label: "Processando" },
  { value: "ISSUED", label: "Emitida" },
  { value: "ERROR", label: "Erro" },
]

const LABEL_MODE_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "order", label: "Vinculada a pedido" },
  { value: "standalone", label: "Avulsa" },
]

function getStatusBadgeVariant(status: OrderLabel["status"]): "emerald" | "amber" | "rose" | "slate" {
  if (status === "ISSUED") return "emerald"
  if (status === "PROCESSING") return "amber"
  if (status === "ERROR") return "rose"
  return "slate"
}

function getStatusDotClassName(status: OrderLabel["status"]): string {
  if (status === "ISSUED") return "bg-emerald-400"
  if (status === "PROCESSING") return "bg-amber-400"
  if (status === "ERROR") return "bg-rose-400"
  return "bg-slate-400"
}

function statusLabel(status: OrderLabel["status"]): string {
  const found = STATUS_OPTIONS.find((entry) => entry.value === status)
  return found?.label || status
}

function formatDateTime(value: Date | string | null): string {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleString("pt-BR")
}

function formatShortId(value: string | null): string {
  const cleaned = String(value || "").trim()
  if (!cleaned) return "-"
  return cleaned.length > 8 ? cleaned.slice(0, 8).toUpperCase() : cleaned.toUpperCase()
}

function normalizeChaveNfe(value: string): string {
  return value.replace(/\s/g, "").replace(/\D/g, "")
}

function emptyForm() {
  return {
    chave_nfe: "",
    numero_nfe: "",
    order_id: "",
    recipient_name: "",
    recipient_document: "",
    shipping_zip_code: "",
    shipping_street: "",
    shipping_number: "",
    shipping_complement: "",
    shipping_neighborhood: "",
    shipping_city: "",
    shipping_state: "",
    weight_grams: "300",
  }
}

export default function AdminOrderLabelsPageClient({
  initialLabels,
  statsLabels,
  currentPage = 1,
  pageSize = 20,
  totalCount = 0,
  totalPages = 1,
  initialSearch = "",
  initialStatus = "all",
  initialLabelMode = "all",
}: AdminOrderLabelsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [labels, setLabels] = useState<OrderLabel[]>(initialLabels || [])
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [labelModeFilter, setLabelModeFilter] = useState(initialLabelMode)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [selectedLimit, setSelectedLimit] = useState<number>(parseLabelPageLimit(pageSize))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [formResult, setFormResult] = useState<OrderLabel | null>(null)
  const [isPending, startTransition] = useTransition()
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState("")
  const [labelToDelete, setLabelToDelete] = useState<OrderLabel | null>(null)
  const [isDeletingLabel, setIsDeletingLabel] = useState(false)
  const labelsRef = useRef(labels)
  const pollInFlightRef = useRef(false)
  labelsRef.current = labels

  useEffect(() => {
    setLabels(initialLabels || [])
  }, [initialLabels])

  useEffect(() => {
    setStatusFilter(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    setLabelModeFilter(initialLabelMode)
  }, [initialLabelMode])

  useEffect(() => {
    setSearchInput(initialSearch)
    setSearchTerm(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setSelectedLimit(parseLabelPageLimit(pageSize))
  }, [pageSize])

  function openErrorDialog(message: string) {
    setErrorDialogMessage(message)
    setErrorDialogOpen(true)
  }

  async function refreshLabelRow(label: OrderLabel, timeoutMs = 45_000) {
    if (label.labelMode !== "standalone" && !label.orderId) {
      return { success: false as const, error: "Etiqueta sem pedido vinculado." }
    }

    const request =
      label.labelMode === "standalone"
        ? refreshStandaloneLabelAction(label.id)
        : getOrderLabelAction(label.orderId!)

    return Promise.race([
      request,
      new Promise<{ success: false; error: string }>((resolve) => {
        window.setTimeout(
          () => resolve({ success: false, error: "Consulta expirou. Tente novamente em instantes." }),
          timeoutMs,
        )
      }),
    ])
  }

  const processingLabelIds = useMemo(
    () =>
      labels
        .filter((label) => label.status === "PROCESSING")
        .map((label) => label.id)
        .sort()
        .join(","),
    [labels],
  )

  useEffect(() => {
    if (!processingLabelIds) return

    const interval = window.setInterval(async () => {
      if (pollInFlightRef.current || rowActionId) return

      const pending = labelsRef.current.filter((label) => label.status === "PROCESSING")
      if (pending.length === 0) return

      pollInFlightRef.current = true
      try {
        for (const label of pending) {
          const result = await refreshLabelRow(label, 40_000)
          if (result.success && result.data) {
            setLabels((prev) =>
              prev.map((entry) => (entry.id === label.id ? result.data! : entry)),
            )
            setFormResult((prev) => (prev?.id === label.id ? result.data! : prev))
          }
        }
      } finally {
        pollInFlightRef.current = false
      }
    }, 10_000)

    return () => window.clearInterval(interval)
  }, [processingLabelIds, rowActionId])

  const statsSource = statsLabels || labels

  const stats = useMemo(
    () => ({
      total: totalCount,
      issued: statsSource.filter((label) => label.status === "ISSUED").length,
      processing: statsSource.filter((label) => label.status === "PROCESSING").length,
      error: statsSource.filter((label) => label.status === "ERROR").length,
      standalone: statsSource.filter((label) => label.labelMode === "standalone").length,
    }),
    [statsSource, totalCount],
  )

  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages))
  const pageStart = totalCount === 0 ? 0 : (safeCurrentPage - 1) * selectedLimit + 1
  const pageEnd =
    totalCount === 0 ? 0 : Math.min(totalCount, pageStart + Math.max(0, labels.length - 1))

  function buildLabelsQuery(input?: {
    page?: number
    limit?: number
    status?: string
    labelMode?: string
    search?: string
  }) {
    const params = new URLSearchParams()
    const nextPage = Math.max(1, Number(input?.page ?? safeCurrentPage) || 1)
    const nextLimit = parseLabelPageLimit(input?.limit ?? selectedLimit)
    const nextStatus = input?.status ?? statusFilter
    const nextLabelMode = input?.labelMode ?? labelModeFilter
    const nextSearch = (input?.search ?? searchTerm).trim()

    if (nextPage > 1) params.set("page", String(nextPage))
    if (nextLimit !== 20) params.set("limit", String(nextLimit))
    if (nextStatus !== "all") params.set("status", nextStatus)
    if (nextLabelMode !== "all") params.set("label_mode", nextLabelMode)
    if (nextSearch.length > 0) params.set("q", nextSearch)

    return params
  }

  function navigateWithParams(input?: {
    page?: number
    limit?: number
    status?: string
    labelMode?: string
    search?: string
  }) {
    const params = buildLabelsQuery(input)
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
    searchTerm.trim().length > 0 || statusFilter !== "all" || labelModeFilter !== "all"

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
    setLabelModeFilter("all")
    setMobileFiltersOpen(false)
    navigateWithParams({
      page: 1,
      search: "",
      status: "all",
      labelMode: "all",
      limit: selectedLimit,
    })
  }

  function openSheet() {
    setForm(emptyForm())
    setFormError(null)
    setFormResult(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    if (formResult) {
      router.refresh()
    }
  }

  function handleSubmitStandalone() {
    setFormError(null)
    setFormResult(null)

    const chave = normalizeChaveNfe(form.chave_nfe)
    if (chave.length !== 44) {
      setFormError("A chave NF-e deve ter 44 dígitos.")
      return
    }

    if (!form.recipient_name.trim()) {
      setFormError("Informe o nome do destinatário.")
      return
    }

    const payload: CreateStandaloneLabelRequest = {
      chave_nfe: chave,
      numero_nfe: form.numero_nfe.trim() || undefined,
      carrier: "Correios",
      order_id: form.order_id.trim() ? Number(form.order_id.trim()) : undefined,
      recipient_name: form.recipient_name.trim(),
      recipient_document: form.recipient_document.trim() || undefined,
      shipping_zip_code: form.shipping_zip_code.replace(/\D/g, ""),
      shipping_street: form.shipping_street.trim(),
      shipping_number: form.shipping_number.trim(),
      shipping_complement: form.shipping_complement.trim() || undefined,
      shipping_neighborhood: form.shipping_neighborhood.trim(),
      shipping_city: form.shipping_city.trim(),
      shipping_state: form.shipping_state.trim().toUpperCase(),
      weight_grams: Number(form.weight_grams) > 0 ? Number(form.weight_grams) : 300,
    }

    startTransition(async () => {
      const result = await createStandaloneLabelAction(payload)
      if (result.success && result.data) {
        setFormResult(result.data)
        setLabels((prev) => {
          const without = prev.filter((entry) => entry.id !== result.data!.id)
          return [result.data!, ...without]
        })
      } else {
        setFormError(result.error || "Erro ao gerar etiqueta avulsa.")
      }
    })
  }

  async function handleRefreshRow(label: OrderLabel) {
    setRowActionId(label.id)
    try {
      const result = await refreshLabelRow(label)
      if (result.success && result.data) {
        setLabels((prev) =>
          prev.map((entry) => (entry.id === label.id ? result.data! : entry)),
        )
      } else if (result.error) {
        openErrorDialog(result.error)
      }
    } finally {
      setRowActionId(null)
    }
  }

  async function handleRegenerateRow(label: OrderLabel) {
    setRowActionId(label.id)
    try {
      const result =
        label.labelMode === "standalone"
          ? await regenerateStandaloneLabelAction(label.id)
          : null

      if (result?.success && result.data) {
        setLabels((prev) =>
          prev.map((entry) => (entry.id === label.id ? result.data! : entry)),
        )
      } else if (result?.error) {
        openErrorDialog(result.error)
      }
    } finally {
      setRowActionId(null)
    }
  }

  async function handleDeleteLabel() {
    if (!labelToDelete) return

    setIsDeletingLabel(true)
    try {
      const result = await deleteOrderLabelAction(labelToDelete.id)
      if (result.success) {
        setLabels((prev) => prev.filter((entry) => entry.id !== labelToDelete.id))
        setLabelToDelete(null)
      } else if (result.error) {
        openErrorDialog(result.error)
      }
    } finally {
      setIsDeletingLabel(false)
    }
  }

  function renderLabelActions(label: OrderLabel) {
    return (
      <div className="flex justify-end gap-1">
        {label.pdfUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" asChild>
                <Link href={label.pdfUrl} target="_blank">
                  <FileText className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Baixar PDF da etiqueta</TooltipContent>
          </Tooltip>
        )}
        {label.status === "PROCESSING" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={rowActionId === label.id}
                onClick={() => handleRefreshRow(label)}
                aria-label="Consultar status da etiqueta nos Correios"
              >
                <RefreshCw
                  className={`h-4 w-4 ${rowActionId === label.id ? "animate-spin" : ""}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-64">
              {label.integrationReferenceId
                ? "Consulta os Correios para baixar o PDF quando estiver pronto."
                : "Retoma a emissão interrompida ou consulta o PDF nos Correios."}
            </TooltipContent>
          </Tooltip>
        )}
        {label.status === "ERROR" && label.labelMode === "standalone" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={rowActionId === label.id}
                onClick={() => handleRegenerateRow(label)}
                aria-label="Regenerar etiqueta avulsa"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-64">
              Tenta gerar a etiqueta novamente com os mesmos dados (somente após erro).
            </TooltipContent>
          </Tooltip>
        )}
        {label.status === "ISSUED" && label.labelMode === "standalone" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={rowActionId === label.id}
                onClick={() => handleRegenerateRow(label)}
                aria-label="Reimprimir PDF da etiqueta"
              >
                <RotateCcw
                  className={`h-4 w-4 ${rowActionId === label.id ? "animate-spin" : ""}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-64">
              Gera novamente o PDF no formato 100×150 mm para impressora térmica (mesmo rastreio).
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={rowActionId === label.id || isDeletingLabel}
              onClick={() => setLabelToDelete(label)}
              aria-label="Excluir etiqueta"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-64">
            Remove a etiqueta da listagem (não cancela a pré-postagem nos Correios).
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Erro</DialogTitle>
            <DialogDescription>{errorDialogMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setErrorDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(labelToDelete)}
        onOpenChange={(open) => !open && !isDeletingLabel && setLabelToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etiqueta?</AlertDialogTitle>
            <AlertDialogDescription>
              A etiqueta{" "}
              {labelToDelete?.trackingCode
                ? `com rastreio ${labelToDelete.trackingCode}`
                : `#${labelToDelete?.id ?? ""}`}{" "}
              será removida da listagem. Isso não cancela a pré-postagem nos Correios — apenas oculta
              o registro e permite emitir uma nova etiqueta para o mesmo pedido ou chave NF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLabel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteLabel()
              }}
              disabled={isDeletingLabel}
              className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeletingLabel ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Expedição
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              <Package className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              Etiquetas de Envio
            </h1>
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground sm:text-sm">
              {hasActiveFilter
                ? `${labels.length} etiquetas nesta página com os filtros atuais.`
                : `${stats.total} etiquetas registradas via Correios.`}{" "}
              Itens em <span className="font-medium text-foreground">Processando</span> são
              atualizados automaticamente enquanto esta página estiver aberta.
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
            <Button size="sm" className="h-10 gap-2 rounded-full px-4 sm:px-5" onClick={openSheet}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Etiqueta</span>
            </Button>
          </div>
        </div>
      </div>

      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de etiquetas no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rastreamento, chave NF ou pedido..."
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
              value={labelModeFilter}
              onValueChange={(value) => {
                setLabelModeFilter(value)
                navigateWithParams({ page: 1, labelMode: value })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {LABEL_MODE_OPTIONS.map((option) => (
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
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Emitidas
              </p>
              <p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{stats.issued}</p>
              <p className="mt-2 text-xs text-muted-foreground">PDF disponível</p>
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
                Processando
              </p>
              <p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{stats.processing}</p>
              <p className="mt-2 text-xs text-muted-foreground">aguardando PDF</p>
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
                Erro
              </p>
              <p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{stats.error}</p>
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
                placeholder="Rastreamento, chave NF ou pedido..."
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
            value={labelModeFilter}
            onValueChange={(value) => {
              setLabelModeFilter(value)
              navigateWithParams({ page: 1, labelMode: value })
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {LABEL_MODE_OPTIONS.map((option) => (
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
              Emitida
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              Processando
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              Erro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-300" />
              Avulsa
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
              Pedido
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {labels.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card px-6 py-10 text-center text-muted-foreground shadow-sm">
            Nenhuma etiqueta encontrada.
          </div>
        ) : (
          labels.map((label) => (
            <Card key={label.id} className="overflow-hidden gap-0 border-border/60 py-0 shadow-sm">
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">#{label.id}</p>
                    <Badge
                      variant={label.labelMode === "standalone" ? "violet" : "sky"}
                      className="mt-1 text-xs"
                    >
                      {label.labelMode === "standalone" ? "Avulsa" : "Pedido"}
                    </Badge>
                  </div>
                  <Badge variant={getStatusBadgeVariant(label.status)} className="shrink-0">
                    {statusLabel(label.status)}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-mono text-xs">{label.trackingCode || "Sem rastreio"}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(label.updatedAt)}</p>
                </div>
                {renderLabelActions(label)}
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="hidden overflow-hidden rounded-xl border border-border/20 p-0 shadow-none md:block">
        {labels.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Nenhuma etiqueta encontrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>ID / Tipo</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chave NF</TableHead>
                <TableHead>Rastreamento</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labels.map((label) => (
                <TableRow
                  key={label.id}
                  className="odd:bg-background even:bg-muted/25 hover:bg-muted/40"
                >
                  <TableCell>
                    <span
                      className={`block h-2.5 w-2.5 rounded-full ${getStatusDotClassName(label.status)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">#{label.id}</div>
                    <Badge
                      variant={label.labelMode === "standalone" ? "violet" : "sky"}
                      className="mt-1 text-xs"
                    >
                      {label.labelMode === "standalone" ? "Avulsa" : "Pedido"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {label.orderId ? (
                      <Link
                        href={`/orders/${label.orderId}`}
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        {formatShortId(label.orderId)}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(label.status)}>
                      {statusLabel(label.status)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-40 truncate font-mono text-xs"
                    title={label.chaveNfe || undefined}
                  >
                    {label.chaveNfe || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{label.trackingCode || "-"}</TableCell>
                  <TableCell>{formatDateTime(label.updatedAt)}</TableCell>
                  <TableCell className="text-right">{renderLabelActions(label)}</TableCell>
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

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="flex w-full flex-col overflow-y-auto p-0 sm:max-w-xl [&>button]:hidden">
          <div className="flex flex-1 flex-col space-y-5 p-6 pb-4">
            <SheetHeader className="space-y-0 p-0 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <SheetTitle className="text-base font-semibold">Gerar etiqueta avulsa</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    Informe a chave NF-e (44 dígitos) e o endereço de entrega.
                  </p>
                </div>
                <SheetClose asChild>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>

            {formResult ? (
              <div
                className={`space-y-3 rounded-lg border p-4 text-sm ${
                  formResult.status === "ISSUED"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p
                  className={`font-medium ${
                    formResult.status === "ISSUED" ? "text-emerald-800" : "text-amber-900"
                  }`}
                >
                  {formResult.status === "ISSUED"
                    ? "Etiqueta emitida com sucesso."
                    : "Etiqueta registrada nos Correios."}
                </p>
                <p>Status: {statusLabel(formResult.status)}</p>
                {formResult.status === "PROCESSING" && (
                  <p className="text-muted-foreground">
                    O PDF é gerado de forma assíncrona. A listagem consulta os Correios
                    automaticamente a cada poucos segundos — você pode fechar este painel.
                  </p>
                )}
                {formResult.trackingCode && (
                  <p className="font-mono">Rastreamento: {formResult.trackingCode}</p>
                )}
                {formResult.pdfUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={formResult.pdfUrl} target="_blank">
                      <FileText className="mr-2 h-4 w-4" />
                      Baixar PDF
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Nota fiscal</p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="standalone-chave-nfe">Chave NF-e *</Label>
                      <Input
                        id="standalone-chave-nfe"
                        value={form.chave_nfe}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            chave_nfe: normalizeChaveNfe(event.target.value).slice(0, 44),
                          }))
                        }
                        placeholder="44 dígitos"
                        inputMode="numeric"
                        autoComplete="off"
                        className="font-mono"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="min-w-0 space-y-1">
                        <Label htmlFor="standalone-numero-nfe">Número NF</Label>
                        <Input
                          id="standalone-numero-nfe"
                          value={form.numero_nfe}
                          onChange={(event) => setForm((prev) => ({ ...prev, numero_nfe: event.target.value }))}
                          autoComplete="off"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label htmlFor="standalone-order-id">Pedido (opcional)</Label>
                        <Input
                          id="standalone-order-id"
                          value={form.order_id}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              order_id: event.target.value.replace(/\D/g, ""),
                            }))
                          }
                          placeholder="ID do pedido"
                          inputMode="numeric"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Destinatário</p>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="standalone-recipient-name">Nome *</Label>
                      <Input
                        id="standalone-recipient-name"
                        value={form.recipient_name}
                        onChange={(event) => setForm((prev) => ({ ...prev, recipient_name: event.target.value }))}
                      />
                    </div>
                    <CpfCnpjInput
                      label="CPF/CNPJ"
                      value={form.recipient_document}
                      onChange={(value) => setForm((prev) => ({ ...prev, recipient_document: value }))}
                      fullWidth
                    />
                    <AddressInput
                      values={{
                        zip_code: form.shipping_zip_code,
                        street_name: form.shipping_street,
                        house_number: form.shipping_number,
                        address_complement: form.shipping_complement,
                        neighborhood: form.shipping_neighborhood,
                        city: form.shipping_city,
                        state: form.shipping_state,
                      }}
                      onChange={(field, value) => {
                        const fieldMap = {
                          zip_code: "shipping_zip_code",
                          street_name: "shipping_street",
                          house_number: "shipping_number",
                          address_complement: "shipping_complement",
                          neighborhood: "shipping_neighborhood",
                          city: "shipping_city",
                          state: "shipping_state",
                        } as const

                        setForm((prev) => ({
                          ...prev,
                          [fieldMap[field]]: value,
                        }))
                      }}
                      onBulkChange={(fields) => {
                        setForm((prev) => ({
                          ...prev,
                          ...(fields.zip_code !== undefined
                            ? { shipping_zip_code: fields.zip_code }
                            : {}),
                          ...(fields.street_name !== undefined
                            ? { shipping_street: fields.street_name }
                            : {}),
                          ...(fields.house_number !== undefined
                            ? { shipping_number: fields.house_number }
                            : {}),
                          ...(fields.address_complement !== undefined
                            ? { shipping_complement: fields.address_complement }
                            : {}),
                          ...(fields.neighborhood !== undefined
                            ? { shipping_neighborhood: fields.neighborhood }
                            : {}),
                          ...(fields.city !== undefined ? { shipping_city: fields.city } : {}),
                          ...(fields.state !== undefined ? { shipping_state: fields.state } : {}),
                        }))
                      }}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="min-w-0 space-y-1">
                        <Label htmlFor="standalone-weight-grams">Peso (g)</Label>
                        <Input
                          id="standalone-weight-grams"
                          value={form.weight_grams}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              weight_grams: event.target.value.replace(/\D/g, ""),
                            }))
                          }
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {formError && (
                  <p className="text-sm text-rose-600">{formError}</p>
                )}
              </>
            )}
          </div>

          {!formResult && (
            <div className="sticky bottom-0 flex shrink-0 items-center gap-2 border-t bg-background p-4">
              <Button onClick={handleSubmitStandalone} disabled={isPending}>
                {isPending ? "Gerando..." : "Gerar etiqueta"}
              </Button>
              <SheetClose asChild>
                <Button variant="outline">Cancelar</Button>
              </SheetClose>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
