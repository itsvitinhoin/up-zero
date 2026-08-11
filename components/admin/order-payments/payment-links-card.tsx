import { Ban, Copy, ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "./helpers";
import type { PaymentLinkDetailWithUrl } from "./types";

type PaymentLinksCardProps = {
  paymentLinks: PaymentLinkDetailWithUrl[];
  canRetry: boolean;
  readOnly: boolean;
  paymentLinkLocked: boolean;
  paymentLinkLockReason?: string | null;
  creatingLink: boolean;
  retrying: boolean;
  cancellingLinkId: number | null;
  copyFeedback: string | null;
  copyFeedbackLinkId: number | null;
  onCreatePaymentLink: () => Promise<void>;
  onCancelPaymentLink: (paymentLinkId: number) => Promise<void>;
  onCopyPaymentLink: (paymentLinkId: number, linkUrl: string) => Promise<void>;
};

export function PaymentLinksCard({
  paymentLinks,
  canRetry,
  readOnly,
  paymentLinkLocked,
  paymentLinkLockReason,
  creatingLink,
  retrying,
  cancellingLinkId,
  copyFeedback,
  copyFeedbackLinkId,
  onCreatePaymentLink,
  onCancelPaymentLink,
  onCopyPaymentLink,
}: PaymentLinksCardProps) {
  return (
    <Card className="print:hidden rounded-xl border-border/20 shadow-none gap-0">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <CardTitle className="text-base">Links de Pagamento</CardTitle>
          </div>
          {canRetry ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onCreatePaymentLink}
              disabled={creatingLink || retrying || paymentLinkLocked}
              className="gap-2"
              title={paymentLinkLocked ? (paymentLinkLockReason || "Ação bloqueada") : undefined}
            >
              <Link2 className={`h-3.5 w-3.5 ${creatingLink ? "animate-spin" : ""}`} />
              {creatingLink ? "Criando..." : "Gerar Link"}
            </Button>
          ) : null}
        </div>
        <CardDescription>Gere e acompanhe os links vinculados a este pedido.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border/20 pt-6">
        {paymentLinkLocked ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {paymentLinkLockReason || "Finalize o processo de atendimento dos itens antes de gerar link de pagamento."}
          </div>
        ) : null}

        {paymentLinks.length > 0 ? (
          <div className="space-y-3">
            {paymentLinks.map((paymentLink) => (
              <div
                key={paymentLink.link.id}
                className={`space-y-3 rounded-lg border p-4 ${
                  paymentLink.link.status === "ACTIVE"
                    ? "border-emerald-200 bg-emerald-50/40"
                    : paymentLink.link.status === "CANCELLED" || paymentLink.link.status === "EXPIRED"
                    ? "border-border/50 bg-muted/20"
                    : "border-border/40 bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Link de pagamento</p>
                    <p className="text-sm font-medium">ID #{paymentLink.link.id}</p>
                  </div>
                  <Badge variant={paymentLink.link.status === "ACTIVE" ? "default" : "outline"}>
                    {paymentLink.link.status}
                  </Badge>
                </div>

                <p className="break-all text-xs text-muted-foreground">{paymentLink.public_url}</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p><span className="text-muted-foreground">Valor:</span> {formatCurrency(paymentLink.link.amount_cents)}</p>
                  <p><span className="text-muted-foreground">Expira em:</span> {formatDateTime(paymentLink.link.expires_at)}</p>
                  <p><span className="text-muted-foreground">Aberturas:</span> {paymentLink.link.open_count}</p>
                  <p><span className="text-muted-foreground">Tentativas:</span> {paymentLink.link.attempt_count}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => onCopyPaymentLink(paymentLink.link.id, paymentLink.public_url)}
                    className="gap-2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Link
                  </Button>
                  <Button size="sm" type="button" variant="outline" asChild className="gap-2">
                    <a href={paymentLink.public_url} target="_blank" rel="noreferrer noopener">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir Link
                    </a>
                  </Button>
                  {!readOnly ? (
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => onCancelPaymentLink(paymentLink.link.id)}
                      disabled={cancellingLinkId === paymentLink.link.id || paymentLink.link.status !== "ACTIVE"}
                      className="gap-2"
                    >
                      <Ban className={`h-3.5 w-3.5 ${cancellingLinkId === paymentLink.link.id ? "animate-spin" : ""}`} />
                      {cancellingLinkId === paymentLink.link.id ? "Cancelando..." : "Cancelar Link"}
                    </Button>
                  ) : null}
                  {copyFeedback && copyFeedbackLinkId === paymentLink.link.id ? (
                    <p className="text-xs text-muted-foreground">{copyFeedback}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border/40 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Nenhum link de pagamento gerado para este pedido.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
