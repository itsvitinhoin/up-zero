"use client";

import { Copy, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface PaymentEvent {
  id: string;
  event_type: string;
  event_source?: string;
  occurred_at?: string;
  payload_json?: Record<string, any>;
}

interface PaymentMethodDetailsProps {
  event: PaymentEvent;
  provider?: string;
  paymentMethod?: string;
}

function getNestedString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidateKeys = ["content", "value", "url", "link", "href", "text"] as const;

  for (const key of candidateKeys) {
    const nestedValue = (value as Record<string, unknown>)[key];
    const resolvedValue = getNestedString(nestedValue);
    if (resolvedValue) {
      return resolvedValue;
    }
  }

  return undefined;
}

function normalizePaymentCode(value?: string): "PIX" | "BOLETO" | "UNKNOWN" {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "PIX") return "PIX";
  if (normalized === "BOLETO" || normalized === "TICKET") return "BOLETO";
  return "UNKNOWN";
}

function inferPaymentCodeFromPayload(payload?: Record<string, any>): "PIX" | "BOLETO" | "UNKNOWN" {
  const paymentMethodId = String(payload?.payment_method_id || "").trim().toLowerCase();
  const paymentTypeId = String(payload?.payment_type_id || "").trim().toLowerCase();

  if (paymentMethodId === "pix" || paymentTypeId === "bank_transfer") return "PIX";
  if (paymentMethodId === "bolbradesco" || paymentMethodId === "pec" || paymentTypeId === "ticket") {
    return "BOLETO";
  }

  return "UNKNOWN";
}

function normalizeProvider(provider?: string): "PAGBANK" | "MERCADO_PAGO" | "UNKNOWN" {
  const normalized = String(provider || "").trim().toUpperCase();
  if (normalized === "PAGBANK" || normalized === "PAGSEGURO") return "PAGBANK";
  if (normalized === "MERCADO_PAGO") return "MERCADO_PAGO";
  return "UNKNOWN";
}

function getFirstArrayEntry(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const first = value[0];
  if (!first || typeof first !== "object") return undefined;
  return first as Record<string, unknown>;
}

function getLinkByMedia(entry: unknown, media: string): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const links = (entry as Record<string, unknown>).links;
  if (!Array.isArray(links)) return undefined;

  for (const link of links) {
    if (!link || typeof link !== "object") continue;
    const typedLink = link as Record<string, unknown>;
    if (String(typedLink.media || "").trim() !== media) continue;
    const href = getNestedString(typedLink.href);
    if (href) return href;
  }

  return undefined;
}

function extractDetailsByProvider(
  provider: "PAGBANK" | "MERCADO_PAGO" | "UNKNOWN",
  payload: Record<string, any>,
) {
  if (provider === "PAGBANK") {
    const firstQrCode = getFirstArrayEntry(payload.qr_codes);
    const firstCharge = getFirstArrayEntry(payload.charges);
    const boleto =
      firstCharge && typeof firstCharge === "object"
        ? ((firstCharge as Record<string, unknown>).payment_method as Record<string, unknown> | undefined)
            ?.boleto as Record<string, unknown> | undefined
        : undefined;

    const pixQrCode = getNestedString(firstQrCode?.text);
    const boletoUrl =
      getLinkByMedia(firstCharge, "application/pdf") ||
      getLinkByMedia(firstCharge, "image/png") ||
      getNestedString(payload.boleto_url);
    const barcode = getNestedString(boleto?.formatted_barcode || boleto?.barcode);

    const qrImageUrl = getLinkByMedia(firstQrCode, "image/png");

    const customer = payload.customer as Record<string, unknown> | undefined;
    const payerName = getNestedString(customer?.name);
    const payerEmail = getNestedString(customer?.email);
    const payerDoc = getNestedString(customer?.tax_id);

    return {
      pixQrCode,
      boletoUrl,
      barcode,
      qrImageUrl,
      payerName,
      payerEmail,
      payerDoc,
      inferredCode: pixQrCode ? "PIX" : barcode || boletoUrl ? "BOLETO" : "UNKNOWN",
    };
  }

  const transactionData = payload.point_of_interaction?.transaction_data;
  const transactionDetails = payload.transaction_details;
  const pixQrCode = getNestedString(transactionData?.qr_code);
  const boletoUrl = getNestedString(
    transactionData?.ticket_url ||
      transactionDetails?.external_resource_url ||
      payload.ticket_url ||
      payload.external_resource_url,
  );
  const barcode = getNestedString(
    transactionDetails?.digitable_line ||
      transactionDetails?.barcode?.content ||
      payload.barcode?.content ||
      transactionData?.barcode ||
      payload.barcode,
  );
  const qrCodeBase64 = getNestedString(transactionData?.qr_code_base64);

  const payer = payload.payer as Record<string, any> | undefined;
  const payerName =
    payer?.first_name || payer?.name
      ? `${payer?.first_name || ""} ${payer?.last_name || ""}`.trim()
      : null;
  const payerEmail = payer?.email;
  const payerDoc = payer?.identification?.number;

  return {
    pixQrCode,
    boletoUrl,
    barcode,
    qrImageUrl: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : "",
    payerName,
    payerEmail,
    payerDoc,
    inferredCode: inferPaymentCodeFromPayload(payload),
  };
}

