"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ComponentType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  ExternalLink,
  Filter,
  KanbanSquare,
  Package,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateOrderAction } from "@/lib/actions/orders";
import {
  getWmsFulfillmentScanSummaryAction,
  registerWmsFulfillmentScanAction,
  type WmsFulfillmentOrder,
  type WmsFulfillmentScanSummary,
} from "@/lib/actions/wms";
import { useAdminStore } from "@/contexts/admin-store-context";

interface Props {
  initialOrders: WmsFulfillmentOrder[];
  loadError: string | null;
  renderedAtMs: number;
}

type BoardColumn = "RECEIVED" | "PICKING" | "CHECKING" | "PACKING" | "SHIPPING" | "SENT";
type RiskFilter = "ALL" | "AT_RISK" | "CRITICAL" | "BLOCKED";

const BOARD_COLUMNS: Array<{ id: BoardColumn; label: string; slaMinutes: number; color: string }> = [
  { id: "RECEIVED", label: "Recebido", slaMinutes: 20, color: "bg-slate-50 border-slate-200" },
  { id: "PICKING", label: "Separacao", slaMinutes: 45, color: "bg-amber-50 border-amber-200" },
  { id: "CHECKING", label: "Conferencia", slaMinutes: 35, color: "bg-indigo-50 border-indigo-200" },
  { id: "PACKING", label: "Embalagem", slaMinutes: 30, color: "bg-sky-50 border-sky-200" },
  { id: "SHIPPING", label: "Expedicao", slaMinutes: 40, color: "bg-emerald-50 border-emerald-200" },
  { id: "SENT", label: "Enviado", slaMinutes: 5, color: "bg-green-50 border-green-200" },
];

const NEXT_COLUMN: Partial<Record<BoardColumn, BoardColumn>> = {
  RECEIVED: "PICKING",
  PICKING: "CHECKING",
  CHECKING: "PACKING",
  PACKING: "SHIPPING",
  SHIPPING: "SENT",
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}

function minutesSince(nowMs: number, iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((nowMs - t) / 60000));
}

function getColumnConfig(column: BoardColumn) {
  return BOARD_COLUMNS.find((c) => c.id === column) || BOARD_COLUMNS[0];
}

function deriveColumn(order: WmsFulfillmentOrder, manual?: BoardColumn): BoardColumn {
  if (manual) return manual;
  if (order.status === "SHIPPED") return "SENT";
  if (order.status === "INVOICED") return "SHIPPING";
  if (order.status === "PROCESSING") {
    if (order.scan_completion_ratio >= 1) return "PACKING";
    return "CHECKING";
  }
  if (order.status === "CONFIRMED") {
    if (order.pending_allocations > 0 && order.committed_allocations === 0) return "RECEIVED";
    return "PICKING";
  }
  return "RECEIVED";
}

function statusForColumn(column: BoardColumn): string {
  if (column === "SENT") return "SHIPPED";
  if (column === "SHIPPING") return "INVOICED";
  if (column === "CHECKING" || column === "PACKING") return "PROCESSING";
  return "CONFIRMED";
}

function getRiskLevel(nowMs: number, order: WmsFulfillmentOrder, column: BoardColumn): "ok" | "warn" | "critical" {
  if (column === "SENT") return "ok";
  const elapsed = minutesSince(nowMs, order.updated_at || order.created_at);
  const limit = getColumnConfig(column).slaMinutes;
  if (elapsed >= limit * 1.5) return "critical";
  if (elapsed >= limit) return "warn";
  return "ok";
}

function riskLabel(level: "ok" | "warn" | "critical"): string {
  if (level === "critical") return "Critico";
  if (level === "warn") return "Em risco";
  return "No prazo";
}

