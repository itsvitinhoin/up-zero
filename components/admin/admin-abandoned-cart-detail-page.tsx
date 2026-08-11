"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudflareImage } from "@/components/ui/cloudflare-image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { dispatchCartWebhookAction } from "@/lib/actions/abandoned-carts";
import { useAdminStore } from "@/contexts/admin-store-context";
import { buildStorefrontUrl } from "@/lib/storefront-url";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Clock,
  DollarSign,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Send,
  ShoppingCart,
  Webhook,
} from "lucide-react";

export interface AbandonedCartRow {
  id: string;
  client_id?: number;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  status: string;
  total_items: number;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  recovery_sent_at?: string | null;
  recovery_method?: string;
  items_json: string;
}

interface CartItemPreview {
  product_variant_id: number;
  asset_id?: number | null;
  product_name?: string;
  product_sku?: string | null;
  image_url?: string | null;
  variant_sku?: string | null;
  variant_combination_key?: string | null;
  color_name?: string | null;
  size_name?: string | null;
  quantity: number;
}

interface GroupedSkuItem {
  key: string;
  product_variant_id: number;
  variant_sku: string;
  variant_combination_key?: string | null;
  color_name?: string | null;
  size_name?: string | null;
  quantity: number;
  lines: number;
}

interface GroupedProductItem {
  key: string;
  product_name: string;
  product_sku: string;
  image_url?: string | null;
  quantity: number;
  lines: number;
  skus: GroupedSkuItem[];
}

interface ProductMatrixRow {
  color: string;
  bySize: Record<string, number>;
  totalRequested: number;
}

interface ProductMatrix {
  sizes: string[];
  rows: ProductMatrixRow[];
  totalRequested: number;
}

