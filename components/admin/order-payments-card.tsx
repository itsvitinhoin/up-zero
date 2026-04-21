"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, CreditCard, RefreshCw, CheckCircle, Eye } from "lucide-react";
import { 
  getOrderPaymentsAction, 
  retryOrderPaymentAction,
  updateOrderAction,
} from "@/lib/actions/orders";
import { PaymentMethodDetails } from "./payment-method-details";

type OrderPaymentEventResponse = {
  id: number;
  event_type: string;
  event_source: string | null;
  payload_json: Record<string, unknown> | null;
  occurred_at: string | null;
  created_at: string;
};

type OrderPaymentResponse = {
  id: number;
  order_id: number;
  store_id: number | null;
  provider: string | null;
  status: string;
  amount_cents: number;
  gateway_transaction_id: string | null;
  gateway_reference: string | null;
  payment_code: string | null;
  payment_label: string | null;
  authorized_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  events: OrderPaymentEventResponse[];
};

interface OrderPaymentsCardProps {
  orderId: string
  paymentStatus?: string | null
}

type RetryPaymentMethod = "PIX" | "BOLETO";

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", icon: <AlertCircle className="h-3 w-3" /> },
  AUTHORIZED: { bg: "bg-blue-100", text: "text-blue-800", icon: <CheckCircle className="h-3 w-3" /> },
  PAID: { bg: "bg-green-100", text: "text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  PARTIALLY_PAID: { bg: "bg-blue-100", text: "text-blue-800", icon: <AlertCircle className="h-3 w-3" /> },
  FAILED: { bg: "bg-red-100", text: "text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
  CANCELLED: { bg: "bg-gray-100", text: "text-gray-800", icon: <AlertCircle className="h-3 w-3" /> },
  REFUNDED: { bg: "bg-purple-100", text: "text-purple-800", icon: <AlertCircle className="h-3 w-3" /> },
  CHARGEBACK: { bg: "bg-red-100", text: "text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
};

function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Aguardando",
    AUTHORIZED: "Autorizado",
    PAID: "Pago",
    PARTIALLY_PAID: "Parcialmente Pago",
    FAILED: "Falhou",
    CANCELLED: "Cancelado",
    REFUNDED: "Reembolsado",
    CHARGEBACK: "Disputa",
  };
  return labels[status] || status;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    return date.toLocaleString("pt-BR");
  } catch {
    return isoString;
  }
}

function getGatewayChargeCreatedEvent(payment: OrderPaymentResponse) {
  return payment.events.find(
    (event) => event.event_type === "GATEWAY_CHARGE_CREATED" && !!event.payload_json
  );
}

function inferPaymentTypeFromPayload(payload: Record<string, unknown> | null): string {
  if (!payload || typeof payload !== "object") return "";

  const methodId = String((payload as Record<string, unknown>).payment_method_id || "")
    .trim()
    .toLowerCase();
  const typeId = String((payload as Record<string, unknown>).payment_type_id || "")
    .trim()
    .toLowerCase();

  if (methodId === "pix" || typeId === "bank_transfer") return "PIX";
  if (
    methodId === "bolbradesco" ||
    methodId === "pec" ||
    methodId === "brazilbankticket" ||
    typeId === "ticket"
  ) {
    return "Boleto";
  }

  if (methodId) return methodId.toUpperCase();
  if (typeId) return typeId.toUpperCase();
  return "";
}

function getPaymentTypeLabel(payment: OrderPaymentResponse): string {
  const label = String(payment.payment_label || "").trim();
  if (label) return label;

  const code = String(payment.payment_code || "").trim().toUpperCase();
  if (code === "PIX") return "PIX";
  if (code === "BOLETO" || code === "TICKET") return "Boleto";
  if (code) return code;

  const gatewayEvent = getGatewayChargeCreatedEvent(payment);
  const inferred = inferPaymentTypeFromPayload(gatewayEvent?.payload_json || null);
  return inferred || "-";
}

