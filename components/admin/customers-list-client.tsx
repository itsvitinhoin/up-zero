'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  approveCustomerAction,
  approveClientAction,
  deleteCustomerAction,
  markCustomerWhatsappContactAction,
  rejectCustomerAction,
  rejectClientAction,
} from '@/lib/actions/customers'
import { Customer } from '@/lib/types'
import { NewCustomerDialog } from '@/components/admin/new-customer-dialog'
import { useCommercialData } from '@/hooks/use-commercial-data'
import { formatCNPJorCPF, formatPhoneNumber } from '@/lib/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import DatePeriodFilter from '@/components/admin/date-period-filter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card } from '@/components/ui/card'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { usePaginationMeta } from '@/hooks/use-paginated-list'
import { MoreHorizontal, Eye, Loader2, AlertCircle, CheckCircle, XCircle, Users, Plus, Pencil, Trash2, MessageCircle, Copy, Check, Mail, Phone, GitBranch, Factory, Store, SlidersHorizontal, Search, Download, FilterX, ArrowUpRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useAdminStore } from '@/contexts/admin-store-context'

const statusMap: Record<string, { label: string }> = {
  PENDING: { label: 'Pendente' },
  APPROVED: { label: 'Aprovado' },
  REJECTED: { label: 'Recusado' },
}

const statusBadgeVariant: Record<string, 'amber' | 'emerald' | 'rose' | 'slate'> = {
  PENDING: 'amber',
  APPROVED: 'emerald',
  REJECTED: 'rose',
}

const statusIconMap = {
  PENDING: AlertCircle,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
} as const

const customerTypeMap: Record<string, string> = {
  RETAIL: 'Varejo',
  WHOLESALE: 'Atacado',
}

const customerTypeBadgeVariant: Record<string, 'outline' | 'sky' | 'violet'> = {
  RETAIL: 'sky',
  WHOLESALE: 'violet',
}

const CUSTOMER_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function parseCustomerPageLimit(value?: string | number | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return CUSTOMER_PAGE_SIZE_OPTIONS.includes(parsed as (typeof CUSTOMER_PAGE_SIZE_OPTIONS)[number]) ? parsed : 20
}