export function PaymentMethodDetails({ event, provider, paymentMethod }: PaymentMethodDetailsProps) {
  const [copied, setCopied] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string>("");

  const payload = event.payload_json;
  if (!payload) return null;

  const resolvedProvider = normalizeProvider(provider);
  const extracted = extractDetailsByProvider(resolvedProvider, payload);
  const pixQrCode = extracted.pixQrCode;
  const boletoUrl = extracted.boletoUrl;
  const barcode = extracted.barcode;
  const normalizedPaymentCode = normalizePaymentCode(paymentMethod);
  const inferredPaymentCode = normalizePaymentCode(extracted.inferredCode);
  const resolvedPaymentCode =
    normalizedPaymentCode !== "UNKNOWN" ? normalizedPaymentCode : inferredPaymentCode;

  const shouldShowPix =
    resolvedPaymentCode === "PIX" || (resolvedPaymentCode === "UNKNOWN" && !!pixQrCode && !boletoUrl);
  const shouldShowBoleto =
    resolvedPaymentCode === "BOLETO" ||
    (resolvedPaymentCode === "UNKNOWN" && !pixQrCode && (!!boletoUrl || !!barcode));

  useEffect(() => {
    if (typeof extracted.qrImageUrl === "string" && extracted.qrImageUrl.trim()) {
      setQrImageUrl(extracted.qrImageUrl);
      return;
    }
    setQrImageUrl("");
  }, [extracted.qrImageUrl]);

  const payerName = extracted.payerName;
  const payerEmail = extracted.payerEmail;
  const payerDoc = extracted.payerDoc;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border/20">
      {/* PIX Section */}
      {shouldShowPix && pixQrCode && (
        <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-900">PIX - QR Code</p>
          </div>

          {/* Visualizar QR Code */}
          {qrImageUrl && (
            <div className="flex justify-center p-3 bg-white border border-blue-100 rounded">
              <img src={qrImageUrl} alt="PIX QR Code" className="w-32 h-32" />
            </div>
          )}

          {/* Código PIX para copiar */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-blue-700">Código PIX (copia e cola):</p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-white p-2 border border-blue-100 rounded font-mono break-all">
                {pixQrCode}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(pixQrCode)}
                className="h-auto py-1 px-2"
              >
                {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* Boleto Section */}
      {shouldShowBoleto && (boletoUrl || barcode) && (
        <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-900">Boleto Bancário</p>
          </div>

          {barcode && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">Código de Barras:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-white p-2 border border-amber-100 rounded font-mono">
                  {barcode}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(barcode)}
                  className="h-auto py-1 px-2"
                >
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          )}

          {boletoUrl && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => window.open(boletoUrl, "_blank")}
            >
              Visualizar Boleto
            </Button>
          )}
        </div>
      )}

      {/* Informações do Pagador */}
      {(payerName || payerEmail || payerDoc) && (
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-muted-foreground uppercase">Dados do Pagador:</p>
          {payerName && <p>Nome: <span className="font-medium">{payerName}</span></p>}
          {payerEmail && <p>Email: <span className="font-medium">{payerEmail}</span></p>}
          {payerDoc && <p>Documento: <span className="font-mono">{payerDoc}</span></p>}
        </div>
      )}
    </div>
  );
}