export default function OrderPaymentsCard({
  orderId,
  paymentStatus,
}: OrderPaymentsCardProps) {
  const [payments, setPayments] = useState<OrderPaymentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedRetryMethod, setSelectedRetryMethod] = useState<RetryPaymentMethod>("PIX");
  const [selectedPayment, setSelectedPayment] = useState<OrderPaymentResponse | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [orderId]);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    const result = await getOrderPaymentsAction(orderId);
    if (result.success && result.data) {
      setPayments(result.data);
    } else {
      setError(result.error || "Erro ao carregar pagamentos");
      setPayments([]);
    }
    setLoading(false);
  }

  async function handleGeneratePayment() {
    setRetrying(true);
    setError(null);

    const updateMethodResult = await updateOrderAction(orderId, {
      paymentMethod: selectedRetryMethod,
    });

    if (!updateMethodResult.success) {
      setError(updateMethodResult.error || "Erro ao atualizar tipo de pagamento do pedido");
      setRetrying(false);
      return;
    }

    const result = await retryOrderPaymentAction(orderId);
    if (result.success) {
      setGenerateModalOpen(false);
      await loadPayments();
    } else {
      setError(result.error || "Erro ao Gerar Pagamento");
    }
    setRetrying(false);
  }

  function handleOpenPaymentDetails(payment: OrderPaymentResponse) {
    setSelectedPayment(payment);
    setDetailsModalOpen(true);
  }

  const latestPayment = payments.length > 0 ? payments[0] : null;
  const canRetry = !latestPayment || latestPayment.status === "FAILED" || !paymentStatus || paymentStatus === "PENDING";

  return (
    <Card className="print:hidden rounded-xl border-border/20 shadow-none gap-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <CardTitle className="text-base">Gateway de Pagamento</CardTitle>
          </div>
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGenerateModalOpen(true)}
              disabled={retrying}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Gerando..." : "Gerar Pagamento"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border/20 pt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando dados de pagamento...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : payments.length === 0 ? (
          <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-900">Nenhuma tentativa de pagamento registrada</p>
            <p className="text-xs text-yellow-800">
              Se o pedido foi iniciado mas o pagamento não foi processado, clique em "Gerar Pagamento" acima.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Informação do gateway/provider */}
            {latestPayment && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Gateway/Provider</p>
                    <p className="text-sm font-medium">{latestPayment.provider || "Não informado"}</p>
                  </div>
                  <Badge
                    className={`${
                      PAYMENT_STATUS_COLORS[latestPayment.status]?.bg ||
                      "bg-gray-100"
                    } ${
                      PAYMENT_STATUS_COLORS[latestPayment.status]?.text ||
                      "text-gray-800"
                    }`}
                  >
                    {getPaymentStatusLabel(latestPayment.status)}
                  </Badge>
                </div>

                {/* Informações específicas do pagamento */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Tipo de pagamento:</span>
                    <p className="font-semibold">{getPaymentTypeLabel(latestPayment)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor:</span>
                    <p className="font-semibold">{formatCurrency(latestPayment.amount_cents)}</p>
                  </div>
                  {latestPayment.payment_code && (
                    <div>
                      <span className="text-muted-foreground">Código:</span>
                      <p className="font-mono text-xs break-all">{latestPayment.payment_code}</p>
                    </div>
                  )}
                  {latestPayment.gateway_transaction_id && (
                    <div>
                      <span className="text-muted-foreground">ID Transação:</span>
                      <p className="font-mono text-xs break-all">{latestPayment.gateway_transaction_id}</p>
                    </div>
                  )}
                </div>

                {/* Timeline de datas importantes */}
                {(latestPayment.authorized_at || latestPayment.paid_at || latestPayment.failed_at) && (
                  <div className="pt-2 border-t border-border/20 space-y-1 text-xs">
                    {latestPayment.authorized_at && (
                      <p>
                        <span className="text-muted-foreground">Autorizado em:</span>{" "}
                        {formatDateTime(latestPayment.authorized_at)}
                      </p>
                    )}
                    {latestPayment.paid_at && (
                      <p>
                        <span className="text-muted-foreground">Pago em:</span>{" "}
                        {formatDateTime(latestPayment.paid_at)}
                      </p>
                    )}
                    {latestPayment.failed_at && (
                      <p>
                        <span className="text-muted-foreground">Falhou em:</span>{" "}
                        {formatDateTime(latestPayment.failed_at)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tabela de todas as tentativas */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Histórico de Tentativas ({payments.length})
              </p>
              <div className="border border-border/20 rounded-lg overflow-hidden">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="py-2">Provider</TableHead>
                      <TableHead className="py-2">Tipo de pagamento</TableHead>
                      <TableHead className="py-2">Status</TableHead>
                      <TableHead className="text-right py-2">Valor</TableHead>
                      <TableHead className="py-2">Criado em</TableHead>
                      <TableHead className="text-right py-2">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => {
                      const hasDetails = !!getGatewayChargeCreatedEvent(payment);

                      return (
                        <TableRow key={payment.id} className="hover:bg-muted/30">
                          <TableCell className="py-2 text-xs">{payment.provider || "-"}</TableCell>
                          <TableCell className="py-2 text-xs">{getPaymentTypeLabel(payment)}</TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="outline"
                              className={`${
                                PAYMENT_STATUS_COLORS[payment.status]?.bg ||
                                "bg-gray-100"
                              } ${
                                PAYMENT_STATUS_COLORS[payment.status]?.text ||
                                "text-gray-800"
                              } border-0`}
                            >
                              {getPaymentStatusLabel(payment.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right py-2 font-semibold">
                            {formatCurrency(payment.amount_cents)}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">
                            {formatDateTime(payment.created_at)}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => handleOpenPaymentDetails(payment)}
                              disabled={!hasDetails}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Gerar Pagamento</DialogTitle>
                  <DialogDescription>
                    Selecione o tipo de pagamento para esta nova tentativa. Isso também atualiza o tipo no pedido.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={selectedRetryMethod === "PIX" ? "default" : "outline"}
                    onClick={() => setSelectedRetryMethod("PIX")}
                    disabled={retrying}
                  >
                    PIX
                  </Button>
                  <Button
                    type="button"
                    variant={selectedRetryMethod === "BOLETO" ? "default" : "outline"}
                    onClick={() => setSelectedRetryMethod("BOLETO")}
                    disabled={retrying}
                  >
                    BOLETO
                  </Button>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGenerateModalOpen(false)}
                    disabled={retrying}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleGeneratePayment} disabled={retrying}>
                    {retrying ? "Gerando..." : "Gerar Pagamento"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Detalhes da Tentativa de Pagamento</DialogTitle>
                  <DialogDescription>
                    PIX com QR Code e código copia-e-cola, ou boleto com link e código de barras.
                  </DialogDescription>
                </DialogHeader>

                {selectedPayment ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-2 rounded bg-muted/40">
                        <p className="text-muted-foreground">Provider</p>
                        <p className="font-semibold text-sm">{selectedPayment.provider || "-"}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/40">
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-semibold text-sm">{getPaymentStatusLabel(selectedPayment.status)}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/40">
                        <p className="text-muted-foreground">Valor</p>
                        <p className="font-semibold text-sm">{formatCurrency(selectedPayment.amount_cents)}</p>
                      </div>
                    </div>

                    {(() => {
                      const gatewayEvent = getGatewayChargeCreatedEvent(selectedPayment);
                      if (!gatewayEvent) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            Esta tentativa não possui payload de gateway com dados de PIX/Boleto.
                          </p>
                        );
                      }

                      return (
                        <PaymentMethodDetails
                          event={{
                            id: String(gatewayEvent.id),
                            event_type: gatewayEvent.event_type,
                            event_source: gatewayEvent.event_source || undefined,
                            occurred_at: gatewayEvent.occurred_at || undefined,
                            payload_json: gatewayEvent.payload_json || undefined,
                          }}
                          provider={selectedPayment.provider || undefined}
                          paymentMethod={selectedPayment.payment_code || undefined}
                        />
                      );
                    })()}
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