export function CustomersListClient({
  initialCustomers,
  initialPagination,
  initialSummary,
  customerOrderSummary,
  initialSearch,
  initialStatus,
  initialType,
  initialFromDate = '',
  initialToDate = '',
  initialSellerId = 'all',
}: {
  initialCustomers: Customer[]
  initialPagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  initialSummary: {
    total: number
    approved: number
    pending: number
    rejected: number
    wholesale: number
    retail: number
  }
  customerOrderSummary: Record<string, { ordersCount: number; totalSpent: number }>
  initialSearch: string
  initialStatus: string
  initialType: string
  initialFromDate?: string
  initialToDate?: string
  initialSellerId?: string
}) {
  const { session } = useAdminStore()
  const router = useRouter()
  const pathname = usePathname()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [allCustomers, setAllCustomers] = useState<Customer[]>(initialCustomers)
  const [pagination, setPagination] = useState(initialPagination)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [sellerFilter, setSellerFilter] = useState(initialSellerId)
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)
  const [selectedLimit, setSelectedLimit] = useState<number>(parseCustomerPageLimit(initialPagination.limit))
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const { priceTables, sellers } = useCommercialData()
  const customers = useMemo(() => allCustomers, [allCustomers])
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
  const hasPermissionContext = Array.isArray(session?.permissionCodes)
  const canCreateCustomer = !hasPermissionContext || permissionSet.has('customers.create')
  const canEditCustomer = !hasPermissionContext || permissionSet.has('customers.edit')
  const canDeleteCustomer = !hasPermissionContext || permissionSet.has('customers.delete')
  const canExportReports = !hasPermissionContext || permissionSet.has('reports.export')
  const hasActiveFilter = searchInput.trim().length > 0
    || statusFilter !== 'all'
    || typeFilter !== 'all'
    || sellerFilter !== 'all'
    || fromDate.length > 0
    || toDate.length > 0
  const hasAppliedFilter = initialSearch.trim().length > 0
    || initialStatus !== 'all'
    || initialType !== 'all'
    || initialSellerId !== 'all'
    || initialFromDate.length > 0
    || initialToDate.length > 0

  const pageSize = Math.max(1, Number(pagination.limit) || 20)
  const totalItems = Math.max(0, Number(pagination.total) || 0)
  const currentPage = Math.max(1, Number(pagination.page) || 1)
  const totalPages = Math.max(
    1,
    Number(pagination.totalPages) || Math.ceil(totalItems / pageSize),
  )

  const {
    safeCurrentPage,
    pageStart,
    pageEnd,
  } = usePaginationMeta({
    currentPage,
    pageSize,
    totalItems,
    currentPageItemCount: customers.length,
  })
  const paginatedCustomers = customers
  const stats = initialSummary

  const handleDatePeriodChange = (nextFromDate: string, nextToDate: string) => {
    setFromDate(nextFromDate)
    setToDate(nextToDate)
    applyBackendFilters(searchInput, statusFilter, typeFilter, sellerFilter, nextFromDate, nextToDate)
  }

  const buildCustomersQuery = (
    nextSearch: string,
    nextStatus: string,
    nextType: string,
    nextSeller: string,
    nextPage: number,
    nextFrom?: string,
    nextTo?: string,
    nextLimit?: number,
  ) => {
    const params = new URLSearchParams()
    const normalizedSearch = nextSearch.trim()
    const normalizedStatus = nextStatus.trim().toUpperCase()
    const normalizedType = nextType.trim().toUpperCase()
    const normalizedSeller = nextSeller.trim()
    const resolvedLimit = parseCustomerPageLimit(nextLimit ?? selectedLimit)

    if (normalizedSearch.length > 0) {
      params.set('q', normalizedSearch)
    }

    if (normalizedStatus && normalizedStatus !== 'ALL') {
      params.set('status', normalizedStatus)
    }

    if (normalizedType && normalizedType !== 'ALL') {
      params.set('type', normalizedType)
    }

    if (normalizedSeller && normalizedSeller !== 'all') {
      params.set('seller', normalizedSeller)
    }

    const resolvedFrom = nextFrom ?? fromDate
    const resolvedTo = nextTo ?? toDate
    if (resolvedFrom) params.set('from', resolvedFrom)
    if (resolvedTo) params.set('to', resolvedTo)
    if (!resolvedFrom && !resolvedTo) {
      params.set('period', 'all')
    }

    if (resolvedLimit !== 20) {
      params.set('limit', String(resolvedLimit))
    }

    if (nextPage > 1) {
      params.set('page', String(nextPage))
    }

    return params.toString()
  }

  const goToPage = (page: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, page))
    const query = buildCustomersQuery(
      initialSearch,
      initialStatus,
      initialType,
      initialSellerId,
      nextPage,
      initialFromDate,
      initialToDate,
      selectedLimit,
    )
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  useEffect(() => {
    setAllCustomers(initialCustomers)
  }, [initialCustomers])

  useEffect(() => {
    setPagination(initialPagination)
    setSelectedLimit(parseCustomerPageLimit(initialPagination.limit))
  }, [initialPagination])

  useEffect(() => {
    setSearchInput(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setStatusFilter(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    setTypeFilter(initialType)
  }, [initialType])

  useEffect(() => {
    setSellerFilter(initialSellerId)
  }, [initialSellerId])

  useEffect(() => {
    setFromDate(initialFromDate)
  }, [initialFromDate])

  useEffect(() => {
    setToDate(initialToDate)
  }, [initialToDate])

  const clearFilters = () => {
    setSearchInput('')
    setStatusFilter('all')
    setTypeFilter('all')
    setSellerFilter('all')
    setFromDate('')
    setToDate('')
    setMobileFiltersOpen(false)
    const query = buildCustomersQuery('', 'all', 'all', 'all', 1, '', '', selectedLimit)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const applyBackendFilters = (
    nextSearch: string,
    nextStatus: string,
    nextType: string,
    nextSeller: string,
    nextFrom?: string,
    nextTo?: string,
    nextLimit?: number,
  ) => {
    const query = buildCustomersQuery(nextSearch, nextStatus, nextType, nextSeller, 1, nextFrom, nextTo, nextLimit)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const applyPageLimit = (nextLimit: number) => {
    setSelectedLimit(nextLimit)
    applyBackendFilters(searchInput, statusFilter, typeFilter, sellerFilter, fromDate, toDate, nextLimit)
  }

  const handleSearchSubmit = () => {
    applyBackendFilters(searchInput, statusFilter, typeFilter, sellerFilter, fromDate, toDate)
  }

  const buildExportUrl = () => {
    const params = new URLSearchParams()
    if (initialSearch.trim()) params.set('q', initialSearch.trim())
    if (initialStatus && initialStatus !== 'all') params.set('status', initialStatus)
    if (initialType && initialType !== 'all') params.set('type', initialType)
    if (initialSellerId && initialSellerId !== 'all') {
      if (initialSellerId === 'none') {
        params.set('seller', 'none')
      } else {
        params.set('assigned_seller_id', initialSellerId)
      }
    }
    if (initialFromDate) params.set('from', initialFromDate)
    if (initialToDate) params.set('to', initialToDate)
    return `/api/customers/export${params.toString() ? `?${params.toString()}` : ''}`
  }

  const handleExportCustomers = () => {
    if (!canExportReports) {
      setError('Você não tem permissão para exportar relatórios')
      return
    }

    window.location.href = buildExportUrl()
  }

  const formatCurrencyBRL = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    })
  }

  const formatWhatsappPhone = (phone: string): string | null => {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return null
    if (digits.length < 10) return null
    return digits.startsWith('55') ? digits : `55${digits}`
  }

  const buildWhatsappUrl = (customer: Customer): string | null => {
    const normalizedPhone = formatWhatsappPhone(customer.phone || '')
    if (!normalizedPhone) return null
    const targetName = customer.contactName || customer.companyName || customer.email
    const message = `Olá ${targetName}, tudo bem?`
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
  }

  const openWhatsappConversation = (customer: Customer) => {
    const whatsappUrl = buildWhatsappUrl(customer)
    if (!whatsappUrl) {
      setError('Telefone inválido para abrir WhatsApp')
      return
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  const handleSendWhatsapp = async (customer: Customer) => {
    const whatsappUrl = buildWhatsappUrl(customer)
    if (!whatsappUrl) {
      setError('Telefone inválido para abrir WhatsApp')
      return
    }

    setActioningId(`whatsapp-${customer.id}`)

    try {
      const result = await markCustomerWhatsappContactAction(customer.id)
      if (result.success) {
        const whatsappContactedAt = result.data?.whatsappContactedAt || new Date().toISOString()
        setAllCustomers((current) =>
          current.map((entry) =>
            entry.id === customer.id
              ? {
                  ...entry,
                  whatsappContacted: true,
                  whatsappContactedAt,
                }
              : entry,
          ),
        )
        router.refresh()
        setError(null)
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      } else {
        setError(result.error || 'Erro ao registrar contato por WhatsApp')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao registrar contato por WhatsApp')
    } finally {
      setActioningId(null)
    }
  }

  const formatContactDate = (value: string | null | undefined): string => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('pt-BR')
  }

  const copyTextWithFeedback = async (value: string, key: string) => {
    const normalized = String(value || '').trim()
    if (!normalized) {
      setError('Não há valor para copiar')
      return
    }

    try {
      await navigator.clipboard.writeText(normalized)
      setCopiedKey(key)
      setError(null)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 1400)
    } catch {
      setError('Não foi possível copiar para a área de transferência')
    }
  }

  const handleApprove = async (id: string) => {
    if (!canEditCustomer) {
      setError('Você não tem permissão para editar clientes')
      return
    }

    const target = allCustomers.find((customer) => customer.id === id)
    setActioningId(`approve-${id}`)
    startTransition(async () => {
      const action = target?.customerType === 'RETAIL' ? approveClientAction : approveCustomerAction
      const result = await action(id)
      if (result.success) {
        setAllCustomers((current) =>
          current.map((customer) =>
            customer.id === id ? { ...customer, status: 'APPROVED' } : customer,
          ),
        )
        setError(null)
        router.refresh()
      } else {
        setError(result.error || 'Erro ao aprovar cliente')
      }
      setActioningId(null)
    })
  }

  const handleReject = async (id: string) => {
    if (!canEditCustomer) {
      setError('Você não tem permissão para editar clientes')
      return
    }

    const target = allCustomers.find((customer) => customer.id === id)
    setActioningId(`reject-${id}`)
    startTransition(async () => {
      const action = target?.customerType === 'RETAIL' ? rejectClientAction : rejectCustomerAction
      const result = await action(id)
      if (result.success) {
        setAllCustomers((current) =>
          current.map((customer) =>
            customer.id === id ? { ...customer, status: 'REJECTED' } : customer,
          ),
        )
        setError(null)
        router.refresh()
      } else {
        setError(result.error || 'Erro ao rejeitar cliente')
      }
      setActioningId(null)
    })
  }

  const openEditCustomerDialog = (customer: Customer) => {
    if (!canEditCustomer) {
      setError('Você não tem permissão para editar clientes')
      return
    }

    setEditingCustomer(customer)
    setShowEditDialog(true)
  }

  const handleDelete = async (customer: Customer) => {
    if (!canDeleteCustomer) {
      setError('Você não tem permissão para excluir clientes')
      return
    }

    setActioningId(`delete-${customer.id}`)
    startTransition(async () => {
      const result = await deleteCustomerAction(customer.id)
      if (result.success) {
        setAllCustomers((current) => current.filter((entry) => entry.id !== customer.id))
        setError(null)
        router.refresh()
      } else {
        setError(result.error || 'Erro ao remover cliente')
      }
      setCustomerToDelete(null)
      setActioningId(null)
    })
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Relacionamento
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <Users className="h-6 w-6 text-primary" />
              Lista de Clientes
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {hasAppliedFilter ? `${totalItems} clientes encontrados com os filtros atuais.` : `${totalItems} clientes cadastrados na base.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExportReports ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-full px-4"
                onClick={handleExportCustomers}
                aria-label="Exportar Excel"
                title="Exportar Excel"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline sm:ml-2">Exportar Excel</span>
              </Button>
            ) : null}
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
            {canCreateCustomer ? (
              <Button
                size="sm"
                className="h-10 gap-2 rounded-full px-5"
                onClick={() => setShowAddDialog(true)}
                aria-label="Novo Cliente"
                title="Novo Cliente"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Cliente</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de clientes no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, empresa, e-mail ou CNPJ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchSubmit()
                  }
                }}
                className="h-10 rounded-full pl-10 pr-24"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-1 top-1/2 h-8 -translate-y-1/2 rounded-full"
                onClick={handleSearchSubmit}
              >
                Buscar
              </Button>
            </div>

            <Select
              value={statusFilter}
              onValueChange={(nextStatus) => {
                setStatusFilter(nextStatus)
                applyBackendFilters(searchInput, nextStatus, typeFilter, sellerFilter, fromDate, toDate)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="APPROVED">Aprovado</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="REJECTED">Recusado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(nextType) => {
                setTypeFilter(nextType)
                applyBackendFilters(searchInput, statusFilter, nextType, sellerFilter, fromDate, toDate)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="WHOLESALE">Atacado</SelectItem>
                <SelectItem value="RETAIL">Varejo</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sellerFilter}
              onValueChange={(nextSeller) => {
                setSellerFilter(nextSeller)
                applyBackendFilters(searchInput, statusFilter, typeFilter, nextSeller, fromDate, toDate)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos vendedores</SelectItem>
                <SelectItem value="none">Sem vendedora</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={String(seller.id)}>
                    {seller.name || seller.email || `Vendedor #${seller.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePeriodFilter
              fromDate={fromDate}
              toDate={toDate}
              onChange={handleDatePeriodChange}
            />

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
              disabled={!hasActiveFilter}
            >
              <FilterX className="h-4 w-4" />
            </Button>

            <p className="text-xs text-muted-foreground">Digite e toque em Buscar para aplicar o filtro.</p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" className="w-full cursor-pointer bg-black text-white hover:bg-black/90">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Clientes</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.total}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Aprovados</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.approved}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Pendentes</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.pending}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-amber-300 to-amber-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Recusados</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.rejected}</p>
            </div>
            <div className="rounded-full bg-rose-100 p-2 text-rose-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-rose-300 to-rose-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Atacado</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.wholesale}</p>
            </div>
            <div className="rounded-full bg-violet-100 p-2 text-violet-700">
              <Factory className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-violet-300 to-violet-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Varejo</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.retail}</p>
            </div>
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
        </div>
      </div>

      <form
        className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block"
        onSubmit={(e) => {
          e.preventDefault()
          handleSearchSubmit()
        }}
      >
        <div className="flex w-full flex-col items-stretch gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 xl:max-w-xl">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou CNPJ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
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
            value={statusFilter}
            onValueChange={(nextStatus) => {
              setStatusFilter(nextStatus)
              applyBackendFilters(searchInput, nextStatus, typeFilter, sellerFilter, fromDate, toDate)
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="APPROVED">Aprovado</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="REJECTED">Recusado</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(nextType) => {
              setTypeFilter(nextType)
              applyBackendFilters(searchInput, statusFilter, nextType, sellerFilter, fromDate, toDate)
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-36">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="WHOLESALE">Atacado</SelectItem>
              <SelectItem value="RETAIL">Varejo</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sellerFilter}
            onValueChange={(nextSeller) => {
              setSellerFilter(nextSeller)
              applyBackendFilters(searchInput, statusFilter, typeFilter, nextSeller, fromDate, toDate)
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos vendedores</SelectItem>
              <SelectItem value="none">Sem vendedora</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.id} value={String(seller.id)}>
                  {seller.name || seller.email || `Vendedor #${seller.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DatePeriodFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={handleDatePeriodChange}
          />

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
            disabled={!hasActiveFilter}
          >
            <FilterX className="h-4 w-4" />
          </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-medium">Status do Cliente:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Aprovado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />Pendente</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" />Recusado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-300" />Atacado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" />Varejo</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 md:hidden">
        {customers.length === 0 ? (
          <div className="rounded-xl border border-border/20 bg-card px-6 py-10 text-center text-muted-foreground">
            Nenhum cliente encontrado
          </div>
        ) : (
          <>
            {paginatedCustomers.map((customer) => {
              const summary = customerOrderSummary[customer.id] || {
                ordersCount: 0,
                totalSpent: 0,
              }
              const identificationName = customer.contactName || customer.companyName || '-'
              const identificationDocument = formatCNPJorCPF(customer.cnpj)
              const isPendingCustomer = customer.status === 'PENDING'
              const isApprovingThis = actioningId === `approve-${customer.id}`
              const isRejectingThis = actioningId === `reject-${customer.id}`

              return (
                <div key={customer.id} className="w-full">
                  <Card className="overflow-hidden gap-0 py-0 border-border/60 bg-card/95 shadow-sm">
                    <div
                      className="cursor-pointer space-y-3 p-4 transition-colors hover:bg-muted/30"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">{identificationName}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{identificationDocument}</p>
                        </div>
                        <Badge variant={statusBadgeVariant[customer.status] || 'slate'} className="mt-0.5 shrink-0">
                          {statusMap[customer.status]?.label}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{customer.email || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatPhoneNumber(customer.phone || '') || '-'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-0.5">
                        {customer.cnae && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Factory className="h-3 w-3 shrink-0" />
                            <span className="font-medium">{customer.cnae}</span>
                            {customer.cnaeDescription && (
                              <span className="max-w-35 truncate">{customer.cnaeDescription}</span>
                            )}
                          </div>
                        )}
                        {customer.registrationOrigin && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Store className="h-3 w-3 shrink-0" />
                            <span className="capitalize">{customer.registrationOrigin}</span>
                          </div>
                        )}
                        {customer.branchSlug && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GitBranch className="h-3 w-3 shrink-0" />
                            <span>{customer.branchSlug}</span>
                          </div>
                        )}
                      </div>

                    </div>

                    {isPendingCustomer && canEditCustomer && (
                      <div className="grid grid-cols-2 border-t border-border/50">
                        <button
                          type="button"
                          onClick={() => handleApprove(customer.id)}
                          disabled={isPending || isApprovingThis || isRejectingThis}
                          className="flex h-14 items-center justify-center gap-2 border-r border-border/50 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {isApprovingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-5 w-5" />
                          )}
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(customer.id)}
                          disabled={isPending || isApprovingThis || isRejectingThis}
                          className="flex h-14 items-center justify-center gap-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                        >
                          {isRejectingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                          Rejeitar
                        </button>
                      </div>
                    )}

                    {customer.phone && (
                      <button
                        type="button"
                        onClick={() => openWhatsappConversation(customer)}
                        className="flex h-12 w-full items-center justify-center gap-2 border-t border-border/50 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </button>
                    )}
                  </Card>
                </div>
              )
            })}

            <AdminPaginationControls
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              showing={{
                start: pageStart,
                end: pageEnd,
                total: totalItems,
              }}
            />
          </>
        )}
      </div>

      {/* Table */}
      <Card className="hidden rounded-xl border border-border/20 shadow-none overflow-hidden p-0 md:block">
        {customers.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Nenhum cliente encontrado
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Total em Compras</TableHead>
                  <TableHead>Vendedora</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => {
                  const summary = customerOrderSummary[customer.id] || {
                    ordersCount: 0,
                    totalSpent: 0,
                  }
                  const identificationName = customer.contactName || customer.companyName || '-'
                  const identificationDocument = formatCNPJorCPF(customer.cnpj)
                  const StatusIcon = statusIconMap[customer.status as keyof typeof statusIconMap] || AlertCircle

                  return (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer odd:bg-background even:bg-muted/25 hover:bg-muted/40"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                    <TableCell>
                      <span
                        className={`block h-2.5 w-2.5 rounded-full ${
                          customer.status === 'APPROVED'
                            ? 'bg-emerald-500'
                            : customer.status === 'PENDING'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {/* <span className="text-xs text-muted-foreground">status</span> */}
                          <Badge
                            variant={statusBadgeVariant[customer.status] || 'slate'}
                            className="text-xs"
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusMap[customer.status]?.label || '-'}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground mt-2 ml-1">
                          {customer.createdAt
                            ? `${new Date(customer.createdAt).toLocaleDateString('pt-BR')} ${new Date(customer.createdAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-18 text-xs text-muted-foreground">nome:</span>
                          <span className="text-sm">{identificationName}</span>
                          {copiedKey === `name-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                copyTextWithFeedback(identificationName, `name-${customer.id}`)
                              }}
                              title="Copiar nome"
                              aria-label="Copiar nome"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-18 text-xs text-muted-foreground">CNPJ/CPF:</span>
                          <span className="text-xs">{identificationDocument || '-'}</span>
                          {copiedKey === `document-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                copyTextWithFeedback(customer.cnpj || '', `document-${customer.id}`)
                              }}
                              title="Copiar CNPJ/CPF"
                              aria-label="Copiar CNPJ ou CPF"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={customerTypeBadgeVariant[customer.customerType || 'WHOLESALE'] || 'outline'} className="text-xs font-medium">
                        {customerTypeMap[customer.customerType || 'WHOLESALE']}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-15 text-xs text-muted-foreground">telefone:</span>
                          <span className="text-sm">{formatPhoneNumber(customer.phone || '') || '-'}</span>
                          {copiedKey === `phone-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                copyTextWithFeedback(customer.phone || '', `phone-${customer.id}`)
                              }}
                              title="Copiar telefone"
                              aria-label="Copiar telefone"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-15 text-xs text-muted-foreground">e-mail:</span>
                          <span className="text-xs">{customer.email || '-'}</span>
                          {copiedKey === `email-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                copyTextWithFeedback(customer.email || '', `email-${customer.id}`)
                              }}
                              title="Copiar e-mail"
                              aria-label="Copiar e-mail"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.state || '-'}</TableCell>
                    <TableCell>{summary.ordersCount}</TableCell>
                    <TableCell>{formatCurrencyBRL(summary.totalSpent)}</TableCell>
                    <TableCell>
                      {customer.assignedSellerName ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {customer.assignedSellerName
                              .split(' ')
                              .slice(0, 2)
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="text-sm">{customer.assignedSellerName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="cursor-pointer">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/customers/${customer.id}`)}
                            className="cursor-pointer"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openWhatsappConversation(customer)} className="cursor-pointer">
                            <MessageCircle className="w-4 h-4 mr-2 text-emerald-600" />
                            WhatsApp
                          </DropdownMenuItem>
                          {canEditCustomer ? (
                            <DropdownMenuItem onClick={() => openEditCustomerDialog(customer)} className="cursor-pointer">
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          ) : null}
                          {canEditCustomer ? (
                            <DropdownMenuItem
                              onClick={() => handleApprove(customer.id)}
                              disabled={isPending || actioningId === `approve-${customer.id}`}
                              className="cursor-pointer"
                            >
                              {actioningId === `approve-${customer.id}` ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                              )}
                              Aprovar
                            </DropdownMenuItem>
                          ) : null}
                          {canEditCustomer ? (
                            <DropdownMenuItem
                              onClick={() => handleReject(customer.id)}
                              disabled={isPending || actioningId === `reject-${customer.id}`}
                              className="cursor-pointer"
                            >
                              {actioningId === `reject-${customer.id}` ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-2" />
                              )}
                              Rejeitar
                            </DropdownMenuItem>
                          ) : null}
                          {canDeleteCustomer ? (
                            <DropdownMenuItem
                              onClick={() => setCustomerToDelete(customer)}
                              disabled={isPending || actioningId === `delete-${customer.id}`}
                              className="cursor-pointer text-rose-600 focus:text-rose-600"
                            >
                              {actioningId === `delete-${customer.id}` ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                              )}
                              Remover
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="border-t border-border/20 p-3">
              <AdminPaginationControls
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                showing={{
                  start: pageStart,
                  end: pageEnd,
                  total: totalItems,
                }}
              />
            </div>
          </>
        )}
      </Card>
      {canCreateCustomer ? (
        <NewCustomerDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          priceTables={priceTables}
          sellers={sellers}
          onCreated={(id) => {
            setShowAddDialog(false)
            router.push(`/customers/${id}`)
          }}
        />
      ) : null}

      {canEditCustomer ? (
        <NewCustomerDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) {
              setEditingCustomer(null)
            }
          }}
          mode="edit"
          customer={editingCustomer}
          priceTables={priceTables}
          sellers={sellers}
          onUpdated={() => {
            setError(null)
            setShowEditDialog(false)
            setEditingCustomer(null)
            router.refresh()
          }}
        />
      ) : null}

      <AlertDialog open={Boolean(customerToDelete)} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              {customerToDelete
                ? `Tem certeza que deseja remover o cliente ${customerToDelete.contactName || customerToDelete.companyName || customerToDelete.email}?`
                : 'Tem certeza que deseja remover este cliente?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (customerToDelete) {
                  void handleDelete(customerToDelete)
                }
              }}
              disabled={isPending || !customerToDelete}
              className="cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
            >
              {customerToDelete && actioningId === `delete-${customerToDelete.id}` ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
