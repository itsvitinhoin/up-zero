"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MailCheck,
  MailOpen,
  Search,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePaginatedList } from "@/hooks/use-paginated-list";

type EmailDeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "OPENED" | "CLICKED" | "FAILED";

interface EmailTemplateSummary {
  id: string;
  name: string;
  triggerKey: string;
  active: boolean;
}

interface TemplateDeliveryMetrics {
  templateId: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

interface EmailDeliveryLog {
  id: string;
  templateId: string;
  recipientName: string;
  recipientEmail: string;
  status: EmailDeliveryStatus;
  sentAt: string;
  context: string;
  messageId: string;
  failureReason?: string;
}

const TEMPLATE_METRICS: TemplateDeliveryMetrics[] = [
  { templateId: "email-order-created", sent: 1248, delivered: 1219, opened: 712, clicked: 196, failed: 29 },
  { templateId: "email-payment-approved", sent: 987, delivered: 969, opened: 601, clicked: 174, failed: 18 },
  { templateId: "email-delivery-shipped", sent: 764, delivered: 751, opened: 505, clicked: 221, failed: 13 },
  { templateId: "email-registration-approved", sent: 342, delivered: 333, opened: 204, clicked: 86, failed: 9 },
  { templateId: "email-payment-pending", sent: 198, delivered: 190, opened: 101, clicked: 27, failed: 8 },
  { templateId: "email-cart-abandoned", sent: 145, delivered: 139, opened: 92, clicked: 38, failed: 6 },
];

const DELIVERY_LOGS: EmailDeliveryLog[] = [
  {
    id: "log-001",
    templateId: "email-order-created",
    recipientName: "Mariana Oliveira",
    recipientEmail: "mariana@useaurora.com.br",
    status: "OPENED",
    sentAt: "Hoje, 10:42",
    context: "Pedido #10482",
    messageId: "msg_upz_9f42a8",
  },
  {
    id: "log-002",
    templateId: "email-payment-approved",
    recipientName: "Camila Andrade",
    recipientEmail: "compras@camilaandrade.com.br",
    status: "DELIVERED",
    sentAt: "Hoje, 10:18",
    context: "Pedido #10481",
    messageId: "msg_upz_90bd31",
  },
  {
    id: "log-003",
    templateId: "email-delivery-shipped",
    recipientName: "Loja Donna",
    recipientEmail: "pedidos@lojadonna.com.br",
    status: "CLICKED",
    sentAt: "Hoje, 09:56",
    context: "Pedido #10479",
    messageId: "msg_upz_82ca77",
  },
  {
    id: "log-004",
    templateId: "email-order-created",
    recipientName: "Beatriz Martins",
    recipientEmail: "beatriz@bmstore.com.br",
    status: "SENT",
    sentAt: "Hoje, 09:31",
    context: "Pedido #10478",
    messageId: "msg_upz_716fc0",
  },
  {
    id: "log-005",
    templateId: "email-registration-approved",
    recipientName: "Fernanda Lopes",
    recipientEmail: "fernanda@closetlopes.com.br",
    status: "FAILED",
    sentAt: "Hoje, 09:12",
    context: "Cadastro #8391",
    messageId: "msg_upz_6d3b12",
    failureReason: "Caixa postal inexistente ou endereço digitado incorretamente.",
  },
  {
    id: "log-006",
    templateId: "email-payment-approved",
    recipientName: "Renata Costa",
    recipientEmail: "financeiro@renatacosta.com.br",
    status: "OPENED",
    sentAt: "Hoje, 08:47",
    context: "Pedido #10476",
    messageId: "msg_upz_5c91e4",
  },
  {
    id: "log-007",
    templateId: "email-cart-abandoned",
    recipientName: "Patricia Ribeiro",
    recipientEmail: "patricia@prconcept.com.br",
    status: "QUEUED",
    sentAt: "Hoje, 08:20",
    context: "Carrinho #AC-392",
    messageId: "msg_upz_4af128",
  },
  {
    id: "log-008",
    templateId: "email-delivery-shipped",
    recipientName: "Ana Clara Souza",
    recipientEmail: "ana@useanaclara.com.br",
    status: "DELIVERED",
    sentAt: "Ontem, 18:34",
    context: "Pedido #10473",
    messageId: "msg_upz_3eb779",
  },
  {
    id: "log-009",
    templateId: "email-payment-pending",
    recipientName: "Monica Freitas",
    recipientEmail: "monica@ateliermf.com.br",
    status: "FAILED",
    sentAt: "Ontem, 17:51",
    context: "Pedido #10471",
    messageId: "msg_upz_2c4d90",
    failureReason: "O servidor de destino recusou temporariamente a mensagem.",
  },
  {
    id: "log-010",
    templateId: "email-order-created",
    recipientName: "Juliana Nogueira",
    recipientEmail: "juliana@lojanogueira.com.br",
    status: "CLICKED",
    sentAt: "Ontem, 16:29",
    context: "Pedido #10469",
    messageId: "msg_upz_198b7e",
  },
  {
    id: "log-011",
    templateId: "email-registration-approved",
    recipientName: "Carolina Mendes",
    recipientEmail: "carol@mundomendes.com.br",
    status: "OPENED",
    sentAt: "Ontem, 15:46",
    context: "Cadastro #8378",
    messageId: "msg_upz_0f3a67",
  },
  {
    id: "log-012",
    templateId: "email-payment-approved",
    recipientName: "Sofia Barros",
    recipientEmail: "sofia@sbmultimarcas.com.br",
    status: "DELIVERED",
    sentAt: "Ontem, 14:11",
    context: "Pedido #10464",
    messageId: "msg_upz_f2d114",
  },
];

const STATUS_CONFIG: Record<EmailDeliveryStatus, { label: string; className: string }> = {
  QUEUED: { label: "Na fila", className: "border-slate-200 bg-slate-50 text-slate-700" },
  SENT: { label: "Enviado", className: "border-sky-200 bg-sky-50 text-sky-700" },
  DELIVERED: { label: "Entregue", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  OPENED: { label: "Aberto", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  CLICKED: { label: "Clicado", className: "border-teal-200 bg-teal-50 text-teal-700" },
  FAILED: { label: "Falhou", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG) as Array<[
  EmailDeliveryStatus,
  (typeof STATUS_CONFIG)[EmailDeliveryStatus],
]>;

const numberFormatter = new Intl.NumberFormat("pt-BR");
const DELIVERY_LOGS_PAGE_SIZE = 5;

function percentage(value: number, total: number) {
  if (total === 0) return "0%";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format((value / total) * 100)}%`;
}

export function getEmailTemplateDeliverySummary(templateId: string) {
  return TEMPLATE_METRICS.find((item) => item.templateId === templateId)
    ?? { templateId, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
}

function DeliveryStatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", config.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </Badge>
  );
}

function DeliveryMetricCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  hint: string;
  iconClassName: string;
}) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{numberFormatter.format(value)}</p>
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", iconClassName)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function EmailDeliveryHistory({ templates }: { templates: EmailTemplateSummary[] }) {
  const [query, setQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState("ALL");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<EmailDeliveryStatus | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const totals = useMemo(() => TEMPLATE_METRICS.reduce(
    (result, current) => ({
      sent: result.sent + current.sent,
      delivered: result.delivered + current.delivered,
      opened: result.opened + current.opened,
      clicked: result.clicked + current.clicked,
      failed: result.failed + current.failed,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 },
  ), []);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return DELIVERY_LOGS.filter((log) => {
      const template = templates.find((item) => item.id === log.templateId);
      const matchesTemplate = templateFilter === "ALL" || log.templateId === templateFilter;
      const matchesStatus = deliveryStatusFilter === "ALL" || log.status === deliveryStatusFilter;
      const matchesQuery = !normalizedQuery || [
        log.recipientName,
        log.recipientEmail,
        log.messageId,
        log.context,
        template?.name ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesTemplate && matchesStatus && matchesQuery;
    });
  }, [deliveryStatusFilter, query, templateFilter, templates]);

  const {
    paginatedItems: paginatedLogs,
    totalPages,
    safeCurrentPage,
    pageStart,
    pageEnd,
  } = usePaginatedList({
    items: filteredLogs,
    currentPage,
    pageSize: DELIVERY_LOGS_PAGE_SIZE,
  });

  return (
    <div id="email-history" className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900">Prévia do acompanhamento de envios</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-800/80">
            Os dados abaixo são demonstrativos até a integração com o provedor transacional.
          </p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 border-amber-300 bg-background/70 text-amber-800">
          Dados demonstrativos
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DeliveryMetricCard
          icon={Send}
          label="Enviados"
          value={totals.sent}
          hint="Total nos últimos 30 dias"
          iconClassName="bg-primary/10 text-primary"
        />
        <DeliveryMetricCard
          icon={MailCheck}
          label="Entregues"
          value={totals.delivered}
          hint={`${percentage(totals.delivered, totals.sent)} dos envios`}
          iconClassName="bg-emerald-100 text-emerald-700"
        />
        <DeliveryMetricCard
          icon={MailOpen}
          label="Abertos"
          value={totals.opened}
          hint={`${percentage(totals.opened, totals.delivered)} das entregas`}
          iconClassName="bg-indigo-100 text-indigo-700"
        />
        <DeliveryMetricCard
          icon={AlertTriangle}
          label="Falhas"
          value={totals.failed}
          hint={`${percentage(totals.failed, totals.sent)} dos envios`}
          iconClassName="bg-rose-100 text-rose-700"
        />
      </div>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="p-4 sm:p-5">
          <CardTitle className="text-base">Desempenho por modelo</CardTitle>
          <CardDescription className="mt-1">Compare quantos e-mails avançaram em cada status nos últimos 30 dias.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0 lg:grid-cols-2 sm:p-5 sm:pt-0">
          {templates.map((template) => {
            const metrics = getEmailTemplateDeliverySummary(template.id);
            return (
              <div key={template.id} className="rounded-2xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight">{template.name}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{template.triggerKey}</p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "shrink-0",
                    template.active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-border bg-muted/60 text-muted-foreground",
                  )}>
                    {template.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-b border-border/60 pb-4">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight">{numberFormatter.format(metrics.sent)}</p>
                    <p className="text-xs text-muted-foreground">e-mails enviados</p>
                  </div>
                  <p className="text-right text-xs text-muted-foreground">
                    <span className="block font-semibold text-emerald-700">{percentage(metrics.delivered, metrics.sent)}</span>
                    taxa de entrega
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 px-2 py-2.5">
                    <p className="text-sm font-semibold text-emerald-700">{numberFormatter.format(metrics.delivered)}</p>
                    <p className="mt-0.5 text-[10px] text-emerald-700/80">Entregues</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 px-2 py-2.5">
                    <p className="text-sm font-semibold text-indigo-700">{numberFormatter.format(metrics.opened)}</p>
                    <p className="mt-0.5 text-[10px] text-indigo-700/80">Abertos</p>
                  </div>
                  <div className="rounded-xl bg-teal-50 px-2 py-2.5">
                    <p className="text-sm font-semibold text-teal-700">{numberFormatter.format(metrics.clicked)}</p>
                    <p className="mt-0.5 text-[10px] text-teal-700/80">Clicados</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 px-2 py-2.5">
                    <p className="text-sm font-semibold text-rose-700">{numberFormatter.format(metrics.failed)}</p>
                    <p className="mt-0.5 text-[10px] text-rose-700/80">Falhas</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-base">Histórico de envios</CardTitle>
              <CardDescription className="mt-1">Acompanhe o status mais recente de cada mensagem transacional.</CardDescription>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto">
              <div className="relative sm:min-w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar destinatário..."
                  className="min-h-11 rounded-xl pl-9"
                  aria-label="Buscar no histórico de envios"
                />
              </div>
              <Select
                value={templateFilter}
                onValueChange={(value) => {
                  setTemplateFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="min-h-11 w-full rounded-xl" aria-label="Filtrar por modelo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os modelos</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={deliveryStatusFilter}
                onValueChange={(value) => {
                  setDeliveryStatusFilter(value as EmailDeliveryStatus | "ALL");
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="min-h-11 w-full rounded-xl" aria-label="Filtrar por status do envio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os status</SelectItem>
                  {STATUS_OPTIONS.map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{filteredLogs.length} envios encontrados</span>
            <span>Últimos 30 dias</span>
          </div>
          {paginatedLogs.length > 0 ? paginatedLogs.map((log) => {
            const template = templates.find((item) => item.id === log.templateId);
            return (
              <div key={log.id} className="rounded-2xl border border-border/60 p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    log.status === "FAILED" ? "bg-rose-100 text-rose-700" : "bg-primary/10 text-primary",
                  )}>
                    {log.status === "FAILED" ? <AlertTriangle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-tight">{log.recipientName}</p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{log.recipientEmail}</p>
                      </div>
                      <DeliveryStatusBadge status={log.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{template?.name ?? "Modelo removido"}</span>
                      <span className="flex items-center gap-1.5"><Clock3 className="h-3 w-3" /> {log.sentAt}</span>
                      <span>{log.context}</span>
                    </div>
                    <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground/80">ID: {log.messageId}</p>
                    {log.failureReason ? (
                      <div className="mt-3 flex gap-2 rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2.5 text-xs leading-5 text-rose-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{log.failureReason}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 font-medium">Nenhum envio encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros para consultar outros registros.</p>
            </div>
          )}
          {filteredLogs.length > DELIVERY_LOGS_PAGE_SIZE ? (
            <div className="pt-2">
              <div className="rounded-xl border border-border/20 bg-card p-3 sm:hidden">
                <p className="text-center text-xs text-muted-foreground">
                  Mostrando <span className="font-medium text-foreground">{pageStart}-{pageEnd}</span> de{" "}
                  <span className="font-medium text-foreground">{filteredLogs.length}</span>
                </p>
                <div className="mt-3 grid grid-cols-[48px_1fr_48px] items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(safeCurrentPage - 1)}
                    disabled={safeCurrentPage <= 1}
                    className="h-12 w-12 rounded-xl"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <p className="text-center text-sm font-medium">
                    Página {safeCurrentPage} de {totalPages}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(safeCurrentPage + 1)}
                    disabled={safeCurrentPage >= totalPages}
                    className="h-12 w-12 rounded-xl"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="hidden sm:block [&_button]:h-11 [&_button]:min-w-11">
                <AdminPaginationControls
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  maxVisiblePages={3}
                  onPageChange={setCurrentPage}
                  showing={{ start: pageStart, end: pageEnd, total: filteredLogs.length }}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