const RECOVERY_STATUS_LABELS: Record<string, { label: string; chipClassName: string }> = {
  NOT_SENT: {
    label: "Não disparado",
    chipClassName: "border-amber-200 bg-amber-50 text-amber-700",
  },
  SENT_WHATSAPP: {
    label: "Mensagem Enviada (WhatsApp)",
    chipClassName: "border-sky-200 bg-sky-50 text-sky-700",
  },
  SENT_EMAIL: {
    label: "Mensagem Enviada (E-mail)",
    chipClassName: "border-violet-200 bg-violet-50 text-violet-700",
  },
  RECOVERED: {
    label: "Recuperado",
    chipClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

function getRecoveryStatus(cart: AbandonedCartRow): string {
  const normalizedStatus = String(cart.status || "").trim().toLowerCase();
  if (normalizedStatus === "converted") return "RECOVERED";
  if (cart.recovery_method === "email" && cart.recovery_sent_at) return "SENT_EMAIL";
  if (cart.recovery_method === "whatsapp" && cart.recovery_sent_at) return "SENT_WHATSAPP";
  return "NOT_SENT";
}

function parseCartItems(cart: AbandonedCartRow): CartItemPreview[] {
  try {
    const parsed = JSON.parse(cart.items_json);
    return Array.isArray(parsed) ? (parsed as CartItemPreview[]) : [];
  } catch {
    return [];
  }
}

function formatBRL(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return `R$ ${reais.toLocaleString("pt-BR")},${centavos.toString().padStart(2, "0")}`;
}

function formatDateTime(value?: string | null): string {
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

function buildWhatsappLink(phone?: string | null, message?: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;

  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  if (normalized.length < 12) return null;

  const text = encodeURIComponent(String(message || "").trim());
  return `https://wa.me/${normalized}${text ? `?text=${text}` : ""}`;
}

function groupCartItems(items: CartItemPreview[]): GroupedProductItem[] {
  const grouped = new Map<string, GroupedProductItem>();

  for (const item of items) {
    const productName = String(item.product_name || "Produto").trim() || "Produto";
    const productKey = productName.toLowerCase();
    const variantSku = String(item.variant_sku || "-").trim() || "-";
    const skuKey = `${item.product_variant_id}:${variantSku}`;
    const quantity = Number(item.quantity || 0);

    const existingProduct = grouped.get(productKey);
    if (existingProduct) {
      if (!existingProduct.product_sku) {
        const incomingProductSku = String(item.product_sku || "").trim();
        if (incomingProductSku) {
          existingProduct.product_sku = incomingProductSku;
        }
      }
      existingProduct.quantity += quantity;
      existingProduct.lines += 1;
      if (!existingProduct.image_url && item.image_url) {
        existingProduct.image_url = item.image_url;
      }

      const existingSku = existingProduct.skus.find((sku) => sku.key === skuKey);
      if (existingSku) {
        existingSku.quantity += quantity;
        existingSku.lines += 1;
      } else {
        existingProduct.skus.push({
          key: skuKey,
          product_variant_id: item.product_variant_id,
          variant_sku: variantSku,
          variant_combination_key: item.variant_combination_key,
          color_name: item.color_name,
          size_name: item.size_name,
          quantity,
          lines: 1,
        });
      }
      continue;
    }

    grouped.set(productKey, {
      key: productKey,
      product_name: productName,
      product_sku: String(item.product_sku || "").trim(),
      image_url: item.image_url,
      quantity,
      lines: 1,
      skus: [
        {
          key: skuKey,
          product_variant_id: item.product_variant_id,
          variant_sku: variantSku,
          variant_combination_key: item.variant_combination_key,
          color_name: item.color_name,
          size_name: item.size_name,
          quantity,
          lines: 1,
        },
      ],
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    return a.product_name.localeCompare(b.product_name, "pt-BR");
  }).map((product) => ({
    ...product,
    skus: [...product.skus].sort((a, b) => a.variant_sku.localeCompare(b.variant_sku, "pt-BR")),
  }));
}

const SIZE_PRIORITY: Record<string, number> = {
  PP: 10,
  P: 20,
  M: 30,
  G: 40,
  GG: 50,
  XG: 60,
  XGG: 70,
  EXG: 80,
  EG: 90,
  UN: 100,
};

function normalizeSizeToken(token: string): string {
  const normalized = token.trim().toUpperCase();
  if (!normalized) return "UN";
  if (["U", "UNI", "UNICO", "UNICA"].includes(normalized)) return "UN";
  if (normalized === "XLG") return "XG";
  return normalized;
}

function isLikelySizeToken(token: string): boolean {
  const normalized = normalizeSizeToken(token);
  if (normalized in SIZE_PRIORITY) return true;
  if (/^\d{2,3}$/.test(normalized)) return true;
  return false;
}

function normalizeColorLabel(raw: string): string {
  return raw
    .replace(/[_\-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase() || "PADRÃO";
}

function parseDimensionsFromCombination(raw: string): { color?: string; size?: string } {
  const normalized = String(raw || "").trim();
  if (!normalized) return {};

  const matches = Array.from(normalized.matchAll(/([^|,;:]+):([^|,;]+)/g));
  if (matches.length === 0) return {};

  let color: string | undefined;
  let size: string | undefined;

  for (const match of matches) {
    const key = String(match[1] || "").trim().toLowerCase();
    const value = String(match[2] || "").trim();
    if (!key || !value) continue;

    if (!color && ["cor", "color", "cores", "colors"].includes(key)) {
      color = normalizeColorLabel(value);
    }
    if (!size && ["tam", "tamanho", "size", "sizes"].includes(key)) {
      size = normalizeSizeToken(value);
    }
  }

  return { color, size };
}

function parseSkuDimensions(variantSku: string): { color: string; size: string } {
  const tokens = String(variantSku || "")
    .trim()
    .toLowerCase()
    .split(/[-_/]/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { color: "PADRÃO", size: "UN" };
  }

  const withoutPrefix = /^\d+$/.test(tokens[0]) ? tokens.slice(1) : tokens;
  if (withoutPrefix.length === 0) {
    return { color: "PADRÃO", size: "UN" };
  }

  const lastToken = withoutPrefix[withoutPrefix.length - 1];
  const hasSize = isLikelySizeToken(lastToken);
  const size = hasSize ? normalizeSizeToken(lastToken) : "UN";
  const colorTokens = hasSize ? withoutPrefix.slice(0, -1) : withoutPrefix;
  const color = normalizeColorLabel(colorTokens.join(" "));

  return { color, size };
}

function resolveVariantDimensions(sku: GroupedSkuItem): { color: string; size: string } {
  const explicitColor = normalizeColorLabel(String(sku.color_name || "").trim());
  const explicitSize = normalizeSizeToken(String(sku.size_name || "").trim());
  const hasExplicitColor = Boolean(String(sku.color_name || "").trim());
  const hasExplicitSize = Boolean(String(sku.size_name || "").trim());

  if (hasExplicitColor && hasExplicitSize) {
    return { color: explicitColor, size: explicitSize };
  }

  const combo = parseDimensionsFromCombination(String(sku.variant_combination_key || ""));
  const fromComboColor = combo.color;
  const fromComboSize = combo.size;

  if ((hasExplicitColor || fromComboColor) && (hasExplicitSize || fromComboSize)) {
    return {
      color: hasExplicitColor ? explicitColor : (fromComboColor || "PADRÃO"),
      size: hasExplicitSize ? explicitSize : (fromComboSize || "UN"),
    };
  }

  const bySku = parseSkuDimensions(sku.variant_sku);
  return {
    color: hasExplicitColor ? explicitColor : (fromComboColor || bySku.color),
    size: hasExplicitSize ? explicitSize : (fromComboSize || bySku.size),
  };
}

function colorDotStyle(colorName: string): { backgroundColor: string } {
  const key = colorName.trim().toLowerCase();
  const map: Record<string, string> = {
    preto: "#111111",
    branco: "#f3f4f6",
    roxo: "#6b21a8",
    lilas: "#a855f7",
    rosa: "#ec4899",
    vermelho: "#dc2626",
    azul: "#2563eb",
    verde: "#16a34a",
    amarelo: "#eab308",
    laranja: "#f97316",
    marrom: "#92400e",
    bege: "#d6b88d",
    cinza: "#6b7280",
    nude: "#d4b08c",
  };
  return { backgroundColor: map[key] || "#111111" };
}

function sortSizes(a: string, b: string): number {
  const left = normalizeSizeToken(a);
  const right = normalizeSizeToken(b);
  const leftPriority = SIZE_PRIORITY[left];
  const rightPriority = SIZE_PRIORITY[right];

  if (leftPriority !== undefined && rightPriority !== undefined) {
    return leftPriority - rightPriority;
  }
  if (leftPriority !== undefined) return -1;
  if (rightPriority !== undefined) return 1;

  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    return Number(left) - Number(right);
  }

  return left.localeCompare(right, "pt-BR");
}

function buildProductMatrix(skus: GroupedSkuItem[]): ProductMatrix {
  const sizeSet = new Set<string>();
  const rowMap = new Map<string, ProductMatrixRow>();
  let totalRequested = 0;

  for (const sku of skus) {
    const dims = resolveVariantDimensions(sku);
    sizeSet.add(dims.size);
    totalRequested += sku.quantity;

    const existing = rowMap.get(dims.color);
    if (existing) {
      existing.bySize[dims.size] = (existing.bySize[dims.size] || 0) + sku.quantity;
      existing.totalRequested += sku.quantity;
      continue;
    }

    rowMap.set(dims.color, {
      color: dims.color,
      bySize: { [dims.size]: sku.quantity },
      totalRequested: sku.quantity,
    });
  }

  const sizes = Array.from(sizeSet).sort(sortSizes);
  const rows = Array.from(rowMap.values()).sort((a, b) => a.color.localeCompare(b.color, "pt-BR"));

  return { sizes, rows, totalRequested };
}

export default function AdminAbandonedCartDetailPage({
  cart,
  basePath,
}: {
  cart: AbandonedCartRow;
  basePath: string;
}) {
  const { storefrontUrl } = useAdminStore();
  const items = parseCartItems(cart);
  const groupedProducts = groupCartItems(items);
  const recoveryStatus = getRecoveryStatus(cart);
  const statusConfig = RECOVERY_STATUS_LABELS[recoveryStatus] ?? RECOVERY_STATUS_LABELS.NOT_SENT;
  const hasWhatsApp = Boolean(cart.customer_phone && String(cart.customer_phone).trim());
  const [communicationPanel, setCommunicationPanel] = useState<"message" | "webhook" | null>(null);
  const [isDispatchingMessage, setIsDispatchingMessage] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string>("");
  const [webhookEvent, setWebhookEvent] = useState<"cart_created" | "cart_abandoned" | "cart_converted">("cart_abandoned");
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false);
  const [webhookDispatchFeedback, setWebhookDispatchFeedback] = useState<string>("");
  const [webhookDispatchPayload, setWebhookDispatchPayload] = useState<unknown | null>(null);
  const [webhookDispatchResultOpen, setWebhookDispatchResultOpen] = useState(false);
  const storefrontBaseUrl = useMemo(() => {
    const raw = String(storefrontUrl || "").trim();
    if (!raw) return undefined;

    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/\/+$/, "");
    }

    if (typeof window !== "undefined") {
      return buildStorefrontUrl(raw, "", window.location.origin).replace(/\/+$/, "");
    }

    return undefined;
  }, [storefrontUrl]);
  const whatsappHref = buildWhatsappLink(
    cart.customer_phone,
    `Olá, ${cart.customer_name || ""}. Estamos te ajudando com o carrinho #${cart.id.slice(0, 8).toUpperCase()}.`
  );

  const handleDispatchMessage = async () => {
    try {
      setIsDispatchingMessage(true);
      setDispatchFeedback("");
      if (!whatsappHref) {
        const message = "Cliente sem telefone válido para WhatsApp";
        setDispatchFeedback(message);
        toast.error("Erro ao disparar mensagem", { description: message });
        return;
      }

      window.open(whatsappHref, "_blank", "noopener,noreferrer");

      setDispatchFeedback("WhatsApp aberto para envio ao cliente.");
      toast.success("Mensagem preparada", {
        description: "WhatsApp aberto para envio ao cliente.",
      });
    } finally {
      setIsDispatchingMessage(false);
    }
  };

  const handleDispatchWebhook = async () => {
    try {
      setIsDispatchingWebhook(true);
      setWebhookDispatchFeedback("");
      setWebhookDispatchPayload(null);
      const result = await dispatchCartWebhookAction({
        cartId: cart.id,
        event: webhookEvent,
        storefrontBaseUrl,
      });

      if (!result.success) {
        setWebhookDispatchFeedback(result.error || "Erro ao disparar webhook");
        toast.error("Erro ao disparar webhook", { description: result.error });
        return;
      }

      setWebhookDispatchFeedback(`${result.data.event}: ${result.data.message || "Evento enviado com sucesso."}`);
      setWebhookDispatchPayload(result.data.payload ?? null);
      setWebhookDispatchResultOpen(true);
      toast.success("Webhook disparado", {
        description: result.data.message || "Evento enviado com sucesso.",
      });
    } finally {
      setIsDispatchingWebhook(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={basePath}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-medium text-foreground">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Carrinho #{cart.id.slice(0, 8).toUpperCase()}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <p>{formatDateTime(cart.updated_at)}</p>
              <Badge variant="outline" className={`text-xs font-medium ${statusConfig.chipClassName}`}>
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {whatsappHref ? (
          <Button asChild className="h-9 gap-2 rounded-full px-4">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp</span>
            </a>
          </Button>
        ) : null}

      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1.5">
                <p className="font-semibold">{cart.customer_name || "Não informado"}</p>
                {hasWhatsApp ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {cart.customer_phone}
                  </p>
                ) : null}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {cart.customer_email || "Sem e-mail"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Status do Carrinho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Atualizado em {formatDateTime(cart.updated_at)}
              </p>
              <p className="flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5" />
                Criado em {formatDateTime(cart.created_at)}
              </p>
              <p>Expira em {formatDateTime(cart.expires_at)}</p>
              <p>
                Último disparo: {formatDateTime(cart.recovery_sent_at)}
                {cart.recovery_method ? ` (${cart.recovery_method})` : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className="rounded-xl border-border/20 shadow-none p-0">
              <CardContent className="flex items-center gap-4 pb-5 pt-5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-sky-100 text-sky-600">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Solicitado</p>
                  <p className="text-s font-medium leading-tight">{formatBRL(cart.total_cents)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/20 shadow-none p-0">
              <CardContent className="flex items-center gap-4 pb-5 pt-5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Boxes className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Itens no Carrinho</p>
                  <p className="text-xl font-medium leading-tight">{cart.total_items}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Produtos do Carrinho ({groupedProducts.length})</CardTitle>
              <CardDescription>Itens agrupados por produto com detalhamento por SKU.</CardDescription>
            </CardHeader>
            <CardContent>
              {groupedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum produto encontrado para este carrinho.</p>
              ) : (
                <div className="space-y-4">
                  {groupedProducts.map((product) => (
                    <div key={product.key} className="rounded-lg border border-border/50">
                      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/40">
                            {product.image_url ? (
                              <CloudflareImage
                                src={product.image_url}
                                cloudflare={{ width: 56, height: 56, fit: "cover", dpr: 2 }}
                                alt={product.product_name}
                                width={56}
                                height={56}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{product.product_name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {product.product_sku || "-"}</p>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const matrix = buildProductMatrix(product.skus);
                        const gridTemplate = `minmax(180px,1fr) repeat(${Math.max(matrix.sizes.length, 1)}, minmax(72px, 96px))`;

                        return (
                          <div className="px-3 py-3">
                            <div
                              className="grid items-center gap-x-2 border-b border-border/40 px-0 py-2 text-xs text-muted-foreground"
                              style={{ gridTemplateColumns: gridTemplate }}
                            >
                              <span>Cor</span>
                              {(matrix.sizes.length > 0 ? matrix.sizes : ["UN"]).map((size) => (
                                <span key={size} className="text-center text-[11px] font-medium uppercase">
                                  {size}
                                </span>
                              ))}
                            </div>

                            <div className="space-y-1">
                              {matrix.rows.map((row) => (
                                <div
                                  key={row.color}
                                  className="grid items-center gap-x-2 px-0 py-3"
                                  style={{ gridTemplateColumns: gridTemplate }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full border border-border/50" style={colorDotStyle(row.color)} />
                                    <span className="text-sm font-medium">{row.color}</span>
                                  </div>
                                  {(matrix.sizes.length > 0 ? matrix.sizes : ["UN"]).map((size) => {
                                    const requested = row.bySize[size] || 0;
                                    return (
                                      <div key={`${row.color}-${size}`} className="text-center">
                                        <p className="text-sm leading-5 font-semibold">{requested > 0 ? requested : "-"}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 flex flex-col items-start justify-between gap-2 border-t border-border/40 pt-3 text-xs sm:flex-row sm:items-end">
                              <div>
                                <p>
                                  Solicitado: <span className="text-sm font-semibold leading-none">{matrix.totalRequested}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="print:hidden pl-1 space-y-1">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-normal text-muted-foreground inline-flex items-center gap-1.5"
              onClick={() => setCommunicationPanel("message")}
            >
              <Send className="h-3.5 w-3.5" />
              Disparo de Mensagem ao Cliente
            </Button>

            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-normal text-muted-foreground inline-flex items-center gap-1.5"
              onClick={() => setCommunicationPanel("webhook")}
            >
              <Webhook className="h-3.5 w-3.5" />
              Disparo Manual de Webhook
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={communicationPanel !== null} onOpenChange={(open) => !open && setCommunicationPanel(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="text-left border-b border-border/20 px-5 py-4">
            <SheetTitle>
              <span className="inline-flex items-center gap-2">
                {communicationPanel === "message" ? (
                  <Send className="h-4 w-4 text-primary" />
                ) : (
                  <Webhook className="h-4 w-4 text-primary" />
                )}
                {communicationPanel === "message" ? "Disparo de Mensagem ao Cliente" : "Disparo Manual de Webhook"}
              </span>
            </SheetTitle>
            <SheetDescription className="mt-1">
              {communicationPanel === "message"
                ? "Selecione trigger e canal para envio com o template ativo da mensageria."
                : "Dispare manualmente o evento de webhook do carrinho usando o fluxo padrão do backend."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {communicationPanel === "message" ? (
              <Card className="rounded-xl border-border/30 shadow-none">
                <CardContent className="pt-5 space-y-4">
                  <div className="space-y-2">
                    <Label>Canal</Label>
                    <Select value="WHATSAPP" disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => { void handleDispatchMessage(); }} disabled={isDispatchingMessage}>
                      {isDispatchingMessage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {isDispatchingMessage ? "Disparando..." : "Disparar Mensagem"}
                    </Button>
                    {dispatchFeedback ? (
                      <p className="text-sm text-muted-foreground">{dispatchFeedback}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {communicationPanel === "webhook" ? (
              <Card className="rounded-xl border-border/30 shadow-none">
                <CardContent className="pt-5 space-y-4">
                  <div className="space-y-2">
                    <Label>Evento</Label>
                    <Select value={webhookEvent} onValueChange={(value) => setWebhookEvent(value as typeof webhookEvent)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cart_created">cart_created</SelectItem>
                        <SelectItem value="cart_abandoned">cart_abandoned</SelectItem>
                        <SelectItem value="cart_converted">cart_converted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => { void handleDispatchWebhook(); }} disabled={isDispatchingWebhook}>
                      {isDispatchingWebhook ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Webhook className="h-4 w-4 mr-2" />}
                      {isDispatchingWebhook ? "Disparando..." : "Disparar Webhook"}
                    </Button>
                    {webhookDispatchFeedback ? (
                      <p className="text-sm text-muted-foreground">{webhookDispatchFeedback}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={webhookDispatchResultOpen} onOpenChange={setWebhookDispatchResultOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>Webhook disparado</DialogTitle>
            <DialogDescription>{webhookDispatchFeedback}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {webhookDispatchPayload ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Campos enviados
                </p>
                <pre className="max-h-[55vh] overflow-auto rounded-md bg-background p-3 text-xs leading-5 text-foreground whitespace-pre-wrap wrap-break-word">
                  {JSON.stringify(webhookDispatchPayload, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhum payload disponível.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
