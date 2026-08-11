"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Customer,
  User,
  PriceTable,
  AuditLog,
  Order,
  PaymentMethod,
} from "@/lib/types";
import {
  approveCustomerAction,
  rejectCustomerAction,
  approveClientAction,
  rejectClientAction,
  updateCustomerAction,
  dispatchCustomerMessageAction,
  dispatchCustomerWebhookAction,
  type CustomerMessageTrigger,
  type CustomerWebhookEvent,
} from "@/lib/actions/customers";
import type { OnlineCustomerOfflineLink } from "@/lib/actions/offline";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/contexts/admin-store-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import IntegerInput from "@/components/form/IntegerInput";
import PercentageInput from "@/components/form/PercentageInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Building2,
  User as UserIcon,
  UserRoundPlus,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Tag,
  Percent,
  CreditCard,
  History,
  ShoppingCart,
  Loader2,
  Send,
  ChevronDown,
  Check,
  Minus,
  RefreshCw,
  Webhook,
  Store,
} from "lucide-react";

interface CustomerDetailProps {
  customer: Customer;
  user?: User;
  seller?: User;
  priceTable?: PriceTable;
  priceTables: PriceTable[];
  sellers: User[];
  auditLogs: AuditLog[];
  orders: Order[];
  canManage: boolean;
  offlineLink?: OnlineCustomerOfflineLink | null;
}

const statusMap: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "amber" | "emerald" | "rose" | "slate";
  }
> = {
  PENDING: { label: "Pendente", variant: "amber" },
  APPROVED: { label: "Aprovado", variant: "emerald" },
  REJECTED: { label: "Rejeitado", variant: "rose" },
};

const paymentMethodLabels: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  FATURADO: "Faturado",
  CARTAO_EXTERNO: "Cartão",
};

const customerTypeLabels: Record<string, string> = {
  RETAIL: "Varejo",
  WHOLESALE: "Atacado",
};

const customerTypeBadgeVariant: Record<string, "outline" | "sky" | "violet"> = {
  RETAIL: "sky",
  WHOLESALE: "violet",
};

const CUSTOMER_TRIGGER_LABELS: Record<CustomerMessageTrigger, string> = {
  CUSTOMER_REGISTERED: "Cadastro Realizado",
  CUSTOMER_APPROVED: "Cadastro Aprovado",
  CUSTOMER_REJECTED: "Cadastro Rejeitado",
  CUSTOMER_PASSWORD_RESET: "Recuperacao de Senha",
};

