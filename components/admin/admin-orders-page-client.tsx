"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import DatePeriodFilter from "@/components/admin/date-period-filter";
import { getDateRangeForPreset } from "@/lib/date-period-presets";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Package,
  MessageCircle,
  Clock,
  Plus,
  SlidersHorizontal,
  FilterX,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowUpRight,
  Download,
  ChevronDown,
  Trash2,
  Eye,
  MoreVertical,
} from "lucide-react";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Order } from "@/lib/types";
import { toast } from "sonner";
import { softDeleteOrderAction } from "@/lib/actions/orders";
import { useAdminStore } from "@/contexts/admin-store-context";
import { useCommercialData } from "@/hooks/use-commercial-data";
interface AdminOrdersPageClientProps {
  initialOrders: Order[];
  initialSummary: {
    totalOrders: number;
    paidOrders: number;
    totalRequestedValue: number;
    paidOrdersValue: number;
  };
  initialSearch: string;
  initialStatus: string;
  initialPaymentStatus: string;
  initialFromDate: string;
  initialToDate: string;
  initialSellerId: string;
  initialLimit?: number;
}
const ORDER_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Package }> = {
  PENDING: { label: "Pendente", variant: "secondary", icon: Clock },
  IN_ANALYSIS: { label: "Em Análise", variant: "outline", icon: Clock },
  RELEASED: { label: "Liberado", variant: "default", icon: CheckCircle2 },
  CONFIRMED: { label: "Confirmado", variant: "default", icon: CheckCircle2 },
  PROCESSING: { label: "Processando", variant: "default", icon: Package },
  INVOICED: { label: "Faturado", variant: "default", icon: CheckCircle2 },
  SHIPPED: { label: "Enviado", variant: "default", icon: Truck },
  DELIVERED: { label: "Entregue", variant: "default", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelado", variant: "destructive", icon: XCircle },
};
const PAYMENT_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Aguardando", variant: "secondary" },
  PAID: { label: "Pago", variant: "default" },
  PARTIAL: { label: "Parcial", variant: "outline" },
  REFUNDED: { label: "Reembolsado", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
};

const ORDER_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function parseOrderPageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  return ORDER_PAGE_SIZE_OPTIONS.includes(parsed as (typeof ORDER_PAGE_SIZE_OPTIONS)[number]) ? parsed : 20;
}

