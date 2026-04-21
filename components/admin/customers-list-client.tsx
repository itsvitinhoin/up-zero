'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { approveCustomerAction, deleteCustomerAction, rejectCustomerAction } from '@/lib/actions/customers'
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
import {
  AdminHero,
  AdminPage,
  AdminPanel,
  AdminStatCard,
  AdminStatGrid,
  AdminToolbar,
  DesktopOnly,
  MobileCardList,
} from '@/components/admin/admin-mobile-ui'
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
import { usePaginatedList } from '@/hooks/use-paginated-list'
import { MoreHorizontal, Eye, Loader2, AlertCircle, CheckCircle, XCircle, Users, Filter, Plus, Pencil, Trash2, Mail, Phone, GitBranch, Factory, Store, MessageCircle, Check } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DebouncedInput } from '@/components/form/DebouncedInput'
import { cn } from '@/lib/utils'

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

const customerTypeMap: Record<string, string> = {
  RETAIL: 'Varejo',
  WHOLESALE: 'Atacado',
}

// ─── Mock data — exibido quando o backend não retorna dados ──────────────────
const MOCK_CUSTOMERS_LIST: Customer[] = [
  { id: 'mock-cl1', companyName: 'Boutique Elegance LTDA', tradeName: 'Boutique Elegance', cnpj: '12345678000190', contactName: 'Ana Lima', phone: '11999887766', email: 'compras@elegance.com.br', state: 'SP', status: 'APPROVED', assignedSellerName: 'Maria Silva', customerType: 'WHOLESALE', createdAt: new Date('2024-03-15'), updatedAt: new Date() } as unknown as Customer,
  { id: 'mock-cl2', companyName: 'Moda Feminina SA', tradeName: 'Moda Feminina', cnpj: '98765432000110', contactName: 'Carla Santos', phone: '11988776655', email: 'pedidos@modafeminina.com.br', state: 'RJ', status: 'APPROVED', assignedSellerName: 'Ana Santos', customerType: 'WHOLESALE', createdAt: new Date('2024-05-20'), updatedAt: new Date() } as unknown as Customer,
  { id: 'mock-cl3', companyName: 'Casa da Moda ME', tradeName: 'Casa da Moda', cnpj: '45678901000123', contactName: 'Julia Ferreira', phone: '11977665544', email: 'vendas@casadamoda.com.br', state: 'MG', status: 'PENDING', assignedSellerName: null as unknown as string, customerType: 'RETAIL', createdAt: new Date('2024-07-10'), updatedAt: new Date() } as unknown as Customer,
  { id: 'mock-cl4', companyName: 'Style & Co LTDA', tradeName: 'Style & Co', cnpj: '78901234000156', contactName: 'Maria Souza', phone: '11966554433', email: 'compras@styleco.com.br', state: 'SP', status: 'APPROVED', assignedSellerName: 'Julia Costa', customerType: 'WHOLESALE', createdAt: new Date('2024-08-05'), updatedAt: new Date() } as unknown as Customer,
  { id: 'mock-cl5', companyName: 'Fashion Plus ME', tradeName: 'Fashion Plus', cnpj: '34567890000178', contactName: 'Paula Costa', phone: '11955443322', email: 'pedidos@fashionplus.com.br', state: 'PR', status: 'PENDING', assignedSellerName: null as unknown as string, customerType: 'WHOLESALE', createdAt: new Date('2024-09-20'), updatedAt: new Date() } as unknown as Customer,
  { id: 'mock-cl6', companyName: 'Luxo & Estilo LTDA', tradeName: 'Luxo & Estilo', cnpj: '56789012000134', contactName: 'Renata Oliveira', phone: '11944332211', email: 'vendas@luxoestilo.com.br', state: 'RS', status: 'APPROVED', assignedSellerName: 'Carla Lima', customerType: 'WHOLESALE', createdAt: new Date('2024-10-01'), updatedAt: new Date() } as unknown as Customer,
  { id: 'mock-cl7', companyName: 'Trend & More LTDA', tradeName: 'Trend & More', cnpj: '67890123000167', contactName: 'Gabriela Pinto', phone: '11933221100', email: 'compras@trendmore.com.br', state: 'SC', status: 'REJECTED', assignedSellerName: null as unknown as string, customerType: 'WHOLESALE', createdAt: new Date('2024-11-05'), updatedAt: new Date() } as unknown as Customer,
]