export function CustomerDetail({
  customer,
  user,
  seller,
  priceTable,
  priceTables,
  sellers,
  auditLogs,
  orders,
  canManage,
  offlineLink,
}: CustomerDetailProps) {
  const { session } = useAdminStore();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [communicationPanel, setCommunicationPanel] = useState<"message" | "webhook" | null>(null);
  const [messageTrigger, setMessageTrigger] = useState<CustomerMessageTrigger>("CUSTOMER_REGISTERED");
  const [messageChannel, setMessageChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [isDispatchingMessage, setIsDispatchingMessage] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string>("");
  const [dispatchPreview, setDispatchPreview] = useState<string>("");
  const [messageDispatchResultOpen, setMessageDispatchResultOpen] = useState(false);
  const [customerWebhookEvent, setCustomerWebhookEvent] = useState<CustomerWebhookEvent>("customer.updated");
  const [isWebhookDispatching, setIsWebhookDispatching] = useState(false);
  const [webhookDispatchMessage, setWebhookDispatchMessage] = useState<string | null>(null);
  const [webhookDispatchPayload, setWebhookDispatchPayload] = useState<unknown | null>(null);
  const [showWebhookResultDialog, setShowWebhookResultDialog] = useState(false);
  const [assignedSellerId, setAssignedSellerId] = useState(
    customer.assignedSellerId || "",
  );
  const [assignedSellerName, setAssignedSellerName] = useState(
    seller?.name || customer.assignedSellerName || "",
  );

  // Form state
  const [formData, setFormData] = useState({
    priceTableId: customer.priceTableId || "default",
    minPiecesOverride: customer.minPiecesOverride?.toString() || "",
    extraDiscountPct: customer.extraDiscountPct?.toString() || "",
    assignedSellerId: customer.assignedSellerId || "default",
    paymentTerms: customer.paymentTerms,
  });

  const [receitawsLoading, setReceitawsLoading] = useState(false);
  const [receitawsError, setReceitawsError] = useState<string | null>(null);
  const normalizedPermissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes
        .map((code) => String(code || "").trim().toLowerCase())
        .filter(Boolean)
    : null;
  const hasPermissionContext = Array.isArray(session?.permissionCodes);
  const isSystemRole = session?.isSystemRole === true;
  const canAssignSellerPermission = Array.isArray(normalizedPermissionCodes)
    ? normalizedPermissionCodes.includes("customers.assign_seller")
    : false;
  const canManageCustomer = canManage && (
    isSystemRole
      || !hasPermissionContext
      || normalizedPermissionCodes.includes("customers.edit")
  );
  const canAssignSellerInViewer = canManage && (
    isSystemRole
      || (hasPermissionContext && canAssignSellerPermission)
  );
  const canSendMessages = normalizedPermissionCodes === null
    ? true
    : normalizedPermissionCodes.includes("messaging.send");

  const status = statusMap[customer.status];
  const isRetail = customer.customerType === "RETAIL";
  const customFields = customer.customFields ?? [];

  const normalizeHeaderText = (value: string | null | undefined) =>
    String(value || "").trim().toLocaleLowerCase("pt-BR");

  const headerTitle =
    customer.tradeName?.trim() ||
    customer.companyName?.trim() ||
    customer.contactName?.trim() ||
    customer.email?.trim() ||
    "Cliente";

  const headerSubtitle = [customer.companyName, customer.contactName, customer.email]
    .map((value) => String(value || "").trim())
    .find(
      (value) =>
        value.length > 0 && normalizeHeaderText(value) !== normalizeHeaderText(headerTitle),
    );

  const renderCustomFieldValue = (value: unknown): ReactNode => {
    if (value === null || value === undefined) return "-";

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "-";

      if (/^https?:\/\//i.test(trimmed)) {
        return (
          <a
            href={trimmed}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline break-all"
          >
            {trimmed}
          </a>
        );
      }

      return <span className="wrap-break-word">{trimmed}</span>;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value) && value.length === 0) {
      return "-";
    }

    try {
      return <span className="wrap-break-word">{JSON.stringify(value)}</span>;
    } catch {
      return String(value);
    }
  };

  const handleApprove = () => {
    startTransition(async () => {
      const action = isRetail ? approveClientAction : approveCustomerAction;
      await action(customer.id);
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const action = isRetail ? rejectClientAction : rejectCustomerAction;
      await action(customer.id);
      router.refresh();
    });
  };

  const handleUpdate = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("priceTableId", formData.priceTableId);
      fd.set("minPiecesOverride", formData.minPiecesOverride);
      fd.set("extraDiscountPct", formData.extraDiscountPct);
      if (canAssignSellerInViewer) {
        fd.set("assignedSellerId", formData.assignedSellerId);
      }
      fd.set("paymentTerms", JSON.stringify(formData.paymentTerms));

      await updateCustomerAction(customer.id, fd);
      setShowEditDialog(false);
      router.refresh();
    });
  };

  const handleDispatchCustomerWebhook = async () => {
    setIsWebhookDispatching(true);
    setWebhookDispatchMessage(null);

    const result = await dispatchCustomerWebhookAction(String(customer.id), customerWebhookEvent);

    if (result.success && result.data) {
      const response = result.data;
      setWebhookDispatchMessage(response.message || `Evento ${response.event} enviado com sucesso`);
      setWebhookDispatchPayload(response.payload ?? null);
    } else {
      setWebhookDispatchMessage(result.error || "Erro ao disparar webhook");
      setWebhookDispatchPayload(null);
    }

    setShowWebhookResultDialog(true);
    setIsWebhookDispatching(false);
  };

  const handleDispatchCustomerMessage = async () => {
    if (!canSendMessages) {
      setDispatchFeedback("Você não tem permissão para enviar mensagens");
      return;
    }

    setIsDispatchingMessage(true);
    setDispatchFeedback("");

    const result = await dispatchCustomerMessageAction(String(customer.id), {
      trigger: messageTrigger,
      channel: messageChannel,
    });

    if (!result.success || !result.data) {
      setDispatchFeedback(result.error || "Nao foi possivel disparar a mensagem do cliente");
      setIsDispatchingMessage(false);
      return;
    }

    setDispatchPreview(result.data.renderedMessage || "");
    setDispatchFeedback(`${result.data.message} (${result.data.recipient})`);
    setShowWebhookResultDialog(false);
    setMessageDispatchResultOpen(true);

    if (result.data.whatsappUrl) {
      window.open(result.data.whatsappUrl, "_blank", "noopener,noreferrer");
    }

    setIsDispatchingMessage(false);
  };

  const handleAssignSeller = (sellerId: string) => {
    if (!canAssignSellerInViewer) {
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("assignedSellerId", sellerId);
      const result = await updateCustomerAction(customer.id, fd);

      if (!result.success) {
        toast.error(result.error || "Erro ao salvar vendedora responsável");
        return;
      }

      const selectedSeller = sellers.find((item) => item.id === sellerId);
      const nextSellerId = result.data?.assignedSellerId || sellerId || "";
      const nextSellerName =
        result.data?.assignedSellerName
        || selectedSeller?.name
        || "";
      setAssignedSellerId(nextSellerId);
      setAssignedSellerName(nextSellerName);
      setFormData((prev) => ({
        ...prev,
        assignedSellerId: nextSellerId || "default",
      }));
      toast.success(
        nextSellerId
          ? "Vendedora responsável atualizada"
          : "Vendedora responsável removida",
      );
      router.refresh();
    });
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join("");

  const togglePaymentMethod = (method: PaymentMethod) => {
    setFormData((prev) => ({
      ...prev,
      paymentTerms: prev.paymentTerms.includes(method)
        ? prev.paymentTerms.filter((m) => m !== method)
        : [...prev.paymentTerms, method],
    }));
  };

  const handleUpdateReceitaWS = async () => {
    setReceitawsLoading(true);
    setReceitawsError(null);
    try {
      const result = await updateCustomerWithReceitaWSAction(customer.id);
      if (result.success) {
        router.refresh();
        setReceitawsError(null);
      } else {
        setReceitawsError(result.error || "Erro ao atualizar dados");
      }
    } catch (error) {
      setReceitawsError(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setReceitawsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={messageDispatchResultOpen} onOpenChange={setMessageDispatchResultOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Disparo de Mensagem ao Cliente</DialogTitle>
            <DialogDescription>{dispatchFeedback || "Mensagem processada."}</DialogDescription>
          </DialogHeader>

          {dispatchPreview ? (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conteudo enviado
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 wrap-break-word">
                {dispatchPreview}
              </pre>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setMessageDispatchResultOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWebhookResultDialog} onOpenChange={setShowWebhookResultDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Disparo Manual de Webhook</DialogTitle>
            <DialogDescription>{webhookDispatchMessage || "Webhook processado."}</DialogDescription>
          </DialogHeader>

          {webhookDispatchPayload ? (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payload enviado
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 wrap-break-word">
                {JSON.stringify(webhookDispatchPayload, null, 2)}
              </pre>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setShowWebhookResultDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer
        direction="right"
        open={communicationPanel !== null}
        onOpenChange={(open) => !open && setCommunicationPanel(null)}
      >
        <DrawerContent className="w-full sm:max-w-xl">
          <DrawerHeader className="border-b border-border/20 px-5 py-4 text-left">
            <DrawerTitle>
              <span className="inline-flex items-center gap-2">
                {communicationPanel === "message" ? (
                  <Send className="h-4 w-4 text-primary" />
                ) : (
                  <Webhook className="h-4 w-4 text-primary" />
                )}
                {communicationPanel === "message" ? "Disparo de Mensagem ao Cliente" : "Disparo Manual de Webhook"}
              </span>
            </DrawerTitle>
            <DrawerDescription className="mt-1">
              {communicationPanel === "message"
                ? "Selecione trigger e canal para enviar usando o template ativo da mensageria."
                : "Dispare manualmente o evento de webhook do cliente usando o fluxo padrão do backend."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {communicationPanel === "message" ? (
              <Card className="rounded-xl border-border/30 shadow-none">
                <CardContent className="space-y-4 pt-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Trigger</Label>
                      <Select value={messageTrigger} onValueChange={(value) => setMessageTrigger(value as CustomerMessageTrigger)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CUSTOMER_TRIGGER_LABELS).map(([trigger, label]) => (
                            <SelectItem key={trigger} value={trigger}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Canal</Label>
                      <Select value={messageChannel} onValueChange={(value) => setMessageChannel(value as "WHATSAPP" | "EMAIL")}>
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
                    <Button type="button" onClick={handleDispatchCustomerMessage} disabled={!canSendMessages || isDispatchingMessage}>
                      {isDispatchingMessage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {isDispatchingMessage ? "Disparando..." : "Disparar Mensagem"}
                    </Button>
                    {dispatchFeedback ? (
                      <p className="text-sm text-muted-foreground">{dispatchFeedback}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-xl border-border/30 shadow-none">
                <CardContent className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <Label>Evento</Label>
                    <Select
                      value={customerWebhookEvent}
                      onValueChange={(value) => setCustomerWebhookEvent(value as CustomerWebhookEvent)}
                    >
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Selecione o evento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer.created">customer.created</SelectItem>
                        <SelectItem value="customer.updated">customer.updated</SelectItem>
                        <SelectItem value="customer.approved">customer.approved</SelectItem>
                        <SelectItem value="customer.rejected">customer.rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleDispatchCustomerWebhook}
                      disabled={isWebhookDispatching}
                    >
                      {isWebhookDispatching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Webhook className="mr-2 h-4 w-4" />
                      )}
                      {isWebhookDispatching ? "Disparando..." : "Disparar Webhook"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 h-8 w-8 text-muted-foreground"
            asChild
          >
            <Link href="/customers">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-medium text-foreground leading-none">
              {headerTitle}
            </h1>
            {headerSubtitle && (
              <p className="mt-1.5 text-sm text-muted-foreground">{headerSubtitle}</p>
            )}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end sm:gap-3">
          <Badge
            variant={customerTypeBadgeVariant[customer.customerType || "WHOLESALE"] || "outline"}
            className="h-9 rounded-full px-4 text-sm font-medium"
          >
            {customerTypeLabels[customer.customerType || "WHOLESALE"]}
          </Badge>
          <Badge
            variant={status?.variant || "slate"}
            className="h-9 rounded-full px-4 text-sm font-medium"
          >
            {status.label}
          </Badge>
          {offlineLink ? (
            <Badge
              variant="outline"
              className="h-9 gap-1.5 rounded-full border-emerald-500/40 bg-emerald-500/5 px-4 text-sm font-medium text-emerald-700 dark:text-emerald-300"
              title={
                offlineLink.offlineSellerName
                  ? `Vendedora offline: ${offlineLink.offlineSellerName}`
                  : undefined
              }
            >
              <Store className="h-3.5 w-3.5" />
              Cliente vinculado offline
            </Badge>
          ) : null}

          {canAssignSellerInViewer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full min-w-0 justify-between font-normal text-muted-foreground sm:w-auto sm:min-w-50"
                >
                  <span className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    <span className="text-foreground font-medium">
                      {assignedSellerName || "Nenhuma"}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[320px] rounded-lg">
                <DropdownMenuLabel className="px-4 py-3 text-sm font-normal text-muted-foreground">
                  Vendedora responsável
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="gap-3 px-4 py-3 cursor-pointer"
                  onSelect={() => handleAssignSeller("")}
                >
                  <div className="h-8 w-8 text-xs rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="flex-1 text-sm font-medium">Nenhuma</span>
                  {!assignedSellerId && <Check className="h-4 w-4" />}
                </DropdownMenuItem>

                {sellers.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    className="gap-3 px-4 py-3 cursor-pointer"
                    onSelect={() => handleAssignSeller(item.id)}
                  >
                    <div className="h-8 w-8 text-xs rounded-full bg-muted flex items-center justify-center shrink-0 font-medium text-foreground">
                      {getInitials(item.name)}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium leading-tight">
                        {item.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.email}
                      </span>
                    </div>
                    {assignedSellerId === item.id && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canManageCustomer && customer.status === "PENDING" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={isPending}
                className="h-9 flex-1 gap-2 px-4 text-sm font-medium sm:flex-none"
              >
                <XCircle className="h-4 w-4 text-foreground" />
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isPending}
                className="h-9 flex-1 gap-2 px-4 text-sm font-medium sm:flex-none"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Aprovar
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="relative h-auto w-full flex-col items-stretch rounded-[15px] bg-primary/10 p-1 sm:h-12 sm:flex-row sm:justify-start sm:flex-nowrap sm:overflow-x-auto">
          <TabsTrigger
            value="info"
            className="relative z-10 h-10 w-full cursor-pointer justify-start px-4 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:h-full sm:w-auto sm:flex-none sm:shrink-0 sm:justify-center sm:whitespace-nowrap sm:px-5"
          >
            <UserIcon className="h-4 w-4" />
            <span>Informações</span>
          </TabsTrigger>
          <TabsTrigger
            value="commercial"
            className="relative z-10 h-10 w-full cursor-pointer justify-start px-4 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:h-full sm:w-auto sm:flex-none sm:shrink-0 sm:justify-center sm:whitespace-nowrap sm:px-5"
          >
            <CreditCard className="h-4 w-4" />
            <span>Condições Comerciais</span>
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="relative z-10 h-10 w-full cursor-pointer justify-start px-4 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:h-full sm:w-auto sm:flex-none sm:shrink-0 sm:justify-center sm:whitespace-nowrap sm:px-5"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Pedidos ({orders.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="relative z-10 h-10 w-full cursor-pointer justify-start px-4 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:h-full sm:w-auto sm:flex-none sm:shrink-0 sm:justify-center sm:whitespace-nowrap sm:px-5"
          >
            <History className="h-4 w-4" />
            <span>Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:grid-flow-row">
            {/* Left Column */}
            <div className="space-y-6">
              {!isRetail && (
                <Card className="border-border/20 shadow-none">
                  <CardHeader className="pb-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground/70" />
                      Dados da Empresa
                    </CardTitle>
                    {!customer.receitawsMeta && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUpdateReceitaWS}
                        disabled={receitawsLoading}
                        title="Buscar dados via ReceitaWS"
                      >
                        {receitawsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-2">ReceitaWS</span>
                      </Button>
                    )}
                  </CardHeader>
                  {receitawsError && (
                    <div className="px-6 py-2 bg-rose-50 border-b border-rose-200 rounded-t">
                      <p className="text-xs text-rose-700">{receitawsError}</p>
                    </div>
                  )}
                  <CardContent className="space-y-6 text-sm">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          Razao Social
                        </h3>
                        <p className="font-medium">
                          {customer.companyName || "nao informada"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          Nome Fantasia
                        </h3>
                        <p className="font-medium">
                          {customer.tradeName || "nao informada"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          CNPJ
                        </h3>
                        <p className="font-medium">{customer.cnpj}</p>
                      </div>
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          Inscricao Estadual
                        </h3>
                        <p className="font-medium">
                          {customer.stateRegistration || "nao informada"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs text-muted-foreground mb-1">
                        Segmento
                      </h3>
                      <p className="font-medium">
                        {customer.segment || "Multimarcas"}
                      </p>
                    </div>

                    <div className="relative pt-4">
                      <div
                        className="absolute inset-0 flex items-center"
                        aria-hidden="true"
                      >
                        <div className="w-full border-t border-border/40"></div>
                      </div>
                    </div>

                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider -mt-2">
                      Dados da Receita Federal
                    </h4>

                    {!customer.receitawsMeta ? (
                      <p className="text-xs text-muted-foreground italic">
                        Clique em ReceitaWS para buscar os dados da empresa.
                      </p>
                    ) : (() => {
                      const rw = customer.receitawsMeta.data as Record<string, unknown>
                      const atividadePrincipal = Array.isArray(rw.atividade_principal)
                        ? (rw.atividade_principal as Array<Record<string, string>>)[0]
                        : null
                      const simplesOptante =
                        rw.simples && typeof rw.simples === 'object'
                          ? (rw.simples as Record<string, unknown>).optante === true
                          : false
                      const meiOptante =
                        rw.mei && typeof rw.mei === 'object'
                          ? (rw.mei as Record<string, unknown>).optante === true
                          : false
                      const capitalFormatted = rw.capital_social
                        ? Number(String(rw.capital_social).replace(',', '.')).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        : null

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h3 className="text-xs text-muted-foreground mb-1">
                                CNAE Principal
                              </h3>
                              <p className="font-medium">
                                {atividadePrincipal?.code || '—'}
                              </p>
                            </div>
                            <div>
                              <h3 className="text-xs text-muted-foreground mb-1">
                                Descricao
                              </h3>
                              <p className="font-medium">
                                {atividadePrincipal?.text || '—'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h3 className="text-xs text-muted-foreground mb-1">
                                Natureza Juridica
                              </h3>
                              <p className="font-medium">
                                {String(rw.natureza_juridica || '—')}
                              </p>
                            </div>
                            <div>
                              <h3 className="text-xs text-muted-foreground mb-1">
                                Capital Social
                              </h3>
                              <p className="font-medium whitespace-nowrap">
                                {capitalFormatted || '—'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <h3 className="text-xs text-muted-foreground mb-1">
                                Porte
                              </h3>
                              <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold text-foreground">
                                {String(rw.porte || '—')}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-xs text-muted-foreground mb-1">
                                Situacao
                              </h3>
                              <span className="inline-flex items-center rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                                {String(rw.situacao || '—')}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-xs text-muted-foreground mb-1">
                                Data Abertura
                              </h3>
                              <p className="font-medium">
                                {String(rw.abertura || '—')}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-6 mt-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${simplesOptante ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                              ></div>
                              <span
                                className={`text-sm font-medium ${simplesOptante ? '' : 'text-muted-foreground'}`}
                              >
                                Simples Nacional
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${meiOptante ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                              ></div>
                              <span
                                className={`text-sm font-medium ${meiOptante ? '' : 'text-muted-foreground'}`}
                              >
                                MEI
                              </span>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Address */}
              <Card className="border-border/20 shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground/70" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-medium leading-relaxed">
                  <p>
                    {customer.street}, {customer.number}
                    {customer.complement && ` - ${customer.complement}`}
                  </p>
                  <p>{customer.neighborhood}</p>
                  <p>
                    {customer.city} / {customer.state}
                  </p>
                  <p>CEP: {customer.zipCode}</p>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Contact Info */}
              <Card className="border-border/20 shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground/70" />
                    {isRetail ? "Dados do Cliente" : "Contato"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <h3 className="text-xs text-muted-foreground mb-1">
                      {isRetail ? "Nome" : "Nome do Contato"}
                    </h3>
                    <p className="font-medium">
                      {customer.contactName || customer.companyName}
                    </p>
                  </div>
                  {isRetail && (
                    <div>
                      <h3 className="text-xs text-muted-foreground mb-1">CPF</h3>
                      <p className="font-medium">{customer.cnpj}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-foreground">
                    <Phone className="h-4 w-4 text-muted-foreground/70" />
                    <p className="font-medium">{customer.phone}</p>
                  </div>
                  <div className="flex items-center gap-3 text-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground/70" />
                    <p className="font-medium">{customer.email}</p>
                  </div>
                  <div className="pt-2 border-t border-border/20 flex flex-wrap items-center gap-4">
                    {canSendMessages ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs font-medium text-primary inline-flex items-center gap-1.5"
                        onClick={() => setCommunicationPanel("message")}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Disparo de Mensagem ao Cliente
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs font-medium text-primary inline-flex items-center gap-1.5"
                      onClick={() => setCommunicationPanel("webhook")}
                    >
                      <Webhook className="h-3.5 w-3.5" />
                      Disparo Manual de Webhook
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {customFields.length > 0 && (
                <Card className="border-border/20 shadow-none">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <UserRoundPlus className="h-4 w-4 text-muted-foreground/70" />
                      Dados Customizados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    {customFields.map((field) => (
                      <div key={field.id}>
                        <h3 className="text-xs text-muted-foreground mb-1">{field.label}</h3>
                        <p className="font-medium">{renderCustomFieldValue(field.value)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Account Info */}
              <Card className="border-border/20 shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground/70" />
                    Informacoes da Conta
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col h-full space-y-6 text-sm">
                  <div className="space-y-4 flex-1">
                    <div>
                      <h3 className="text-xs text-muted-foreground mb-1">
                        Cadastrado em
                      </h3>
                      <p className="font-medium">
                        {new Date(customer.createdAt).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          },
                        )}
                      </p>
                    </div>
                    {!isRetail && (
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          Vendedora Responsavel
                        </h3>
                        <p className="font-medium">{assignedSellerName || "-"}</p>
                      </div>
                    )}
                    {offlineLink ? (
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          Vínculo offline
                        </h3>
                        <p className="font-medium">
                          {offlineLink.offlineName || "Cliente ERP"}
                        </p>
                        {offlineLink.offlineSellerName ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Vendedora loja: {offlineLink.offlineSellerName}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-4 mt-auto">
                    <div
                      className="w-full border-t border-border/40 mb-4 -mx-6 px-6"
                      style={{ width: "calc(100% + 48px)" }}
                    ></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          Total de Pedidos
                        </h3>
                        <p className="text-base font-bold">{orders.length}</p>
                      </div>
                      <div>
                        <h3 className="text-xs text-muted-foreground mb-1">
                          Total em Compras
                        </h3>
                        <p className="text-base font-bold">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(
                            orders.reduce(
                              (acc, order) =>
                                acc + Number(order.total || 0),
                              0,
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Commercial Tab */}
        <TabsContent value="commercial" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Condições Comerciais</h2>
            {canManageCustomer && (
              <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogTrigger asChild>
                  <Button>Editar Condições</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Condições Comerciais</DialogTitle>
                    <DialogDescription>
                      Configure as condições comerciais para este cliente
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Regra de Preço</Label>
                      <Select
                        value={formData.priceTableId}
                        onValueChange={(v) =>
                          setFormData((prev) => ({ ...prev, priceTableId: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma tabela" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            Nenhuma (Preço Base)
                          </SelectItem>
                          {priceTables.map((pt) => (
                            <SelectItem key={pt.id} value={pt.id}>
                              {pt.name}{" "}
                              {pt.percentage ? `(${pt.percentage}%)` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Mínimo de Peças (Override)</Label>
                      <IntegerInput
                        value={
                          formData.minPiecesOverride === ""
                            ? null
                            : Number(formData.minPiecesOverride)
                        }
                        onChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            minPiecesOverride:
                              value == null ? "" : String(value),
                          }))
                        }
                        placeholder="Usar padrão do sistema"
                        min={0}
                        fullWidth
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Desconto Adicional (%)</Label>
                      <PercentageInput
                        value={
                          formData.extraDiscountPct === ""
                            ? null
                            : Number(formData.extraDiscountPct) / 100
                        }
                        onChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            extraDiscountPct:
                              value == null
                                ? ""
                                : String(Number((value * 100).toFixed(2))),
                          }))
                        }
                        placeholder="0"
                        min={0}
                        max={100}
                      />
                    </div>

                    {canAssignSellerInViewer ? (
                      <div className="space-y-2">
                        <Label>Vendedora Responsável</Label>
                        <Select
                          value={formData.assignedSellerId}
                          onValueChange={(v) =>
                            setFormData((prev) => ({
                              ...prev,
                              assignedSellerId: v,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma vendedora" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Nenhuma</SelectItem>
                            {sellers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label>Formas de Pagamento</Label>
                      <div className="space-y-2">
                        {(
                          [
                            "PIX",
                            "BOLETO",
                            "FATURADO",
                            "CARTAO_EXTERNO",
                          ] as PaymentMethod[]
                        ).map((method) => (
                          <div key={method} className="flex items-center gap-2">
                            <Checkbox
                              id={method}
                              checked={formData.paymentTerms.includes(method)}
                              onCheckedChange={() =>
                                togglePaymentMethod(method)
                              }
                            />
                            <Label
                              htmlFor={method}
                              className="font-normal cursor-pointer"
                            >
                              {paymentMethodLabels[method]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowEditDialog(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleUpdate} disabled={isPending}>
                      {isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/20 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Regra de Preço
                </CardTitle>
              </CardHeader>
              <CardContent>
                {priceTable ? (
                  <div>
                    <p className="text-lg font-medium">{priceTable.name}</p>
                    {priceTable.percentage && (
                      <p className="text-muted-foreground">
                        {priceTable.percentage > 0 ? "+" : ""}
                        {priceTable.percentage}% sobre o preço base
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Preço base (sem tabela específica)
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/20 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Descontos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Mínimo de peças:
                  </span>
                  <span className="font-medium">
                    {customer.minPiecesOverride || "Padrão do sistema"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Desconto adicional:
                  </span>
                  <span className="font-medium">
                    {customer.extraDiscountPct
                      ? `${customer.extraDiscountPct}%`
                      : "Nenhum"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/20 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Formas de Pagamento Habilitadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {customer.paymentTerms.map((method) => (
                    <Badge key={method} variant="outline">
                      {paymentMethodLabels[method]}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Pedidos do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum pedido realizado
                </p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          Pedido #{order.code?.trim() || order.id.slice(-6)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString(
                            "pt-BR",
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(order.total)}
                        </p>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma alteração registrada
                </p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 rounded-lg border"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {log.action.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
