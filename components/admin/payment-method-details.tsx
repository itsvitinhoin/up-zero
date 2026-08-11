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

interface CopyableCodeProps {
  label: string;
  value: string;
  copyLabel: string;
  buttonClassName?: string;
}

function CopyableCode({ label, value, copyLabel, buttonClassName }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-blue-700">{label}</p>
      <div className="flex min-w-0 items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded border border-blue-100 bg-white p-2 font-mono text-xs whitespace-nowrap"
          title={value}
        >
          {value}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={copyToClipboard}
          className={buttonClassName || "h-auto px-2 py-1"}
          aria-label={copyLabel}
          title={copyLabel}
        >
          {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
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

function normalizeProvider(provider?: string): "PAGBANK" | "MERCADO_PAGO" | "GETNET" | "UNKNOWN" {
  const normalized = String(provider || "").trim().toUpperCase();
  if (normalized === "PAGBANK" || normalized === "PAGSEGURO") return "PAGBANK";
  if (normalized === "MERCADO_PAGO" || normalized === "MERCADOPAGO" || normalized === "MERCADO-PAGO") return "MERCADO_PAGO";
  if (normalized === "GETNET") return "GETNET";
  return "UNKNOWN";
}

function findFirstStringByKeys(
  value: unknown,
  keys: string[],
  options?: { shouldLookLikeUrl?: boolean },
): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const wantedKeys = new Set(keys.map((entry) => entry.trim().toLowerCase()));
  const stack: unknown[] = [value];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }

    for (const [rawKey, rawValue] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = rawKey.trim().toLowerCase();

      if (wantedKeys.has(normalizedKey)) {
        const candidate = getNestedString(rawValue);
        if (!candidate) {
          stack.push(rawValue);
          continue;
        }

        if (options?.shouldLookLikeUrl) {
          if (/^https?:\/\//i.test(candidate)) return candidate;
        } else {
          return candidate;
        }
      }

      if (rawValue && typeof rawValue === "object") {
        stack.push(rawValue);
      }
    }
  }

  return undefined;
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function collectGetnetTimelineItems(value: unknown, out: Record<string, unknown>[]) {
  const entry = asRecord(value);
  if (!entry) return;

  const items = entry.items;
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;

    const contentRecord = asRecord(itemRecord.content);
    if (contentRecord) {
      out.push(contentRecord);
    } else {
      out.push(itemRecord);
    }

    collectGetnetTimelineItems(itemRecord, out);
  }
}

function getLastGetnetPayloadSource(payload: Record<string, any>): Record<string, unknown> {
  const timeline: Record<string, unknown>[] = [];
  collectGetnetTimelineItems(payload, timeline);

  if (timeline.length > 0) {
    return timeline[timeline.length - 1];
  }

  return payload as Record<string, unknown>;
}

function extractDetailsByProvider(
  provider: "PAGBANK" | "MERCADO_PAGO" | "GETNET" | "UNKNOWN",
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

  if (provider === "GETNET") {
    const source = getLastGetnetPayloadSource(payload);

    const boletoUrl =
      findFirstStringByKeys(source, [
        "ticket_url",
        "boleto_url",
        "bank_slip_url",
        "payment_url",
        "link",
        "pdf",
        "href",
      ], { shouldLookLikeUrl: true }) ||
      getNestedString(source.ticket_url || source.boleto_url || source.payment_url || source.link);

    const barcode =
      findFirstStringByKeys(source, [
        "digitable_line",
        "linha_digitavel",
        "barcode",
        "bar_code",
        "codigo_barras",
        "codigo_de_barras",
      ]) ||
      getNestedString(source.digitable_line || source.linha_digitavel || source.barcode);

    const payer = (source.customer || source.payer || payload.customer || payload.payer) as Record<string, unknown> | undefined;
    const payerName = getNestedString(payer?.name);
    const payerEmail = getNestedString(payer?.email);
    const payerDoc = getNestedString(payer?.tax_id || payer?.document || (payer?.identification as Record<string, unknown> | undefined)?.number);

    return {
      pixQrCode: undefined,
      boletoUrl,
      barcode,
      qrImageUrl: "",
      payerName,
      payerEmail,
      payerDoc,
      inferredCode: barcode || boletoUrl ? "BOLETO" : "UNKNOWN",
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
          <CopyableCode
            label="Código PIX (copia e cola):"
            value={pixQrCode}
            copyLabel="Copiar código PIX"
            buttonClassName="h-auto px-2 py-1"
          />

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
            <CopyableCode
              label="Código de Barras:"
              value={barcode}
              copyLabel="Copiar código de barras"
              buttonClassName="h-auto px-2 py-1"
            />
          )}

          {boletoUrl && (
            <>
              <CopyableCode
                label="Link do Boleto:"
                value={boletoUrl}
                copyLabel="Copiar link do boleto"
                buttonClassName="h-auto px-2 py-1"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => window.open(boletoUrl, "_blank")}
              >
                Visualizar Boleto
              </Button>
            </>
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