function riskClass(level: "ok" | "warn" | "critical"): string {
  if (level === "critical") return "bg-red-100 text-red-800 border-red-200";
  if (level === "warn") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function MetricCard({ title, value, caption, icon: Icon }: { title: string; value: string; caption: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SortableOrderCard({
  order,
  column,
  nowMs,
  selected,
  loading,
  onSelect,
  onAdvance,
}: {
  order: WmsFulfillmentOrder;
  column: BoardColumn;
  nowMs: number;
  selected: boolean;
  loading: boolean;
  onSelect: (orderId: number) => void;
  onAdvance?: (order: WmsFulfillmentOrder, target: BoardColumn) => void;
}) {
  const sortableId = `order-${order.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  const risk = getRiskLevel(nowMs, order, column);
  const elapsed = minutesSince(nowMs, order.updated_at || order.created_at);
  const nextColumn = NEXT_COLUMN[column];
  const location = [order.shipping_city, order.shipping_state].filter(Boolean).join(" / ") || "-";

  return (
    <article
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(order.id)}
      className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition ${selected ? "border-slate-900" : "border-slate-200"}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{order.code ? `#${order.code}` : `#${order.id}`}</p>
            <a
              href={`/orders/${order.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="truncate text-xs text-slate-600">{order.customer_name || order.customer_email}</p>
          <p className="truncate text-[11px] text-slate-500">{location}</p>
        </div>
        <Badge variant="outline" className="text-xs">{order.item_count} itens</Badge>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`text-[11px] ${riskClass(risk)}`}>{riskLabel(risk)}</Badge>
        {order.pending_allocations > 0 && order.committed_allocations === 0 ? (
          <Badge variant="outline" className="border-red-200 bg-red-100 text-[11px] text-red-800">Bloqueio estoque</Badge>
        ) : null}
        {order.sales_channel ? (
          <Badge variant="outline" className="text-[11px] capitalize">{order.sales_channel}</Badge>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
        <div>
          <p className="text-slate-400">Lead</p>
          <p className="font-medium text-slate-700">{elapsed} min</p>
        </div>
        <div>
          <p className="text-slate-400">Valor</p>
          <p className="font-medium text-slate-700">{formatMoney(order.total_amount_cents)}</p>
        </div>
        <div>
          <p className="text-slate-400">Conferencia</p>
          <p className="font-medium text-slate-700">{Math.round((order.scan_completion_ratio || 0) * 100)}%</p>
        </div>
        <div>
          <p className="text-slate-400">Atualizado</p>
          <p className="font-medium text-slate-700">{formatDateTime(order.updated_at)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          onClick={(e) => {
            e.stopPropagation();
          }}
          {...attributes}
          {...listeners}
        >
          Arrastar
        </button>
        {nextColumn ? (
          <Button
            size="sm"
            className="h-7 gap-1 text-[11px]"
            disabled={loading || !onAdvance}
            onClick={(e) => {
              e.stopPropagation();
              if (!onAdvance) return;
              onAdvance(order, nextColumn);
            }}
          >
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
            Avancar
          </Button>
        ) : (
          <Badge className="bg-green-600 text-[11px]">Finalizado</Badge>
        )}
      </div>
    </article>
  );
}

function DroppableColumn({
  column,
  count,
  children,
}: {
  column: BoardColumn;
  count: number;
  children: ReactNode;
}) {
  const id = `col-${column}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const cfg = getColumnConfig(column);

  return (
    <section ref={setNodeRef} className={`flex min-h-90 flex-col rounded-xl border p-3 ${cfg.color} ${isOver ? "ring-2 ring-slate-400" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{cfg.label}</p>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function AdminWmsFulfillmentClient({ initialOrders, loadError, renderedAtMs }: Props) {
  const { session } = useAdminStore();
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null;
  const canManageInventoryMovements = permissionCodes === null || permissionCodes.includes('inventory.manage_movements');
  const [orders, setOrders] = useState<WmsFulfillmentOrder[]>(initialOrders);
  const [nowMs, setNowMs] = useState<number>(renderedAtMs);
  const [error, setError] = useState<string | null>(loadError);
  const [mode, setMode] = useState<"operations" | "management">("operations");
  const [search, setSearch] = useState("");
  const [columnFilter, setColumnFilter] = useState<BoardColumn | "ALL">("ALL");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [carrierFilter, setCarrierFilter] = useState<string>("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(initialOrders[0]?.id ?? null);
  const [advancingId, setAdvancingId] = useState<number | null>(null);
  const [manualColumns, setManualColumns] = useState<Record<number, BoardColumn>>({});

  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanSummary, setScanSummary] = useState<WmsFulfillmentScanSummary | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [scanConcluding, setScanConcluding] = useState(false);
  const [scanOrderId, setScanOrderId] = useState<number | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [, startTransition] = useTransition();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const ordersWithColumn = useMemo(
    () => orders.map((order) => ({ order, column: deriveColumn(order, manualColumns[order.id]) })),
    [orders, manualColumns],
  );

  const channels = useMemo(
    () => Array.from(new Set(orders.map((o) => o.sales_channel).filter(Boolean))).sort(),
    [orders],
  );
  const carriers = useMemo(
    () => Array.from(new Set(orders.map((o) => o.carrier_name || "").filter(Boolean))).sort(),
    [orders],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ordersWithColumn.filter(({ order, column }) => {
      if (columnFilter !== "ALL" && column !== columnFilter) return false;
      if (channelFilter !== "ALL" && order.sales_channel !== channelFilter) return false;
      if (carrierFilter !== "ALL" && (order.carrier_name || "") !== carrierFilter) return false;

      const risk = getRiskLevel(nowMs, order, column);
      const blocked = order.pending_allocations > 0 && order.committed_allocations === 0;
      if (riskFilter === "AT_RISK" && risk !== "warn") return false;
      if (riskFilter === "CRITICAL" && risk !== "critical") return false;
      if (riskFilter === "BLOCKED" && !blocked) return false;

      if (!q) return true;
      const blob = [
        order.id,
        order.code,
        order.customer_name,
        order.customer_email,
        order.shipping_city,
        order.shipping_state,
        order.sales_channel,
        order.marketplace,
        order.carrier_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [ordersWithColumn, search, columnFilter, riskFilter, channelFilter, carrierFilter, nowMs]);

  const grouped = useMemo(() => {
    return BOARD_COLUMNS.reduce<Record<BoardColumn, WmsFulfillmentOrder[]>>((acc, col) => {
      acc[col.id] = filtered.filter((x) => x.column === col.id).map((x) => x.order);
      return acc;
    }, {
      RECEIVED: [],
      PICKING: [],
      CHECKING: [],
      PACKING: [],
      SHIPPING: [],
      SENT: [],
    });
  }, [filtered]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const critical = filtered.filter((x) => getRiskLevel(nowMs, x.order, x.column) === "critical").length;
    const atRisk = filtered.filter((x) => getRiskLevel(nowMs, x.order, x.column) === "warn").length;
    const blocked = filtered.filter((x) => x.order.pending_allocations > 0 && x.order.committed_allocations === 0).length;
    const throughputHour = filtered.filter((x) => minutesSince(nowMs, x.order.updated_at || x.order.created_at) <= 60).length;
    const avgLead = total === 0 ? 0 : Math.round(filtered.reduce((sum, x) => sum + minutesSince(nowMs, x.order.created_at), 0) / total);
    const avgScan = total === 0 ? 0 : Math.round((filtered.reduce((sum, x) => sum + x.order.scan_completion_ratio, 0) / total) * 100);
    return { total, critical, atRisk, blocked, throughputHour, avgLead, avgScan };
  }, [filtered, nowMs]);

  const chartByColumn = useMemo(
    () => BOARD_COLUMNS.map((c) => ({ name: c.label, pedidos: grouped[c.id].length })),
    [grouped],
  );

  const timelineBuckets = useMemo(() => {
    const buckets = [
      { name: "0-1h", min: 0, max: 60 },
      { name: "1-2h", min: 60, max: 120 },
      { name: "2-4h", min: 120, max: 240 },
      { name: "4h+", min: 240, max: Number.MAX_SAFE_INTEGER },
    ];
    return buckets.map((b) => ({
      faixa: b.name,
      pedidos: filtered.filter((x) => {
        const minutes = Math.round((nowMs - new Date(x.order.created_at).getTime()) / 60000);
        return minutes >= b.min && minutes < b.max;
      }).length,
    }));
  }, [filtered, nowMs]);

  const riskChart = useMemo(
    () => [
      { name: "No prazo", value: Math.max(0, metrics.total - metrics.critical - metrics.atRisk) },
      { name: "Em risco", value: metrics.atRisk },
      { name: "Critico", value: metrics.critical },
    ],
    [metrics],
  );

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;
  const selectedColumn = selectedOrder ? deriveColumn(selectedOrder, manualColumns[selectedOrder.id]) : null;

  useEffect(() => {
    if (scanDialogOpen) {
      const t = setTimeout(() => scanInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [scanDialogOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadScanSummary(orderId: number) {
    setScanLoading(true);
    const summaryRes = await getWmsFulfillmentScanSummaryAction(orderId);
    if (!summaryRes.success) {
      setError(summaryRes.error || "Falha ao carregar conferencia");
      setScanSummary(null);
      setScanDialogOpen(false);
    } else {
      setScanSummary(summaryRes.data);
      setScanDialogOpen(true);
    }
    setScanLoading(false);
  }

  async function persistStatus(orderId: number, targetStatus: string, targetColumn: BoardColumn) {
    setError(null);
    setAdvancingId(orderId);
    try {
      const result = await updateOrderAction(String(orderId), { status: targetStatus as never });
      if (!result.success) {
        setError(result.error || "Erro ao atualizar etapa");
        return;
      }
      setManualColumns((prev) => ({ ...prev, [orderId]: targetColumn }));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: targetStatus, updated_at: new Date().toISOString() } : o)));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(String(e));
    } finally {
      setAdvancingId(null);
    }
  }

  async function moveOrder(order: WmsFulfillmentOrder, targetColumn: BoardColumn) {
    if (!canManageInventoryMovements) {
      setError('Você não tem permissão para gerenciar movimentações de estoque');
      return;
    }

    const targetStatus = statusForColumn(targetColumn);
    const currentColumn = deriveColumn(order, manualColumns[order.id]);
    if (targetColumn === currentColumn) return;

    if (targetStatus === order.status) {
      setManualColumns((prev) => ({ ...prev, [order.id]: targetColumn }));
      return;
    }

    if (targetStatus === "INVOICED" && order.status === "PROCESSING") {
      setScanOrderId(order.id);
      setScanCode("");
      await loadScanSummary(order.id);
      return;
    }

    await persistStatus(order.id, targetStatus, targetColumn);
  }

  async function handleScanRegister() {
    if (!canManageInventoryMovements) {
      setError('Você não tem permissão para gerenciar movimentações de estoque');
      return;
    }

    if (!scanOrderId) return;
    setError(null);
    setScanSubmitting(true);
    try {
      const res = await registerWmsFulfillmentScanAction(scanOrderId, { barcode: scanCode });
      if (!res.success) {
        setError(res.error || "Erro ao registrar scan");
      } else {
        setScanSummary(res.data);
        setScanCode("");
        setTimeout(() => scanInputRef.current?.focus(), 0);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setScanSubmitting(false);
    }
  }

  async function concludeScanAndMove() {
    if (!canManageInventoryMovements) {
      setError('Você não tem permissão para gerenciar movimentações de estoque');
      return;
    }

    if (!scanOrderId || !scanSummary?.is_complete) return;
    setScanConcluding(true);
    try {
      await persistStatus(scanOrderId, "INVOICED", "SHIPPING");
      setScanDialogOpen(false);
      setScanSummary(null);
      setScanCode("");
      setScanOrderId(null);
    } finally {
      setScanConcluding(false);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    if (!canManageInventoryMovements) {
      setError('Você não tem permissão para gerenciar movimentações de estoque');
      return;
    }

    const activeId = String(event.active.id || "");
    const overId = event.over ? String(event.over.id) : "";
    if (!activeId.startsWith("order-") || !overId) return;

    const orderId = Number(activeId.replace("order-", ""));
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    let targetColumn: BoardColumn | null = null;
    if (overId.startsWith("col-")) {
      targetColumn = overId.replace("col-", "") as BoardColumn;
    } else if (overId.startsWith("order-")) {
      const overOrderId = Number(overId.replace("order-", ""));
      const overOrder = orders.find((o) => o.id === overOrderId);
      if (overOrder) {
        targetColumn = deriveColumn(overOrder, manualColumns[overOrder.id]);
      }
    }

    if (!targetColumn) return;
    await moveOrder(order, targetColumn);
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-cyan-900 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Fulfillment WMS Enterprise</h1>
            <p className="mt-1 text-sm text-slate-200">Operacao em tempo real com SLA, gargalos e controle de fluxo por etapa.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className={`h-8 gap-1 border ${
                mode === "operations"
                  ? "border-white/90 bg-white text-slate-900 hover:bg-slate-100"
                  : "border-white/40 bg-white/10 text-white hover:bg-white/20"
              }`}
              onClick={() => setMode("operations")}
            >
              <KanbanSquare className="h-4 w-4" /> Operacao
            </Button>
            <Button
              variant="outline"
              className={`h-8 gap-1 border ${
                mode === "management"
                  ? "border-white/90 bg-white text-slate-900 hover:bg-slate-100"
                  : "border-white/40 bg-white/10 text-white hover:bg-white/20"
              }`}
              onClick={() => setMode("management")}
            >
              <Users className="h-4 w-4" /> Gestao
            </Button>
            <Button
              variant="outline"
              className="h-8 gap-1 border-white/40 bg-white/10 text-white hover:bg-white/20"
              onClick={() => startTransition(() => router.refresh())}
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Pedidos no fluxo" value={String(metrics.total)} caption="Fila ativa filtrada" icon={Package} />
        <MetricCard title="Criticos" value={String(metrics.critical)} caption="Ultrapassaram SLA limite" icon={ShieldAlert} />
        <MetricCard title="Em risco" value={String(metrics.atRisk)} caption="Atingindo janela de SLA" icon={AlertTriangle} />
        <MetricCard title="Bloqueados" value={String(metrics.blocked)} caption="Sem alocacao comprometida" icon={Filter} />
        <MetricCard title="Throughput / hora" value={String(metrics.throughputHour)} caption="Atualizados ultimos 60min" icon={Truck} />
        <MetricCard title="Lead medio" value={`${metrics.avgLead} min`} caption={`Conferencia media ${metrics.avgScan}%`} icon={Clock3} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 lg:grid-cols-5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por pedido, cliente, canal, cidade"
            className="lg:col-span-2"
          />

          <select
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value as BoardColumn | "ALL")}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          >
            <option value="ALL">Todas as etapas</option>
            {BOARD_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>{col.label}</option>
            ))}
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          >
            <option value="ALL">Todos os riscos</option>
            <option value="AT_RISK">Em risco</option>
            <option value="CRITICAL">Criticos</option>
            <option value="BLOCKED">Bloqueados</option>
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            >
              <option value="ALL">Canal</option>
              {channels.map((channel) => (
                <option key={channel} value={channel}>{channel}</option>
              ))}
            </select>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            >
              <option value="ALL">Transportadora</option>
              {carriers.map((carrier) => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {mode === "management" ? (
        <div className="grid gap-3 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">Distribuicao por etapa</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartByColumn}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="pedidos" fill="#0f172a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">Aging da fila</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineBuckets}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="faixa" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pedidos" stroke="#0e7490" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">Saude de SLA</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskChart} dataKey="value" nameKey="name" outerRadius={88} fill="#334155" label />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(e) => void onDragEnd(e)}>
          <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            {BOARD_COLUMNS.map((col) => {
              const items = grouped[col.id];
              return (
                <DroppableColumn key={col.id} column={col.id} count={items.length}>
                  <SortableContext items={items.map((o) => `order-${o.id}`)} strategy={verticalListSortingStrategy}>
                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-xs text-slate-400">Sem pedidos</div>
                    ) : (
                      items.map((order) => (
                        <SortableOrderCard
                          key={order.id}
                          order={order}
                          column={col.id}
                          nowMs={nowMs}
                          selected={selectedOrderId === order.id}
                          loading={advancingId === order.id || (scanOrderId === order.id && (scanLoading || scanSubmitting || scanConcluding))}
                          onSelect={setSelectedOrderId}
                          onAdvance={canManageInventoryMovements ? (targetOrder, targetCol) => void moveOrder(targetOrder, targetCol) : undefined}
                        />
                      ))
                    )}
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>
        </DndContext>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Painel do pedido</h2>
          {!selectedOrder ? (
            <p className="mt-3 text-sm text-slate-500">Selecione um card para visualizar timeline, SLA e detalhes operacionais.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{selectedOrder.code ? `#${selectedOrder.code}` : `#${selectedOrder.id}`}</p>
                <p className="text-xs text-slate-600">{selectedOrder.customer_name || selectedOrder.customer_email}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="outline">{selectedColumn ? getColumnConfig(selectedColumn).label : "-"}</Badge>
                  <Badge variant="outline">{selectedOrder.item_count} itens</Badge>
                  <Badge variant="outline">{formatMoney(selectedOrder.total_amount_cents)}</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">SLA em tempo real</p>
                {selectedColumn ? (
                  <>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                      <span>Tempo na etapa</span>
                      <span>{minutesSince(nowMs, selectedOrder.updated_at || selectedOrder.created_at)} min</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-cyan-600"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((minutesSince(nowMs, selectedOrder.updated_at || selectedOrder.created_at) / getColumnConfig(selectedColumn).slaMinutes) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Limite SLA: {getColumnConfig(selectedColumn).slaMinutes} min</p>
                  </>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Dados operacionais</p>
                <div className="space-y-1 text-xs text-slate-700">
                  <p>Canal: <span className="font-medium">{selectedOrder.sales_channel || "-"}</span></p>
                  <p>Marketplace: <span className="font-medium">{selectedOrder.marketplace || "-"}</span></p>
                  <p>Transportadora: <span className="font-medium">{selectedOrder.carrier_name || "-"}</span></p>
                  <p>Operador ultimo scan: <span className="font-medium">{selectedOrder.operator_email || "-"}</span></p>
                  <p>Conferencia: <span className="font-medium">{Math.round((selectedOrder.scan_completion_ratio || 0) * 100)}%</span></p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</p>
                <ul className="space-y-2 text-xs text-slate-700">
                  <li className="rounded border border-slate-200 p-2">
                    <p className="font-medium">Pedido recebido</p>
                    <p className="text-slate-500">{formatDateTime(selectedOrder.created_at)}</p>
                  </li>
                  <li className="rounded border border-slate-200 p-2">
                    <p className="font-medium">Ultima movimentacao</p>
                    <p className="text-slate-500">{formatDateTime(selectedOrder.updated_at)}</p>
                  </li>
                  <li className="rounded border border-slate-200 p-2">
                    <p className="font-medium">Ultimo scan</p>
                    <p className="text-slate-500">{formatDateTime(selectedOrder.last_scan_at)}</p>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Wave sugerida</p>
                <p className="text-xs text-slate-700">
                  {`${selectedOrder.shipping_state || "UF"}-${selectedOrder.sales_channel || "canal"}`.toUpperCase()}
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      <Dialog
        open={scanDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setScanDialogOpen(false);
            setScanOrderId(null);
            setScanSummary(null);
            setScanCode("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> Conferencia por barcode
            </DialogTitle>
            <DialogDescription>Escaneie SKU/barcode antes de mover para Expedicao.</DialogDescription>
          </DialogHeader>

          {scanSummary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Necessario</p><p className="font-semibold">{scanSummary.total_required_qty}</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Conferido</p><p className="font-semibold">{scanSummary.total_scanned_qty}</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Faltando</p><p className="font-semibold">{scanSummary.total_missing_qty}</p></div>
              </div>

              <div className="flex gap-2">
                <Input
                  ref={scanInputRef}
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  placeholder="Escaneie barcode ou SKU"
                  disabled={!canManageInventoryMovements}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!scanSubmitting && scanCode.trim()) {
                        void handleScanRegister();
                      }
                    }
                  }}
                />
                <Button type="button" disabled={scanSubmitting || !scanCode.trim() || !canManageInventoryMovements} onClick={() => void handleScanRegister()}>
                  {scanSubmitting ? "Registrando..." : "Registrar"}
                </Button>
              </div>

              <div className="max-h-64 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">SKU/Barcode</th>
                      <th className="px-3 py-2 text-right">Req.</th>
                      <th className="px-3 py-2 text-right">Conf.</th>
                      <th className="px-3 py-2 text-right">Falta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanSummary.items.map((item) => (
                      <tr key={item.order_item_id} className="border-t">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{item.sku || "-"} {item.barcode ? `| ${item.barcode}` : ""}</td>
                        <td className="px-3 py-2 text-right">{item.required_qty}</td>
                        <td className="px-3 py-2 text-right">{item.scanned_qty}</td>
                        <td className="px-3 py-2 text-right font-semibold">{item.missing_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScanDialogOpen(false)}>Fechar</Button>
            <Button type="button" disabled={!scanSummary?.is_complete || scanConcluding || !canManageInventoryMovements} onClick={() => void concludeScanAndMove()}>
              {scanConcluding ? "Movendo..." : "Concluir e mover para Expedicao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
