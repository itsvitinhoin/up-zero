import { AlertCircle, BadgeDollarSign, CheckCircle, CreditCard, Landmark, WalletCards } from "lucide-react";
import { buildStorefrontUrl } from "@/lib/storefront-url";
import type { ReactNode } from "react";
import type { GatewayGroup, OrderPaymentEventResponse, OrderPaymentResponse, PaymentLinkDetailWithUrl } from "./types";

export const PAYMENT_STATUS_COLORS: Record<string, { bg: string; text: string; icon: ReactNode }> = {
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", icon: <AlertCircle className="h-3 w-3" /> },
  AUTHORIZED: { bg: "bg-blue-100", text: "text-blue-800", icon: <CheckCircle className="h-3 w-3" /> },
  PAID: { bg: "bg-green-100", text: "text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  PARTIALLY_PAID: { bg: "bg-blue-100", text: "text-blue-800", icon: <AlertCircle className="h-3 w-3" /> },
  FAILED: { bg: "bg-red-100", text: "text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
  CANCELLED: { bg: "bg-gray-100", text: "text-gray-800", icon: <AlertCircle className="h-3 w-3" /> },
  REFUNDED: { bg: "bg-purple-100", text: "text-purple-800", icon: <AlertCircle className="h-3 w-3" /> },
  CHARGEBACK: { bg: "bg-red-100", text: "text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
};

export function formatCurrency(cents: number): string {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getPaymentStatusLabel(status: string): string {
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

export function getProviderDisplayName(provider: string | null): string {
  const normalized = String(provider || "").trim().toUpperCase();

  if (normalized === "GETNET") return "Getnet";
  if (normalized === "REDE" || normalized === "E_REDE" || normalized === "EREDE") return "e-Rede";
  if (normalized === "PAGSEGURO" || normalized === "PAGBANK") return "PagBank";
  if (normalized === "MERCADO_PAGO" || normalized === "MERCADOPAGO" || normalized === "MERCADO-PAGO") {
    return "Mercado Pago";
  }
  if (normalized === "STRIPE") return "Stripe";
  if (normalized === "ASAAS") return "Asaas";

  return String(provider || "").trim() || "Não informado";
}

export function getGatewayGroupKey(provider: string | null): string {
  const normalized = String(provider || "").trim().toUpperCase();
  if (normalized === "GETNET") return "GETNET";
  if (normalized === "REDE" || normalized === "E_REDE" || normalized === "EREDE") return "REDE";
  if (normalized === "PAGSEGURO" || normalized === "PAGBANK") return "PAGBANK";
  if (normalized === "MERCADO_PAGO" || normalized === "MERCADOPAGO" || normalized === "MERCADO-PAGO") {
    return "MERCADO_PAGO";
  }
  return normalized || "OUTROS";
}

export function getGatewayGroupLabel(providerKey: string): string {
  if (providerKey === "GETNET") return "Getnet";
  if (providerKey === "REDE") return "e-Rede";
  if (providerKey === "PAGBANK") return "PagBank";
  if (providerKey === "MERCADO_PAGO") return "Mercado Pago";
  if (providerKey === "OUTROS") return "Outros gateways";
  return providerKey;
}

export function getGatewayGroupSubtitle(providerKey: string): string {
  if (providerKey === "GETNET") return "Cobranças processadas pela Getnet";
  if (providerKey === "REDE") return "Cobranças processadas pela e-Rede";
  if (providerKey === "PAGBANK") return "Cobranças processadas pela PagBank";
  if (providerKey === "MERCADO_PAGO") return "Cobranças processadas pelo Mercado Pago";
  return "Cobranças de outros provedores";
}

export function getGatewayGroupTone(providerKey: string): string {
  if (providerKey === "GETNET") return "border-emerald-200 bg-linear-to-br from-emerald-50 via-white to-teal-50";
  if (providerKey === "REDE") return "border-orange-200 bg-linear-to-br from-orange-50 via-white to-amber-50";
  if (providerKey === "PAGBANK") return "border-sky-200 bg-linear-to-br from-sky-50 via-white to-cyan-50";
  if (providerKey === "MERCADO_PAGO") return "border-blue-200 bg-linear-to-br from-blue-50 via-white to-indigo-50";
  return "border-border/40 bg-muted/40";
}

export function getGatewayGroupBadgeClass(providerKey: string): string {
  if (providerKey === "GETNET") return "border-emerald-200 bg-emerald-100 text-emerald-800";
  if (providerKey === "REDE") return "border-orange-200 bg-orange-100 text-orange-800";
  if (providerKey === "PAGBANK") return "border-sky-200 bg-sky-100 text-sky-800";
  if (providerKey === "MERCADO_PAGO") return "border-blue-200 bg-blue-100 text-blue-800";
  return "border-border/30 bg-muted text-muted-foreground";
}

export function getGatewayGroupIcon(providerKey: string): ReactNode {
  if (providerKey === "GETNET") return <Landmark className="h-4 w-4" />;
  if (providerKey === "REDE") return <Landmark className="h-4 w-4" />;
  if (providerKey === "PAGBANK") return <WalletCards className="h-4 w-4" />;
  if (providerKey === "MERCADO_PAGO") return <BadgeDollarSign className="h-4 w-4" />;
  return <CreditCard className="h-4 w-4" />;
}

export function inferPaymentTypeFromPayload(payload: Record<string, unknown> | null): string {
  if (!payload || typeof payload !== "object") return "";

  const methodId = String((payload as Record<string, unknown>).payment_method_id || "")
    .trim()
    .toLowerCase();
  const typeId = String((payload as Record<string, unknown>).payment_type_id || "")
    .trim()
    .toLowerCase();

  if (methodId === "pix" || typeId === "bank_transfer") return "PIX";
  if (methodId === "bolbradesco" || methodId === "pec" || methodId === "brazilbankticket" || typeId === "ticket") {
    return "Boleto";
  }

  if (
    methodId.includes("card") ||
    methodId.includes("credit") ||
    typeId.includes("card") ||
    typeId.includes("credit")
  ) {
    return "Cartão";
  }

  if (methodId) return methodId.toUpperCase();
  if (typeId) return typeId.toUpperCase();
  return "";
}

export function getGatewayChargeCreatedEvent(payment: OrderPaymentResponse | null): OrderPaymentEventResponse | null {
  if (!payment || !Array.isArray(payment.events)) return null;

  const event = payment.events.find((entry) => {
    const eventType = String(entry.event_type || "").toLowerCase();
    return eventType.includes("charge") || eventType.includes("payment");
  });

  return event || null;
}

function readCheckoutPaymentField(payment: OrderPaymentResponse, field: "type" | "code" | "name"): string {
  const snapshot = payment.snapshot_json as Record<string, unknown> | null;
  const checkout = snapshot?.checkout as Record<string, unknown> | null;
  const checkoutPayment = checkout?.payment as Record<string, unknown> | null;
  return String(checkoutPayment?.[field] || "").trim();
}

function normalizePaymentTypeToken(raw: string): "PIX" | "BOLETO" | "CARD" | null {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "PIX" || normalized.includes("PIX")) return "PIX";
  if (
    normalized === "BOLETO" ||
    normalized === "TICKET" ||
    normalized.includes("BOLETO") ||
    normalized.includes("TICKET")
  ) {
    return "BOLETO";
  }

  if (
    normalized === "CARD" ||
    normalized === "CARTAO" ||
    normalized === "CREDIT_CARD" ||
    normalized.includes("CARD") ||
    normalized.includes("CART") ||
    normalized.includes("CREDIT")
  ) {
    return "CARD";
  }

  if (/\d+\s*X/.test(normalized) || normalized.includes("PARCELA") || normalized.includes("SEM JUROS")) {
    return "CARD";
  }

  return null;
}

function resolveCanonicalPaymentType(payment: OrderPaymentResponse): "PIX" | "BOLETO" | "CARD" | null {
  const candidates = [
    payment.payment_code || "",
    readCheckoutPaymentField(payment, "type"),
    readCheckoutPaymentField(payment, "code"),
    payment.payment_label || "",
  ];

  for (const candidate of candidates) {
    const resolved = normalizePaymentTypeToken(candidate);
    if (resolved) return resolved;
  }

  const gatewayEvent = getGatewayChargeCreatedEvent(payment);
  const inferred = inferPaymentTypeFromPayload((gatewayEvent?.payload_json as Record<string, unknown> | null) || null);
  const inferredResolved = normalizePaymentTypeToken(inferred);
  if (inferredResolved) return inferredResolved;

  if (inferred === "Cartão") return "CARD";
  if (inferred === "Boleto") return "BOLETO";
  if (inferred === "PIX") return "PIX";

  const snapshot = payment.snapshot_json as Record<string, unknown> | null;
  const snapshotMethod = String(snapshot?.payment_method || snapshot?.payment_type || "");
  const snapshotResolved = normalizePaymentTypeToken(snapshotMethod);
  if (snapshotResolved) return snapshotResolved;

  if (payment.provider && !normalizePaymentTypeToken(readCheckoutPaymentField(payment, "name"))) {
    return "CARD";
  }

  return null;
}

export function getPaymentTypeLabel(payment: OrderPaymentResponse): string {
  const canonical = resolveCanonicalPaymentType(payment);
  if (canonical === "PIX") return "PIX";
  if (canonical === "BOLETO") return "Boleto";
  if (canonical === "CARD") return "Cartão";

  const label = String(payment.payment_label || "").trim();
  const normalizedLabel = label.toUpperCase();
  const looksLikeVerbosePayload =
    label.length > 48 ||
    normalizedLabel.includes("HTTP://") ||
    normalizedLabel.includes("HTTPS://") ||
    /[a-z0-9]{24,}/i.test(label.replace(/\s+/g, ""));

  if (label && !looksLikeVerbosePayload) return label;

  const code = String(payment.payment_code || "").trim().toUpperCase();
  if (code === "PIX") return "PIX";
  if (code === "BOLETO" || code === "TICKET") return "Boleto";
  if (code) return code;

  const gatewayEvent = getGatewayChargeCreatedEvent(payment);
  const inferred = inferPaymentTypeFromPayload((gatewayEvent?.payload_json as Record<string, unknown> | null) || null);
  return inferred || "-";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectGetnetTimelineEntries(value: unknown, out: Record<string, unknown>[]): void {
  const entry = asRecord(value);
  if (!entry) return;

  const items = entry.items;
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;

    // Skip empty request objects from Getnet items array
    const itemType = String(itemRecord.type || "").trim().toUpperCase();
    if (itemType === "REQUEST") continue;

    const contentRecord = asRecord(itemRecord.content);
    if (contentRecord) {
      out.push(contentRecord);
    } else {
      out.push(itemRecord);
    }

    collectGetnetTimelineEntries(itemRecord, out);
  }
}

function getLastGetnetTimelineEntry(value: unknown): Record<string, unknown> | null {
  const entries: Record<string, unknown>[] = [];
  collectGetnetTimelineEntries(value, entries);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

function getNestedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  const record = asRecord(value);
  if (!record) return null;

  for (const key of ["content", "value", "text", "message", "description", "reason"] as const) {
    const nested = getNestedString(record[key]);
    if (nested) return nested;
  }

  return null;
}

export function getPaymentGatewayRefusal(payment: OrderPaymentResponse | null): { code: string | null; message: string | null } {
  if (!payment) return { code: null, message: null };

  // Only show refusal/error info if payment status is actually failed
  const status = String(payment.status || "").trim().toUpperCase();
  const isFailed = status === "FAILED" || status === "DENIED" || status === "REJECTED" || status === "CANCELLED";

  if (!isFailed) return { code: null, message: null };

  let code = payment.gateway_cause_code ? String(payment.gateway_cause_code) : null;
  let message: string | null = null;

  // Try to extract message from snapshot_json first
  const snapshot = asRecord(payment.snapshot_json);

  if (getGatewayGroupKey(payment.provider) === "GETNET" && snapshot) {
    const lastTimelineEntry = getLastGetnetTimelineEntry(snapshot);
    if (lastTimelineEntry) {
      if (!code) {
        code = getNestedString(
          lastTimelineEntry.reason_code ||
            lastTimelineEntry.status_code ||
            lastTimelineEntry.code,
        ) || null;
      }

      if (!message) {
        message = getNestedString(
          lastTimelineEntry.reason_message ||
            lastTimelineEntry.message ||
            lastTimelineEntry.description ||
            lastTimelineEntry.status_detail ||
            lastTimelineEntry.reason,
        ) || null;
      }
    }
  }

  if (snapshot) {
    for (const key of [
      "reason_message",
      "description",
      "gateway_error",
      "_gateway_status_detail",
      "_gateway_cause",
      "status_detail",
      "error",
      "message",
    ] as const) {
      const value = getNestedString(snapshot[key]);
      if (value) {
        message = value;
        break;
      }
    }
  }

  // Fallback to direct payment fields
  if (!message && payment.gateway_cause_message) {
    message = String(payment.gateway_cause_message);
  }

  // Final fallback to other message-like fields
  if (!message) {
    for (const key of ["gateway_error", "gateway_status_detail", "status_detail", "error"] as const) {
      const value = getNestedString((payment as Record<string, unknown>)[key]);
      if (value) {
        message = value;
        break;
      }
    }
  }

  return { code, message };
}

export function isCardRetryPayment(payment: OrderPaymentResponse | null): boolean {
  const paymentCode = String(payment?.payment_code || "").trim().toUpperCase();
  const paymentLabel = String(payment?.payment_label || "").trim().toUpperCase();

  if (paymentCode.includes("CARTAO") || paymentCode.includes("CARD")) return true;
  if (paymentLabel.includes("CARTAO") || paymentLabel.includes("CARD")) return true;

  const snapshot = payment?.snapshot_json as Record<string, unknown> | null;
  const method = String(snapshot?.payment_method || snapshot?.payment_type || "").toUpperCase();
  return method.includes("CARTAO") || method.includes("CARD");
}

export function buildPaymentLinkPublicUrl(
  storefrontUrl: string,
  token: string,
  isPrivateStorefront = false,
  origin?: string,
): string {
  const pathPrefix = isPrivateStorefront ? "/private" : "";
  return buildStorefrontUrl(
    storefrontUrl,
    `${pathPrefix}/payment-links/${encodeURIComponent(token)}`,
    origin,
  );
}

export function mapUnknownLinkItem(
  raw: unknown,
  storefrontUrl: string,
  isPrivateStorefront = false,
): PaymentLinkDetailWithUrl | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const id = Number(entry.id);
  const token = String(entry.token || "").trim();
  if (!Number.isFinite(id) || id <= 0 || !token) return null;

  return {
    link: {
      id: Math.trunc(id),
      token,
      status: String(entry.status || ""),
      amount_cents: Number(entry.amount_cents || 0),
      expires_at: String(entry.expires_at || "") || null,
      attempt_count: Number(entry.attempt_count || 0),
      open_count: Number(entry.open_count || 0),
    },
    public_url: buildPaymentLinkPublicUrl(storefrontUrl, token, isPrivateStorefront),
  };
}

export function mapInitialPaymentLinks(
  initialLinks: unknown[] | undefined,
  storefrontUrl: string,
  isPrivateStorefront = false,
): PaymentLinkDetailWithUrl[] {
  if (!Array.isArray(initialLinks)) return [];

  return initialLinks
    .map((entry) => mapUnknownLinkItem(entry, storefrontUrl, isPrivateStorefront))
    .filter((entry): entry is PaymentLinkDetailWithUrl => Boolean(entry));
}

export function groupPaymentsByGateway(payments: OrderPaymentResponse[]): GatewayGroup[] {
  const buckets = new Map<string, OrderPaymentResponse[]>();

  for (const payment of payments) {
    const key = getGatewayGroupKey(payment.provider);
    const current = buckets.get(key) || [];
    current.push(payment);
    buckets.set(key, current);
  }

  const preferredOrder = ["GETNET", "PAGBANK", "MERCADO_PAGO"];
  const sortedKeys = [
    ...preferredOrder.filter((key) => buckets.has(key)),
    ...Array.from(buckets.keys()).filter((key) => !preferredOrder.includes(key)).sort(),
  ];

  return sortedKeys.map((key) => {
    const items = buckets.get(key) || [];

    return {
      key,
      label: getGatewayGroupLabel(key),
      subtitle: getGatewayGroupSubtitle(key),
      icon: getGatewayGroupIcon(key),
      tone: getGatewayGroupTone(key),
      badgeClass: getGatewayGroupBadgeClass(key),
      payments: items,
      latestPayment: items.length > 0 ? items[0] : null,
      isGetnet: key === "GETNET",
    };
  });
}

export function isGetnetPayment(payment: OrderPaymentResponse | null): boolean {
  if (!payment) return false;
  return getGatewayGroupKey(payment.provider) === "GETNET";
}
