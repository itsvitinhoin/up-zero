"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import {
  AdminHero,
  AdminPage,
  AdminPanel,
  AdminStatCard,
  AdminStatGrid,
  AdminToolbar,
  DesktopOnly,
  MobileCardList,
} from "@/components/admin/admin-mobile-ui";
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
  Search,
  Package,
  Clock,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowUpRight,
  X,
  SlidersHorizontal,
  MessageCircle,
} from "lucide-react";
import type { Order, Customer } from "@/lib/types";

interface AdminOrdersPageClientProps {
  initialOrders: Order[];
  initialCustomers: Customer[];
}

const ORDER_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Package }> = {
  PENDING: { label: "Pendente", variant: "secondary", icon: Clock },
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

// ─── Mock data — exibido quando o backend não retorna dados ──────────────────
const MOCK_CUSTOMERS_DATA: Customer[] = [
  { id: 'mock-c1', companyName: 'Boutique Elegance LTDA', tradeName: 'Boutique Elegance', cnpj: '12345678000190', contactName: 'Ana Lima', phone: '11999887766', email: 'compras@elegance.com.br', state: 'SP', status: 'APPROVED', assignedSellerName: 'Maria Silva', customerType: 'WHOLESALE' } as unknown as Customer,
  { id: 'mock-c2', companyName: 'Moda Feminina SA', tradeName: 'Moda Feminina', cnpj: '98765432000110', contactName: 'Carla Santos', phone: '11988776655', email: 'pedidos@modafeminina.com.br', state: 'RJ', status: 'APPROVED', assignedSellerName: 'Ana Santos', customerType: 'WHOLESALE' } as unknown as Customer,
  { id: 'mock-c3', companyName: 'Casa da Moda ME', tradeName: 'Casa da Moda', cnpj: '45678901000123', contactName: 'Julia Ferreira', phone: '11977665544', email: 'vendas@casadamoda.com.br', state: 'MG', status: 'APPROVED', assignedSellerName: null as unknown as string, customerType: 'RETAIL' } as unknown as Customer,
  { id: 'mock-c4', companyName: 'Style & Co LTDA', tradeName: 'Style & Co', cnpj: '78901234000156', contactName: 'Maria Souza', phone: '11966554433', email: 'compras@styleco.com.br', state: 'SP', status: 'APPROVED', assignedSellerName: 'Julia Costa', customerType: 'WHOLESALE' } as unknown as Customer,
  { id: 'mock-c5', companyName: 'Fashion Plus ME', tradeName: 'Fashion Plus', cnpj: '34567890000178', contactName: 'Paula Costa', phone: '11955443322', email: 'pedidos@fashionplus.com.br', state: 'PR', status: 'PENDING', assignedSellerName: null as unknown as string, customerType: 'WHOLESALE' } as unknown as Customer,
  { id: 'mock-c6', companyName: 'Luxo & Estilo LTDA', tradeName: 'Luxo & Estilo', cnpj: '56789012000134', contactName: 'Renata Oliveira', phone: '11944332211', email: 'vendas@luxoestilo.com.br', state: 'RS', status: 'APPROVED', assignedSellerName: 'Carla Lima', customerType: 'WHOLESALE' } as unknown as Customer,
]

const MOCK_ORDERS_DATA: Order[] = [
  { id: 'a1b2c3d4e5f6a1b2', customerId: 'mock-c1', status: 'PENDING', paymentStatus: 'PENDING', total: 4750.00, fulfilledTotal: 0, subtotal: 4750, discountTotal: 0, manualDiscount: 0, totalItems: 12, fulfilledItems: 0, shippingPrice: 0, trackingCode: null, createdAt: new Date(Date.now() - 1.5 * 3600000), updatedAt: new Date() } as unknown as Order,
  { id: 'b2c3d4e5f6a1b2c3', customerId: 'mock-c2', status: 'PROCESSING', paymentStatus: 'PAID', total: 12380.00, fulfilledTotal: 5200, subtotal: 12380, discountTotal: 0, manualDiscount: 0, totalItems: 35, fulfilledItems: 14, shippingPrice: 0, trackingCode: null, createdAt: new Date(Date.now() - 3 * 3600000), updatedAt: new Date() } as unknown as Order,
  { id: 'c3d4e5f6a1b2c3d4', customerId: 'mock-c3', status: 'SHIPPED', paymentStatus: 'PAID', total: 8920.00, fulfilledTotal: 8920, subtotal: 8920, discountTotal: 0, manualDiscount: 0, totalItems: 28, fulfilledItems: 28, shippingPrice: 25, trackingCode: 'BR123456789BR', createdAt: new Date(Date.now() - 26 * 3600000), updatedAt: new Date() } as unknown as Order,
  { id: 'd4e5f6a1b2c3d4e5', customerId: 'mock-c4', status: 'DELIVERED', paymentStatus: 'PAID', total: 6540.00, fulfilledTotal: 6540, subtotal: 6540, discountTotal: 0, manualDiscount: 0, totalItems: 18, fulfilledItems: 18, shippingPrice: 0, trackingCode: null, createdAt: new Date(Date.now() - 50 * 3600000), updatedAt: new Date() } as unknown as Order,
  { id: 'e5f6a1b2c3d4e5f6', customerId: 'mock-c5', status: 'PENDING', paymentStatus: 'PENDING', total: 3200.00, fulfilledTotal: 0, subtotal: 3200, discountTotal: 0, manualDiscount: 0, totalItems: 8, fulfilledItems: 0, shippingPrice: 0, trackingCode: null, createdAt: new Date(Date.now() - 6 * 3600000), updatedAt: new Date() } as unknown as Order,
  { id: 'f6a1b2c3d4e5f6a1', customerId: 'mock-c6', status: 'CONFIRMED', paymentStatus: 'PAID', total: 9870.00, fulfilledTotal: 0, subtotal: 9870, discountTotal: 0, manualDiscount: 0, totalItems: 32, fulfilledItems: 0, shippingPrice: 0, trackingCode: null, createdAt: new Date(Date.now() - 74 * 3600000), updatedAt: new Date() } as unknown as Order,
  { id: 'g1a2b3c4d5e6f7a8', customerId: 'mock-c1', status: 'INVOICED', paymentStatus: 'PARTIAL', total: 15680.00, fulfilledTotal: 8000, subtotal: 15680, discountTotal: 0, manualDiscount: 0, totalItems: 45, fulfilledItems: 22, shippingPrice: 35, trackingCode: null, createdAt: new Date(Date.now() - 96 * 3600000), updatedAt: new Date() } as unknown as Order,
  { id: 'h2b3c4d5e6f7a8b9', customerId: 'mock-c2', status: 'CANCELLED', paymentStatus: 'REFUNDED', total: 2340.00, fulfilledTotal: 0, subtotal: 2340, discountTotal: 0, manualDiscount: 0, totalItems: 6, fulfilledItems: 0, shippingPrice: 0, trackingCode: null, createdAt: new Date(Date.now() - 120 * 3600000), updatedAt: new Date() } as unknown as Order,
]
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminOrdersPageClient({
  initialOrders,
  initialCustomers,
}: AdminOrdersPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const orders: Order[] = initialOrders.length > 0 ? initialOrders : MOCK_ORDERS_DATA;
  const customers: Customer[] = initialCustomers.length > 0 ? initialCustomers : MOCK_CUSTOMERS_DATA;

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const getCustomer = (customerId: string) => {
    return customersById.get(customerId);
  };

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    const fromDateValue = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const toDateValue = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return orders.filter((order) => {
      const customer = getCustomer(order.customerId);
      const createdAt = new Date(order.createdAt);

      const matchesSearch = !q ||
        order.id.toLowerCase().includes(q) ||
        order.id.slice(0, 8).toLowerCase().includes(q) ||
        (customer?.companyName || "").toLowerCase().includes(q) ||
        (customer?.tradeName || "").toLowerCase().includes(q) ||
        (customer?.cnpj || "").replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        (customer?.contactName || "").toLowerCase().includes(q);

      const matchesFromDate = !fromDateValue || createdAt >= fromDateValue;
      const matchesToDate = !toDateValue || createdAt <= toDateValue;
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      return matchesSearch && matchesFromDate && matchesToDate && matchesStatus;
    });
  }, [orders, search, fromDate, toDate, statusFilter, customersById]);

  const pageSize = 20;
  const {
    totalPages,
    safeCurrentPage,
    pageStart,
    pageEnd,
    paginatedItems: paginatedOrders,
  } = usePaginatedList({
    items: filteredOrders,
    currentPage,
    pageSize,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, fromDate, toDate, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "-";
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cnpj;
  };

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "PENDING").length,
    processing: orders.filter((o) => o.status === "CONFIRMED" || o.status === "PROCESSING" || o.status === "INVOICED").length,
    shipped: orders.filter((o) => o.status === "SHIPPED").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
    totalValue: orders.reduce((acc, o) => acc + o.total, 0),
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
    if (status === 'CONFIRMED' || status === 'PROCESSING' || status === 'INVOICED') return 'bg-blue-300';
    if (status === 'SHIPPED') return 'bg-sky-300';
    if (status === 'DELIVERED') return 'bg-green-300';
    if (status === 'CANCELLED') return 'bg-rose-300';
    return 'bg-slate-400';
  }

  const getOrderStatusBadgeVariant = (status: string): 'amber' | 'blue' | 'sky' | 'emerald' | 'rose' | 'slate' => {
    if (status === 'PENDING') return 'amber';
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
    <AdminPage>
      <AdminHero
        icon={Package}
        eyebrow="Pedidos"
        title="Lista de pedidos"
        description={`${orders.length} pedidos acompanhados • ${formatCurrency(stats.totalValue)} em vendas`}
        actions={
          <Button onClick={() => router.push('/orders/new')} className="min-h-12 gap-2 rounded-2xl">
            <Plus className="h-4 w-4" />
            Novo pedido
          </Button>
        }
      />

      <AdminStatGrid>
        <AdminStatCard icon={ArrowUpRight} label="Vendas" value={formatCurrency(stats.totalValue)} hint="Volume total" />
        <AdminStatCard icon={Clock} label="Pendentes" value={stats.pending} hint="Precisam de acao" tone="warning" />
        <AdminStatCard icon={Truck} label="Em envio" value={stats.shipped} hint="Ja despachados" tone="info" />
        <AdminStatCard icon={CheckCircle2} label="Entregues" value={stats.delivered} hint="Concluidos" tone="success" />
      </AdminStatGrid>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <AdminToolbar>
        {/* Row 1: unified search + date toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por cliente, código ou CNPJ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-12 rounded-2xl pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant={showDateFilter || fromDate || toDate ? "default" : "outline"}
            size="icon"
            className="min-h-12 min-w-12 rounded-2xl shrink-0"
            onClick={() => setShowDateFilter((v) => !v)}
            title="Filtrar por período"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Date range — shown when toggled or when a date is already set */}
        {(showDateFilter || fromDate || toDate) && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="min-h-12 rounded-2xl pl-9"
              />
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="min-h-12 rounded-2xl pl-9"
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="icon"
                className="min-h-12 min-w-12 rounded-2xl shrink-0 text-muted-foreground"
                onClick={() => { setFromDate(""); setToDate(""); }}
                title="Limpar datas"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Row 2: status pills — scrollable on mobile */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-1.5 w-max md:w-auto md:flex-wrap">
            {[
              { value: "all", label: "Todos", dot: null },
              { value: "PENDING", label: "Pendente", dot: "bg-amber-400" },
              { value: "CONFIRMED", label: "Confirmado", dot: "bg-blue-400" },
              { value: "PROCESSING", label: "Processando", dot: "bg-blue-400" },
              { value: "INVOICED", label: "Faturado", dot: "bg-blue-400" },
              { value: "SHIPPED", label: "Enviado", dot: "bg-sky-400" },
              { value: "DELIVERED", label: "Entregue", dot: "bg-emerald-400" },
              { value: "CANCELLED", label: "Cancelado", dot: "bg-rose-400" },
            ].map(({ value, label, dot }) => {
              const count = value === "all" ? filteredOrders.length : orders.filter((o) => o.status === value).length
              const isActive = statusFilter === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {dot && !isActive && <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />}
                  {label}
                  <span className={`text-xs tabular-nums ${isActive ? "opacity-70" : "text-muted-foreground"}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </AdminToolbar>

      <MobileCardList>
        {filteredOrders.length === 0 ? (
          <AdminPanel>
            <div className="py-8 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-muted-foreground">Nenhum pedido encontrado</p>
              <p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca</p>
            </div>
          </AdminPanel>
        ) : (
          paginatedOrders.map((order) => {
            const customer = getCustomer(order.customerId);
            const paymentStatus = (order as any).paymentStatus || "PENDING";
            const paymentStatusInfo = PAYMENT_STATUS_LABELS[paymentStatus] || {
              label: paymentStatus,
              variant: "secondary" as const,
            };
            const totalQty = Number(order.totalItems ?? 0)
            const fulfilledQty = Number(order.fulfilledItems ?? 0)

            const whatsappPhone = customer?.phone?.replace(/\D/g, '')
            const whatsappHref = whatsappPhone
              ? `https://wa.me/55${whatsappPhone}`
              : null

            return (
              <div key={order.id} className="w-full">
                <AdminPanel className="overflow-hidden p-0">
                  {/* Clickable order info */}
                  <div
                    className="cursor-pointer p-4 space-y-4 transition-colors hover:bg-muted/30"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-mono text-sm font-semibold text-primary">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-base font-semibold text-foreground">
                          {customer?.companyName || customer?.tradeName || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                      <span className={`mt-1 inline-block h-3 w-3 rounded-full ${getStatusDotClassName(order.status)}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
                        <p className="font-semibold text-foreground">{formatCurrency(order.total)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Itens</p>
                        <p className="font-semibold text-foreground">{totalQty} total • {fulfilledQty} atend.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getOrderStatusBadgeVariant(order.status)}>{ORDER_STATUS_LABELS[order.status]?.label || order.status}</Badge>
                      <Badge variant={getPaymentBadgeVariant(paymentStatus)}>{paymentStatusInfo.label}</Badge>
                      <Badge variant={getDeliveryBadgeVariant(order)}>{getDeliveryLabel(order)}</Badge>
                    </div>
                  </div>

                  {/* WhatsApp action */}
                  {whatsappHref && (
                    <div className="border-t border-border/50">
                      <a
                        href={whatsappHref}
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
                </AdminPanel>
              </div>
            )
          })
        )}
      </MobileCardList>

      <DesktopOnly>
      <div className="rounded-[24px] border border-border/60 bg-card/95 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/20">
              <TableHead className="w-14 text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Status</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Data</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Codigo</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Cliente</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">CNPJ/CPF</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Valor</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Quantidade</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Separacao</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Pagamento</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Entrega</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">Nenhum pedido encontrado</p>
                  <p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => {
                const customer = getCustomer(order.customerId);
                const orderStatusInfo = ORDER_STATUS_LABELS[order.status] || {
                  label: order.status,
                  variant: "secondary" as const,
                };
                const paymentStatus = (order as any).paymentStatus || "PENDING";
                const paymentStatusInfo = PAYMENT_STATUS_LABELS[paymentStatus] || {
                  label: paymentStatus,
                  variant: "secondary" as const,
                };
                const fulfilledTotal = (order as any).fulfilledTotal || 0;
                const fallbackItems = Array.isArray((order as any).items) ? (order as any).items : [];
                const totalQty = Number(order.totalItems ?? fallbackItems.reduce((acc: number, item: any) => acc + Number(item?.qty || item?.quantity || 0), 0));
                const fulfilledQty = Number(order.fulfilledItems ?? fallbackItems.reduce((acc: number, item: any) => {
                  const qty = Number(item?.qty || item?.quantity || 0);
                  if (item?.fulfilled || String(item?.status || '').toLowerCase() === 'attended') return acc + qty;
                  return acc;
                }, 0));

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
                      #{order.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {customer?.companyName || customer?.tradeName || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatCNPJ(customer?.cnpj || "")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span>{formatCurrency(order.total)}</span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {formatCurrency(fulfilledTotal)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{totalQty > 0 ? totalQty : '-'}</span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {fulfilledQty > 0 ? fulfilledQty : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getOrderStatusBadgeVariant(order.status)}
                        className="w-full justify-center gap-1 text-xs"
                      >
                        {orderStatusInfo.label}
                      </Badge>
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
                        variant={getDeliveryBadgeVariant(order)}
                        className="w-full justify-center text-xs font-medium"
                      >
                        {getDeliveryLabel(order)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      </DesktopOnly>

      {filteredOrders.length > 0 && (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          showing={{
            start: pageStart,
            end: pageEnd,
            total: filteredOrders.length,
          }}
        />
      )}
    </AdminPage>
  );
}
