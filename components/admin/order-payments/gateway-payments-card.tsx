import { useMemo, useState } from "react";
import { CreditCard, Eye, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentMethodDetails } from "../payment-method-details";
import {
  formatCurrency,
  formatDateTime,
  getGatewayChargeCreatedEvent,
  getPaymentGatewayRefusal,
  getPaymentStatusLabel,
  getPaymentTypeLabel,
  groupPaymentsByGateway,
  isGetnetPayment,
  PAYMENT_STATUS_COLORS,
  getProviderDisplayName,
} from "./helpers";
import type { OrderPaymentResponse, RetryPaymentMethod } from "./types";

type GatewayPaymentsCardProps = {
  loading: boolean;
  error: string | null;
  payments: OrderPaymentResponse[];
  canRetry: boolean;
  retrying: boolean;
  creatingLink: boolean;
  latestIsCardPayment: boolean;
  onGeneratePayment: (retryMethod: RetryPaymentMethod) => Promise<void>;
};

export function GatewayPaymentsCard({
  loading,
  error,
  payments,
  canRetry,
  retrying,
  creatingLink,
  latestIsCardPayment,
  onGeneratePayment,
}: GatewayPaymentsCardProps) {
  const showGeneratePaymentButton = false;
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedRetryMethod, setSelectedRetryMethod] = useState<RetryPaymentMethod>("PIX");
  const [selectedPayment, setSelectedPayment] = useState<OrderPaymentResponse | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const groupedPayments = useMemo(() => groupPaymentsByGateway(payments), [payments]);

  async function handleGenerate() {
    await onGeneratePayment(selectedRetryMethod);
    setGenerateModalOpen(false);
  }

  function handleOpenPaymentDetails(payment: OrderPaymentResponse) {
    setSelectedPayment(payment);
    setDetailsModalOpen(true);
  }

  return (
    <Card className="print:hidden rounded-xl border-border/20 shadow-none gap-0">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <CardTitle className="text-base">Gateway de Pagamento</CardTitle>
          </div>
          {showGeneratePaymentButton && canRetry ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGenerateModalOpen(true)}
              disabled={retrying || creatingLink}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Gerando..." : "Gerar Pagamento"}
            </Button>
          ) : null}
        </div>
        <CardDescription>Status atual do gateway e histórico das tentativas de cobrança.</CardDescription>
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
              Se o pedido foi iniciado mas o pagamento não foi processado, gere um link no card de links de pagamento acima.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedPayments.map((group) => {
              const latestPaymentForGateway = group.latestPayment;

              if (!latestPaymentForGateway) return null;

              return (
                <div
                  key={group.key}
                  className={`space-y-4 rounded-xl border p-4 shadow-sm ${group.tone}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${group.badgeClass}`}>
                        {group.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Gateway de Pagamento</p>
                        <p className="min-w-0 text-sm font-semibold">{group.label}</p>
                        <p className="text-xs text-muted-foreground">{group.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={group.badgeClass}>
                        {group.payments.length} tentativa{group.payments.length > 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline" className="max-w-[18rem] truncate">
                        {getPaymentTypeLabel(latestPaymentForGateway)}
                      </Badge>
                    </div>
                    <Badge
                      className={`${
                        PAYMENT_STATUS_COLORS[latestPaymentForGateway.status]?.bg ||
                        "bg-gray-100"
                      } ${
                        PAYMENT_STATUS_COLORS[latestPaymentForGateway.status]?.text ||
                        "text-gray-800"
                      }`}
                    >
                      {getPaymentStatusLabel(latestPaymentForGateway.status)}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-xs md:grid-cols-2">
                    <div className="rounded-lg border border-border/30 bg-background/80 p-3">
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground">Tipo de pagamento</span>
                      <p className="mt-1 max-w-full truncate font-semibold" title={getPaymentTypeLabel(latestPaymentForGateway)}>
                        {getPaymentTypeLabel(latestPaymentForGateway)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-background/80 p-3">
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground">Valor</span>
                      <p className="mt-1 font-semibold">{formatCurrency(latestPaymentForGateway.amount_cents)}</p>
                    </div>
                    {latestPaymentForGateway.payment_code && (
                      <div className="rounded-lg border border-border/30 bg-background/80 p-3">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">Código</span>
                        <p className="mt-1 min-w-0 max-w-full truncate font-mono text-xs" title={latestPaymentForGateway.payment_code}>
                          {latestPaymentForGateway.payment_code}
                        </p>
                      </div>
                    )}
                    {latestPaymentForGateway.gateway_reference && (
                      <div className="rounded-lg border border-border/30 bg-background/80 p-3">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">Referência do gateway</span>
                        <p className="mt-1 min-w-0 max-w-full truncate font-mono text-xs" title={latestPaymentForGateway.gateway_reference}>
                          {latestPaymentForGateway.gateway_reference}
                        </p>
                      </div>
                    )}
                    {latestPaymentForGateway.installments && latestPaymentForGateway.installments > 1 && (
                      <div className="rounded-lg border border-border/30 bg-background/80 p-3">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">Parcelas</span>
                        <p className="mt-1 font-semibold">{latestPaymentForGateway.installments}x</p>
                      </div>
                    )}
                    {latestPaymentForGateway.gateway_transaction_id && (
                      <div className="rounded-lg border border-border/30 bg-background/80 p-3 md:col-span-2">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">ID da transação</span>
                        <p className="mt-1 min-w-0 max-w-full truncate font-mono text-xs" title={latestPaymentForGateway.gateway_transaction_id}>
                          {latestPaymentForGateway.gateway_transaction_id}
                        </p>
                      </div>
                    )}
                  </div>

                  {(latestPaymentForGateway.authorized_at || latestPaymentForGateway.paid_at || latestPaymentForGateway.failed_at) && (
                    <div className="space-y-1 border-t border-border/20 pt-2 text-xs">
                      {latestPaymentForGateway.authorized_at && (
                        <p>
                          <span className="text-muted-foreground">Autorizado em:</span>{" "}
                          {formatDateTime(latestPaymentForGateway.authorized_at)}
                        </p>
                      )}
                      {latestPaymentForGateway.paid_at && (
                        <p>
                          <span className="text-muted-foreground">Pago em:</span>{" "}
                          {formatDateTime(latestPaymentForGateway.paid_at)}
                        </p>
                      )}
                      {latestPaymentForGateway.failed_at && (
                        <p>
                          <span className="text-muted-foreground">Falhou em:</span>{" "}
                          {formatDateTime(latestPaymentForGateway.failed_at)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Histórico de Tentativas ({group.payments.length})
                    </p>
                    <div className="overflow-hidden rounded-lg border border-border/20">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="py-2">Provider</TableHead>
                            <TableHead className="py-2">Tipo de pagamento</TableHead>
                            <TableHead className="py-2">Status</TableHead>
                            <TableHead className="py-2 text-right">Valor</TableHead>
                            <TableHead className="py-2">Criado em</TableHead>
                            <TableHead className="py-2 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.payments.map((payment) => {
                            const hasDetails = !!getGatewayChargeCreatedEvent(payment);

                            return (
                              <TableRow key={payment.id} className="hover:bg-muted/30">
                                <TableCell className="py-2 text-xs">{getProviderDisplayName(payment.provider)}</TableCell>
                                <TableCell className="w-70 py-2 text-xs">
                                  <div className="w-70 truncate" title={getPaymentTypeLabel(payment)}>
                                    {getPaymentTypeLabel(payment)}
                                  </div>
                                </TableCell>
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
                                <TableCell className="py-2 text-right font-semibold">
                                  {formatCurrency(payment.amount_cents)}
                                </TableCell>
                                <TableCell className="py-2 text-muted-foreground">
                                  {formatDateTime(payment.created_at)}
                                </TableCell>
                                <TableCell className="py-2 text-right">
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
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Gerar Pagamento</DialogTitle>
              <DialogDescription>
                Selecione o tipo de pagamento para esta nova tentativa. Se o último pagamento foi cartão PagBank, a nova tentativa usa o snapshot do cartão e recria o token antes de reenviar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2">
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
              <Button
                type="button"
                variant={selectedRetryMethod === "CARTAO_EXTERNO" ? "default" : "outline"}
                onClick={() => setSelectedRetryMethod("CARTAO_EXTERNO")}
                disabled={retrying || !latestIsCardPayment}
              >
                CARTÃO
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
              <Button type="button" onClick={handleGenerate} disabled={retrying}>
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
                {(() => {
                  const refusal = getPaymentGatewayRefusal(selectedPayment);
                  const selectedProviderLabel = getProviderDisplayName(selectedPayment.provider);
                  const selectedIsGetnet = isGetnetPayment(selectedPayment);

                  return (
                    <>
                      <div
                        className={`grid grid-cols-1 gap-3 text-xs md:grid-cols-3 ${
                          selectedIsGetnet ? "rounded-xl border border-emerald-200 bg-emerald-50/60 p-3" : ""
                        }`}
                      >
                        <div className="p-2 rounded bg-muted/40">
                          <p className="text-muted-foreground uppercase text-[11px]">Provider</p>
                          <p className="font-semibold text-sm">{selectedProviderLabel}</p>
                        </div>
                        <div className="p-2 rounded bg-muted/40">
                          <p className="text-muted-foreground uppercase text-[11px]">Status</p>
                          <p className="font-semibold text-sm">{getPaymentStatusLabel(selectedPayment.status)}</p>
                        </div>
                        <div className="p-2 rounded bg-muted/40">
                          <p className="text-muted-foreground uppercase text-[11px]">Valor</p>
                          <p className="font-semibold text-sm">{formatCurrency(selectedPayment.amount_cents)}</p>
                        </div>
                      </div>

                      {selectedIsGetnet ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                          <p className="font-semibold uppercase tracking-wide">Pagamento Getnet</p>
                          <p className="mt-1 text-emerald-900/80">
                            Aqui aparecem os dados mais úteis para auditoria: referência, transação, status e payload do evento original.
                          </p>
                        </div>
                      ) : null}

                      {refusal.code || refusal.message ? (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs space-y-1">
                          <p className="font-semibold text-red-800 uppercase">Motivo da recusa</p>
                          {refusal.code ? (
                            <p className="text-red-700">
                              Código: <span className="font-mono font-semibold">{refusal.code}</span>
                            </p>
                          ) : null}
                          {refusal.message ? (
                            <p className="text-red-700">
                              Mensagem: <span className="font-medium">{refusal.message}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}

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
                    </>
                  );
                })()}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