export default function AdminOrdersPageClient({
  initialOrders,
  initialSummary,
  initialSearch,
  initialStatus,
  initialPaymentStatus,
  initialFromDate,
  initialToDate,
  initialSellerId,
  initialLimit = 20,
}: AdminOrdersPageClientProps) {
  const { session } = useAdminStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const permissionSet = useMemo(
    () => new Set(
      Array.isArray(session?.permissionCodes)
        ? session.permissionCodes
            .map((code) => String(code || '').trim().toLowerCase())
            .filter(Boolean)
        : []
    ),
    [session?.permissionCodes],
  );
  const canCreateOrder = permissionSet.has("orders.create");
  const canCancelOrder = permissionSet.has("orders.cancel");
  const canExportReports = permissionSet.has("reports.export");
  const viewAssignedOrdersOnly = session?.isSystemRole !== true
    && permissionSet.has("orders.view_assigned_only");
  const [search, setSearch] = useState(initialSearch);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(initialPaymentStatus);
  const [sellerFilter, setSellerFilter] = useState<string>(initialSellerId);
  const [selectedLimit, setSelectedLimit] = useState<number>(parseOrderPageLimit(String(initialLimit)));
  const [currentPage, setCurrentPage] = useState(() => {
    const p = parseInt(searchParams.get("page") ?? "1", 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isExportingOrders, setIsExportingOrders] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const { sellers } = useCommercialData();
  const orders: Order[] = initialOrders;

  const handleDatePeriodChange = (nextFromDate: string, nextToDate: string) => {
    setFromDate(nextFromDate);
    setToDate(nextToDate);
    applyFilters({ from: nextFromDate, to: nextToDate });
  };

  const resolveOrderCode = (order: Order) => {
    const dbCode = typeof order.code === "string" ? order.code.trim() : "";
    if (dbCode) return dbCode.toUpperCase();
    return order.id.slice(0, 8).toUpperCase();
  };
  const defaultDateRange = getDateRangeForPreset("30d");
  const hasActiveFilters = search.trim().length > 0
    || fromDate !== defaultDateRange.from
    || toDate !== defaultDateRange.to
    || statusFilter !== "all"
    || paymentStatusFilter !== "all"
    || (!viewAssignedOrdersOnly && sellerFilter !== "all");
  const buildFilterQuery = (filters?: {
    search?: string;
    status?: string;
    paymentStatus?: string;
    seller?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    const trimmedSearch = (filters?.search ?? search).trim();
    const nextStatus = filters?.status ?? statusFilter;
    const nextPaymentStatus = filters?.paymentStatus ?? paymentStatusFilter;
    const nextSeller = (filters?.seller ?? sellerFilter).trim();
    const nextFromDate = filters?.from ?? fromDate;
    const nextToDate = filters?.to ?? toDate;
    const nextPage = filters?.page ?? currentPage;
    const nextLimit = filters?.limit ?? selectedLimit;
    if (trimmedSearch) params.set("q", trimmedSearch);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextPaymentStatus !== "all") params.set("payment_status", nextPaymentStatus);
    if (nextSeller && nextSeller !== "all") params.set("seller", nextSeller);
    if (nextFromDate) params.set("from", nextFromDate);
    if (nextToDate) params.set("to", nextToDate);
    if (nextLimit !== 20) params.set("limit", String(nextLimit));
    if (nextPage > 1) params.set("page", String(nextPage));
    return params;
  };
  const applyFilters = (filters?: {
    search?: string;
    status?: string;
    paymentStatus?: string;
    seller?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) => {
    const params = buildFilterQuery({ ...filters, page: 1 });
    setCurrentPage(1);
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const params = buildFilterQuery({ page });
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };
  const clearFilters = () => {
    const defaultRange = getDateRangeForPreset("30d");
    setSearch("");
    setStatusFilter("all");
    setPaymentStatusFilter("all");
    setSellerFilter("all");
    setFromDate(defaultRange.from);
    setToDate(defaultRange.to);
    setCurrentPage(1);
    setMobileFiltersOpen(false);
    const params = buildFilterQuery({
      search: "",
      status: "all",
      paymentStatus: "all",
      seller: "all",
      from: defaultRange.from,
      to: defaultRange.to,
      page: 1,
      limit: selectedLimit,
    });
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };
  const handleSearchSubmit = () => {
    applyFilters({ search });
  };
  const handleExportOrdersExcel = async (mode: "orders" | "products-variants") => {
    if (!canExportReports) {
      toast.error('Você não tem permissão para exportar relatórios');
      return;
    }

    try {
      setIsExportingOrders(true);
      const params = buildFilterQuery();
      const basePath = mode === "products-variants"
        ? '/api/export/orders/products-variants/excel'
        : '/api/export/orders/excel';
      const url = params.toString()
        ? `${basePath}?${params.toString()}`
        : basePath;
      const response = await fetch(url, {
        method: 'GET',
      });
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const message = typeof errorJson?.error === 'string'
          ? errorJson.error
          : mode === "products-variants"
            ? 'Falha ao exportar produtos vendidos por variante'
            : 'Falha ao exportar pedidos';
        throw new Error(message);
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^\";]+)"?/i);
      const fallbackFilename = mode === "products-variants"
        ? `produtos-vendidos-variantes-${new Date().toISOString().split('T')[0]}.xlsx`
        : `pedidos-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.download = filenameMatch?.[1] || fallbackFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(
        mode === "products-variants"
          ? 'Produtos vendidos por variante exportados com sucesso'
          : 'Pedidos exportados com sucesso',
      );
    } catch (error) {
      console.error('Erro ao exportar pedidos:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : mode === "products-variants"
            ? 'Erro ao exportar produtos vendidos por variante'
            : 'Erro ao exportar pedidos',
      );
    } finally {
      setIsExportingOrders(false);
    }
  };
  const pageSize = selectedLimit;
  const {
    totalPages,
    safeCurrentPage,
    pageStart,
    pageEnd,
    paginatedItems: paginatedOrders,
  } = usePaginatedList({
    items: orders,
    currentPage,
    pageSize,
  });
  useEffect(() => {
    setSearch(initialSearch);
    setStatusFilter(initialStatus);
    setPaymentStatusFilter(initialPaymentStatus);
    setSellerFilter(initialSellerId);
    setFromDate(initialFromDate);
    setToDate(initialToDate);
    setSelectedLimit(parseOrderPageLimit(String(initialLimit)));
    const p = parseInt(searchParams.get("page") ?? "1", 10);
    setCurrentPage(isNaN(p) || p < 1 ? 1 : p);
  }, [initialSearch, initialStatus, initialPaymentStatus, initialSellerId, initialFromDate, initialToDate, initialLimit, initialOrders, searchParams]);
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };
  const formatWhatsappPhone = (phone: string | null | undefined): string | null => {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits || digits.length < 10) return null
    return digits.startsWith('55') ? digits : `55${digits}`
  }
  const resolveCustomerName = (order: Order): string => {
    const name = String(order.customerName || '').trim()
    return name || '-'
  }
  const buildWhatsappUrl = (order: Order): string | null => {
    const normalizedPhone = formatWhatsappPhone(order.customerPhone)
    if (!normalizedPhone) return null
    const targetName = resolveCustomerName(order)
    const message = `Olá ${targetName}, tudo bem?`
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
  }
  const openWhatsappConversation = (order: Order) => {
    const whatsappUrl = buildWhatsappUrl(order)
    if (!whatsappUrl) return
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }
  const openDeleteConfirmDialog = (orderId: string) => {
    setOrderToDelete(orderId)
    setDeleteConfirmOpen(true)
  }
  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return
    setDeleteConfirmOpen(false)
    setDeletingOrderId(orderToDelete)
    const result = await softDeleteOrderAction(orderToDelete)
    setDeletingOrderId(null)
    setOrderToDelete(null)
    if (!result.success) {
      toast.error(result.error || 'Erro ao remover pedido')
      return
    }
    toast.success('Pedido removido da lista')
    router.refresh()
  }
  const cancelDeleteOrder = () => {
    setDeleteConfirmOpen(false)
    setOrderToDelete(null)
  }
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "PENDING").length,
    processing: orders.filter((o) => o.status === "IN_ANALYSIS" || o.status === "RELEASED" || o.status === "CONFIRMED" || o.status === "PROCESSING" || o.status === "INVOICED").length,
    shipped: orders.filter((o) => o.status === "SHIPPED").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
    totalRequested: initialSummary.totalOrders,
    totalPaid: initialSummary.paidOrders,
    totalRequestedValue: initialSummary.totalRequestedValue,
    paidOrdersValue: initialSummary.paidOrdersValue,
  };
  const getDeliveryLabel = (order: Order) => {
    if (order.status === 'DELIVERED') return 'Entregue';
    if (order.status === 'SHIPPED') return 'Em Trânsito';
    if (order.status === 'CANCELLED') return 'Devolvido';
    return 'Aguardando';
  }
  const getDeliveryBadgeVariant = (order: Order): 'emerald' | 'sky' | 'rose' | 'slate' => {
    if (order.status === 'DELIVERED') return 'emerald';
    if (order.status === 'SHIPPED') return 'sky';
    if (order.status === 'CANCELLED') return 'rose';
    return 'slate';
  }
  const getStatusDotClassName = (status: string) => {
    if (status === 'PENDING') return 'bg-amber-300';
    if (status === 'IN_ANALYSIS') return 'bg-amber-300';
    if (status === 'RELEASED') return 'bg-blue-300';
    if (status === 'CONFIRMED' || status === 'PROCESSING' || status === 'INVOICED') return 'bg-blue-300';
    if (status === 'SHIPPED') return 'bg-sky-300';
    if (status === 'DELIVERED') return 'bg-green-300';
    if (status === 'CANCELLED') return 'bg-rose-300';
    return 'bg-slate-400';
  }
  const getOrderStatusBadgeVariant = (status: string): 'amber' | 'blue' | 'sky' | 'emerald' | 'rose' | 'slate' => {
    if (status === 'PENDING') return 'amber';
    if (status === 'IN_ANALYSIS') return 'amber';
    if (status === 'RELEASED') return 'blue';
    if (status === 'CONFIRMED' || status === 'PROCESSING' || status === 'INVOICED') return 'blue';
    if (status === 'SHIPPED') return 'sky';
    if (status === 'DELIVERED') return 'emerald';
    if (status === 'CANCELLED') return 'rose';
    return 'slate';
  }
  const getPaymentBadgeVariant = (status: string): 'emerald' | 'violet' | 'rose' | 'amber' => {
    if (status === 'PAID') return 'emerald';
    if (status === 'PARTIAL') return 'violet';
    if (status === 'REFUNDED') return 'rose';
    if (status === 'CANCELLED') return 'rose';
    return 'amber';
  }
  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Operação comercial
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              <Package className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              Lista de Pedidos
            </h1>
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground sm:text-sm">
              {formatCurrency(stats.totalRequestedValue)} em vendas solicitadas no período filtrado, com {stats.totalPaid} pedidos pagos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canExportReports ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-full px-4 cursor-pointer"
                    disabled={isExportingOrders || orders.length === 0}
                    aria-label="Exportar dados em Excel"
                    title="Exportar dados em Excel"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline sm:ml-2">Exportar Excel</span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isExportingOrders}
                    onClick={() => handleExportOrdersExcel("orders")}
                  >
                    Pedidos (lista detalhada)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isExportingOrders}
                    onClick={() => handleExportOrdersExcel("products-variants")}
                  >
                    Produtos vendidos por variante
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full cursor-pointer md:hidden"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Abrir filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            {canCreateOrder ? (
              <Button onClick={() => router.push('/orders/new')} className="h-10 gap-2 rounded-full px-4 cursor-pointer sm:px-5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Pedido</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de pedidos no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, cliente, CNPJ/CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                className="pl-9 pr-24"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-1 top-1/2 h-8 -translate-y-1/2 cursor-pointer"
                onClick={handleSearchSubmit}
              >
                Buscar
              </Button>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(nextStatus) => {
                setStatusFilter(nextStatus);
                applyFilters({ status: nextStatus });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="IN_ANALYSIS">Em Análise</SelectItem>
                <SelectItem value="RELEASED">Liberado</SelectItem>
                <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                <SelectItem value="PROCESSING">Processando</SelectItem>
                <SelectItem value="INVOICED">Faturado</SelectItem>
                <SelectItem value="SHIPPED">Enviado</SelectItem>
                <SelectItem value="DELIVERED">Entregue</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={paymentStatusFilter}
              onValueChange={(nextPaymentStatus) => {
                setPaymentStatusFilter(nextPaymentStatus);
                applyFilters({ paymentStatus: nextPaymentStatus });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos pagamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Pagamentos</SelectItem>
                <SelectItem value="PENDING">Aguardando</SelectItem>
                <SelectItem value="PAID">Pago</SelectItem>
                <SelectItem value="PARTIAL">Parcial</SelectItem>
                <SelectItem value="REFUNDED">Reembolsado</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            {!viewAssignedOrdersOnly ? (
            <Select
              value={sellerFilter}
              onValueChange={(nextSeller) => {
                setSellerFilter(nextSeller);
                applyFilters({ seller: nextSeller });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos vendedores</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={String(seller.id)}>
                    {seller.name || seller.email || `Vendedor #${seller.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            ) : null}
            <Select
              value={String(selectedLimit)}
              onValueChange={(value) => {
                const nextLimit = Number.parseInt(value, 10);
                if (!Number.isFinite(nextLimit)) return;
                setSelectedLimit(nextLimit);
                applyFilters({ limit: nextLimit });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Itens/pagina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por pagina</SelectItem>
                <SelectItem value="50">50 por pagina</SelectItem>
                <SelectItem value="100">100 por pagina</SelectItem>
              </SelectContent>
            </Select>
            <DatePeriodFilter
              fromDate={fromDate}
              toDate={toDate}
              onChange={handleDatePeriodChange}
              triggerClassName="min-h-12 rounded-2xl"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearFilters}
              className="h-10 w-10 rounded-full cursor-pointer self-end"
              aria-label="Limpar filtro geral"
              title="Limpar filtro geral"
              disabled={!hasActiveFilters}
            >
              <FilterX className="h-4 w-4" />
            </Button>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">Pedidos Solicitados</p>
              <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-none tracking-tight sm:text-2xl">{formatCurrency(stats.totalRequestedValue)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{stats.totalRequested} pedidos solicitados</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-emerald-100 p-2 text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">Pedidos Pagos</p>
              <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-none tracking-tight sm:text-2xl">{formatCurrency(stats.paidOrdersValue)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{stats.totalPaid} pedidos pagos</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-slate-100 p-2 text-slate-700">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">Pedidos em Andamento</p>
              <p className="mt-2 text-lg font-semibold leading-none tracking-tight sm:text-2xl">{stats.processing}</p>
              <p className="mt-2 text-xs text-muted-foreground">confirmados/processando/faturados</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-blue-100 p-2 text-blue-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-blue-300 to-blue-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">Pedidos Cancelados</p>
              <p className="mt-2 text-lg font-semibold leading-none tracking-tight sm:text-2xl">{stats.cancelled}</p>
              <p className="mt-2 text-xs text-muted-foreground">pedidos cancelados</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-rose-100 p-2 text-rose-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-rose-300 to-rose-500" />
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
                placeholder="Buscar por código, cliente, CNPJ/CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              setStatusFilter(nextStatus);
              applyFilters({ status: nextStatus });
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="IN_ANALYSIS">Em Análise</SelectItem>
              <SelectItem value="RELEASED">Liberado</SelectItem>
              <SelectItem value="CONFIRMED">Confirmado</SelectItem>
              <SelectItem value="PROCESSING">Processando</SelectItem>
              <SelectItem value="INVOICED">Faturado</SelectItem>
              <SelectItem value="SHIPPED">Enviado</SelectItem>
              <SelectItem value="DELIVERED">Entregue</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={paymentStatusFilter}
            onValueChange={(nextPaymentStatus) => {
              setPaymentStatusFilter(nextPaymentStatus);
              applyFilters({ paymentStatus: nextPaymentStatus });
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
              <SelectValue placeholder="Todos pagamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Pagamentos</SelectItem>
              <SelectItem value="PENDING">Aguardando</SelectItem>
              <SelectItem value="PAID">Pago</SelectItem>
              <SelectItem value="PARTIAL">Parcial</SelectItem>
              <SelectItem value="REFUNDED">Reembolsado</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          {!viewAssignedOrdersOnly ? (
          <Select
            value={sellerFilter}
            onValueChange={(nextSeller) => {
              setSellerFilter(nextSeller);
              applyFilters({ seller: nextSeller });
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
              <SelectValue placeholder="Todos vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos vendedores</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.id} value={String(seller.id)}>
                  {seller.name || seller.email || `Vendedor #${seller.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          ) : null}
          <DatePeriodFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={handleDatePeriodChange}
          />
          <Select
            value={String(selectedLimit)}
            onValueChange={(value) => {
              const nextLimit = Number.parseInt(value, 10);
              if (!Number.isFinite(nextLimit)) return;
              setSelectedLimit(nextLimit);
              applyFilters({ limit: nextLimit });
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
            className="h-10 w-10 shrink-0 rounded-full cursor-pointer"
            aria-label="Limpar filtro geral"
            title="Limpar filtro geral"
            disabled={!hasActiveFilters}
          >
            <FilterX className="h-4 w-4" />
          </Button>
          </div>
        </div>
      </form>
      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-medium">Status do Pedido:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />Pendente</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-300" />Processando</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" />Enviado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-300" />Entregue</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" />Cancelado</span>
          </div>
        </div>
      </div>
      <div className="space-y-4 md:hidden">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card px-6 py-12 text-center shadow-sm">
            <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">Nenhum pedido encontrado</p>
            <p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          paginatedOrders.map((order) => {
            const orderStatusInfo = ORDER_STATUS_LABELS[order.status] || {
              label: order.status,
              variant: "secondary" as const,
            };
            const paymentStatus = (order as any).paymentStatus || "PENDING";
            const paymentStatusInfo = PAYMENT_STATUS_LABELS[paymentStatus] || {
              label: paymentStatus,
              variant: "secondary" as const,
            };
            const fulfilledTotal = Number(order.fulfilledTotal ?? 0);
            const fallbackItems = Array.isArray((order as any).items) ? (order as any).items : [];
            const totalQty = Number(order.totalItems ?? fallbackItems.reduce((acc: number, item: any) => acc + Number(item?.qty || item?.quantity || 0), 0));
            const fulfilledQty = Number(order.fulfilledItems ?? fallbackItems.reduce((acc: number, item: any) => {
              const qty = Number(item?.qty || item?.quantity || 0);
              if (item?.fulfilled || String(item?.status || '').toLowerCase() === 'attended') return acc + qty;
              return acc;
            }, 0));
            const whatsappUrl = buildWhatsappUrl(order)
            const customerName = resolveCustomerName(order)
            return (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                className="w-full cursor-pointer rounded-3xl border border-border/20 bg-card px-6 py-6 text-left shadow-sm transition-colors hover:bg-muted/30"
                onClick={() => router.push(`/orders/${order.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    router.push(`/orders/${order.id}`)
                  }
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="font-mono text-sm font-semibold tracking-tight text-foreground">#{resolveOrderCode(order)}</p>
                    <p className="text-base font-semibold leading-tight text-foreground">
                      {customerName}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(order.createdAt).split(' ')[0]}</p>
                  </div>
                  <span className={`mt-1.5 inline-block h-4 w-4 shrink-0 rounded-full ${getStatusDotClassName(order.status).replace('300', '400')}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Valor</p>
                    <p className="mt-1.5 text-base font-semibold tabular-nums text-foreground">{formatCurrency(order.total)} <span className="font-medium text-foreground/90">• {formatCurrency(fulfilledTotal)} atend.</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Itens</p>
                    <p className="mt-1.5 text-base font-semibold tabular-nums text-foreground">{totalQty > 0 ? `${totalQty} total` : '-'} <span className="font-medium text-foreground/90">• {fulfilledQty > 0 ? fulfilledQty : 0} atend.</span></p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={getOrderStatusBadgeVariant(order.status)} className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 shadow-none hover:bg-blue-50">
                    {orderStatusInfo.label}
                  </Badge>
                  <Badge variant={getPaymentBadgeVariant(paymentStatus)} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 shadow-none hover:bg-emerald-50">
                    {paymentStatusInfo.label}
                  </Badge>
                  <Badge variant={getDeliveryBadgeVariant(order)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 shadow-none hover:bg-slate-50">
                    {getDeliveryLabel(order)}
                  </Badge>
                </div>
                <div className="mt-5 border-t border-border/70 pt-5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        openWhatsappConversation(order)
                      }}
                      disabled={!whatsappUrl}
                      className="flex cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-emerald-600 disabled:opacity-40"
                    >
                      <MessageCircle className="h-5 w-5" />
                      Enviar Mensagem
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        {canCancelOrder ? (
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); openDeleteConfirmDialog(order.id); }}
                            className="text-rose-600 focus:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="hidden rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 border-border/20">
              <TableHead className="w-14 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Status</TableHead>
              <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Data</TableHead>
              <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Codigo</TableHead>
              <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Cliente</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Valor</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Quantidade</TableHead>
              <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Pagamento</TableHead>
              <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Status</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">Nenhum pedido encontrado</p>
                  <p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => {
                const orderStatusInfo = ORDER_STATUS_LABELS[order.status] || {
                  label: order.status,
                  variant: "secondary" as const,
                };
                const paymentStatus = (order as any).paymentStatus || "PENDING";
                const paymentStatusInfo = PAYMENT_STATUS_LABELS[paymentStatus] || {
                  label: paymentStatus,
                  variant: "secondary" as const,
                };
                const fulfilledTotal = Number(order.fulfilledTotal ?? 0);
                const fallbackItems = Array.isArray((order as any).items) ? (order as any).items : [];
                const totalQty = Number(order.totalItems ?? fallbackItems.reduce((acc: number, item: any) => acc + Number(item?.qty || item?.quantity || 0), 0));
                const fulfilledQty = Number(order.fulfilledItems ?? fallbackItems.reduce((acc: number, item: any) => {
                  const qty = Number(item?.qty || item?.quantity || 0);
                  if (item?.fulfilled || String(item?.status || '').toLowerCase() === 'attended') return acc + qty;
                  return acc;
                }, 0));
                const customerName = resolveCustomerName(order)
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer border-border/20 hover:bg-muted/40 transition-colors"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <TableCell>
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${getStatusDotClassName(order.status)}`} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-primary">
                      {resolveOrderCode(order)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {customerName}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-right">{formatCurrency(order.total)}</span>
                        <span className="inline-flex min-w-27 justify-end rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(fulfilledTotal)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium tabular-nums text-right">{totalQty > 0 ? totalQty : '-'}</span>
                        <span className="inline-flex min-w-9 justify-end rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                          {fulfilledQty > 0 ? fulfilledQty : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getPaymentBadgeVariant(paymentStatus)}
                        className="w-full justify-center text-xs"
                      >
                        {paymentStatusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getOrderStatusBadgeVariant(order.status)}
                        className="w-full justify-center gap-1 text-xs"
                      >
                        {orderStatusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => router.push(`/orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {canCancelOrder ? (
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); openDeleteConfirmDialog(order.id); }}
                              className="text-rose-600 focus:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {orders.length > 0 && (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          showing={{
            start: pageStart,
            end: pageEnd,
            total: orders.length,
          }}
        />
      )}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar remoção</DialogTitle>
            <DialogDescription>
              Deseja remover este pedido da lista?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={cancelDeleteOrder}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteOrder}
              disabled={deletingOrderId !== null}
            >
              {deletingOrderId ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