const MOCK_CUSTOMER_ORDER_SUMMARY: Record<string, { ordersCount: number; totalSpent: number }> = {
  'mock-cl1': { ordersCount: 12, totalSpent: 48750 },
  'mock-cl2': { ordersCount: 8, totalSpent: 32400 },
  'mock-cl3': { ordersCount: 3, totalSpent: 12800 },
  'mock-cl4': { ordersCount: 15, totalSpent: 67300 },
  'mock-cl5': { ordersCount: 0, totalSpent: 0 },
  'mock-cl6': { ordersCount: 6, totalSpent: 28900 },
  'mock-cl7': { ordersCount: 1, totalSpent: 3200 },
}

const MOCK_SUMMARY_DATA = { total: 7, pending: 2, approved: 4, rejected: 1 }
// ─────────────────────────────────────────────────────────────────────────────

export function CustomersListClient({
  initialCustomers,
  initialSummary,
  customerOrderSummary,
  initialSearch,
  initialStatus,
}: {
  initialCustomers: Customer[]
  initialSummary: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
  customerOrderSummary: Record<string, { ordersCount: number; totalSpent: number }>
  initialSearch: string
  initialStatus: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [allCustomers, setAllCustomers] = useState<Customer[]>(
    initialCustomers.length > 0 ? initialCustomers : MOCK_CUSTOMERS_LIST
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const effectiveSummary = initialCustomers.length > 0 ? initialSummary : MOCK_SUMMARY_DATA
  const effectiveOrderSummary = initialCustomers.length > 0 ? customerOrderSummary : MOCK_CUSTOMER_ORDER_SUMMARY
  const [summary, setSummary] = useState(effectiveSummary)
  const { priceTables, sellers } = useCommercialData()
  const customers = useMemo(() => allCustomers, [allCustomers])
  const [messagedCustomers, setMessagedCustomers] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('whatsapp_messaged_customers')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })

  useEffect(() => {
    try {
      localStorage.setItem('whatsapp_messaged_customers', JSON.stringify([...messagedCustomers]))
    } catch { /* noop */ }
  }, [messagedCustomers])

  const handleSendMessage = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`https://wa.me/55${customer.phone.replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer')
    setMessagedCustomers(prev => new Set([...prev, customer.id]))
  }
  const hasActiveFilter = searchInput.trim().length > 0 || statusFilter !== 'all'

  const stats = useMemo(
    () => ({
      total: Number(summary?.total ?? allCustomers.length),
      pending: Number(summary?.pending ?? allCustomers.filter((c) => c.status === 'PENDING').length),
      approved: Number(summary?.approved ?? allCustomers.filter((c) => c.status === 'APPROVED').length),
      rejected: Number(summary?.rejected ?? allCustomers.filter((c) => c.status === 'REJECTED').length),
    }),
    [summary, allCustomers],
  )

  const pageSize = 20
  const {
    totalItems,
    totalPages,
    safeCurrentPage,
    pageStart,
    pageEnd,
    paginatedItems: paginatedCustomers,
  } = usePaginatedList({
    items: customers,
    currentPage,
    pageSize,
  })

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)))
  }

  useEffect(() => {
    if (totalItems > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalItems, currentPage, totalPages])

  useEffect(() => {
    setAllCustomers(initialCustomers)
  }, [initialCustomers])

  useEffect(() => {
    setSummary(initialSummary)
  }, [initialSummary])

  useEffect(() => {
    setSearchInput(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setStatusFilter(initialStatus)
  }, [initialStatus])

  const clearFilters = () => {
    setSearchInput('')
    setStatusFilter('all')
    setCurrentPage(1)
    router.push(pathname)
  }

  const applyBackendFilters = (nextSearch: string, nextStatus: string) => {
    const params = new URLSearchParams()
    const normalizedSearch = nextSearch.trim()

    if (normalizedSearch.length > 0) {
      params.set('q', normalizedSearch)
    }

    if (nextStatus !== 'all') {
      params.set('status', nextStatus)
    }

    setCurrentPage(1)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const formatCurrencyBRL = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    })
  }

  const handleApprove = async (id: string) => {
    const before = allCustomers.find((customer) => customer.id === id)
    setActioningId(`approve-${id}`)
    startTransition(async () => {
      const result = await approveCustomerAction(id)
      if (result.success) {
        setAllCustomers((current) =>
          current.map((customer) =>
            customer.id === id ? { ...customer, status: 'APPROVED' } : customer,
          ),
        )
        setSummary((current) => {
          if (!current || !before) return current
          if (before.status === 'APPROVED') return current

          return {
            ...current,
            pending: before.status === 'PENDING' ? Math.max(0, current.pending - 1) : current.pending,
            rejected: before.status === 'REJECTED' ? Math.max(0, current.rejected - 1) : current.rejected,
            approved: current.approved + 1,
          }
        })
        setError(null)
      } else {
        setError(result.error || 'Erro ao aprovar cliente')
      }
      setActioningId(null)
    })
  }

  const handleReject = async (id: string) => {
    const before = allCustomers.find((customer) => customer.id === id)
    setActioningId(`reject-${id}`)
    startTransition(async () => {
      const result = await rejectCustomerAction(id)
      if (result.success) {
        setAllCustomers((current) =>
          current.map((customer) =>
            customer.id === id ? { ...customer, status: 'REJECTED' } : customer,
          ),
        )
        setSummary((current) => {
          if (!current || !before) return current
          if (before.status === 'REJECTED') return current

          return {
            ...current,
            pending: before.status === 'PENDING' ? Math.max(0, current.pending - 1) : current.pending,
            approved: before.status === 'APPROVED' ? Math.max(0, current.approved - 1) : current.approved,
            rejected: current.rejected + 1,
          }
        })
        setError(null)
      } else {
        setError(result.error || 'Erro ao rejeitar cliente')
      }
      setActioningId(null)
    })
  }

  const openEditCustomerDialog = (customer: Customer) => {
    setEditingCustomer(customer)
    setShowEditDialog(true)
  }

  const handleDelete = async (customer: Customer) => {
    setActioningId(`delete-${customer.id}`)
    startTransition(async () => {
      const result = await deleteCustomerAction(customer.id)
      if (result.success) {
        setAllCustomers((current) => current.filter((entry) => entry.id !== customer.id))
        setSummary((current) => {
          if (!current) return current

          return {
            total: Math.max(0, current.total - 1),
            pending: customer.status === 'PENDING' ? Math.max(0, current.pending - 1) : current.pending,
            approved: customer.status === 'APPROVED' ? Math.max(0, current.approved - 1) : current.approved,
            rejected: customer.status === 'REJECTED' ? Math.max(0, current.rejected - 1) : current.rejected,
          }
        })
        setError(null)
      } else {
        setError(result.error || 'Erro ao remover cliente')
      }
      setCustomerToDelete(null)
      setActioningId(null)
    })
  }

  return (
    <AdminPage>
      <AdminHero
        icon={Users}
        eyebrow="Clientes"
        title="Base de clientes"
        description={`${stats.total} clientes cadastrados e prontos para atendimento`}
        actions={
          <Button onClick={() => setShowAddDialog(true)} className="min-h-12 gap-2 rounded-2xl">
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        }
      />

      <AdminStatGrid>
        <AdminStatCard icon={Users} label="Total" value={stats.total} hint="Base monitorada" />
        <AdminStatCard icon={CheckCircle} label="Aprovados" value={stats.approved} hint="Podem comprar" tone="success" />
        <AdminStatCard icon={AlertCircle} label="Pendentes" value={stats.pending} hint="Exigem revisao" tone="warning" />
        <AdminStatCard icon={XCircle} label="Recusados" value={stats.rejected} hint="Nao elegiveis" tone="danger" />
      </AdminStatGrid>

      <AdminToolbar>
        <div className="flex items-center gap-2">
          <DebouncedInput
            placeholder="Buscar por nome, empresa, e-mail ou CNPJ..."
            value={searchInput}
            debounce={350}
            className="space-y-0 min-h-12 rounded-2xl flex-1 min-w-0"
            onChange={(value) => {
              const nextValue = String(value)
              setSearchInput(nextValue)
              applyBackendFilters(nextValue, statusFilter)
            }}
          />

          <Select
            value={statusFilter}
            onValueChange={(nextStatus) => {
              setStatusFilter(nextStatus)
              applyBackendFilters(searchInput, nextStatus)
            }}
          >
            <SelectTrigger className="min-h-12 rounded-2xl w-[150px] shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="APPROVED">Aprovado</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="REJECTED">Recusado</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={clearFilters}
            className={cn('relative min-h-12 min-w-12 rounded-2xl shrink-0')}
            aria-label="Limpar filtros"
            title="Limpar filtros"
          >
            <Filter className="h-4 w-4" />
            {hasActiveFilter && (
              <span className="pointer-events-none absolute inset-0">
                <span className="absolute left-1.5 right-1.5 top-1/2 h-0.5 -translate-y-1/2 -rotate-45 bg-foreground" />
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>Mostrando {Math.min(totalItems, pageSize)} resultados</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Aprovado
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Pendente
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Recusado
            </span>
          </div>
        </div>
      </AdminToolbar>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <MobileCardList>
        {customers.length === 0 ? (
          <AdminPanel>
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          </AdminPanel>
        ) : (
          paginatedCustomers.map((customer) => {
            const summary = effectiveOrderSummary[customer.id] || {
              ordersCount: 0,
              totalSpent: 0,
            }
            const isPendingCustomer = customer.status === 'PENDING'
            const isApprovingThis = actioningId === `approve-${customer.id}`
            const isRejectingThis = actioningId === `reject-${customer.id}`

            return (
              <div key={customer.id} className="w-full">
                <Card className="border-border/60 bg-card/95 shadow-sm overflow-hidden">
                  {/* Clickable info area */}
                  <div
                    className="cursor-pointer p-4 space-y-3 transition-colors hover:bg-muted/30"
                    onClick={() => router.push(`/customers/${customer.id}`)}
                  >
                    {/* Name + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">{customer.contactName || customer.companyName}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{formatCNPJorCPF(customer.cnpj)}</p>
                      </div>
                      <Badge variant={statusBadgeVariant[customer.status] || 'slate'} className="shrink-0 mt-0.5">
                        {statusMap[customer.status]?.label}
                      </Badge>
                    </div>

                    {/* Contact details */}
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

                    {/* CNAE + Origin + Branch */}
                    <div className="flex items-center gap-3 flex-wrap pt-0.5">
                      {customer.cnae && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Factory className="h-3 w-3 shrink-0" />
                          <span className="font-medium">{customer.cnae}</span>
                          {customer.cnaeDescription && (
                            <span className="truncate max-w-[140px]">{customer.cnaeDescription}</span>
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

                  {/* Approve / Reject — only for pending */}
                  {isPendingCustomer && (
                    <div className="grid grid-cols-2 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => handleApprove(customer.id)}
                        disabled={isPending || isApprovingThis || isRejectingThis}
                        className="flex items-center justify-center gap-2 h-14 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50 border-r border-border/50"
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
                        className="flex items-center justify-center gap-2 h-14 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
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

                  {/* WhatsApp */}
                  {customer.phone && (
                    <div className={isPendingCustomer ? 'border-t border-border/50' : 'border-t border-border/50'}>
                      <a
                        href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center gap-2 h-12 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    </div>
                  )}
                </Card>
              </div>
            )
          })
        )}
      </MobileCardList>

      <DesktopOnly>
      <Card className="rounded-[24px] border border-border/60 shadow-sm overflow-hidden p-0">
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
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Total em Compras</TableHead>
                  <TableHead>Vendedora</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => {
                  const summary = effectiveOrderSummary[customer.id] || {
                    ordersCount: 0,
                    totalSpent: 0,
                  }

                  return (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer"
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
                      {customer.createdAt
                        ? new Date(customer.createdAt).toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                    <TableCell>{formatCNPJorCPF(customer.cnpj)}</TableCell>
                    <TableCell className="font-medium">{customer.contactName || customer.companyName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-medium">
                        {customerTypeMap[customer.customerType || 'WHOLESALE']}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.state || '-'}</TableCell>
                    <TableCell>{formatPhoneNumber(customer.phone || '')}</TableCell>
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
                    <TableCell>
                      <Badge variant={statusBadgeVariant[customer.status] || 'slate'} className="text-xs font-medium">
                        {statusMap[customer.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {customer.phone ? (
                        messagedCustomers.has(customer.id) ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                            Enviado
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            onClick={(e) => handleSendMessage(customer, e)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Enviar Mensagem
                          </Button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/customers/${customer.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditCustomerDialog(customer)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {customer.status === 'PENDING' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleApprove(customer.id)}
                                disabled={isPending || actioningId === `approve-${customer.id}`}
                              >
                                {actioningId === `approve-${customer.id}` ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleReject(customer.id)}
                                disabled={isPending || actioningId === `reject-${customer.id}`}
                              >
                                {actioningId === `reject-${customer.id}` ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-2" />
                                )}
                                Rejeitar
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => setCustomerToDelete(customer)}
                            disabled={isPending || actioningId === `delete-${customer.id}`}
                            className="text-rose-600 focus:text-rose-600"
                          >
                            {actioningId === `delete-${customer.id}` ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Remover
                          </DropdownMenuItem>
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
      </DesktopOnly>
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
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {customerToDelete && actioningId === `delete-${customerToDelete.id}` ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}
