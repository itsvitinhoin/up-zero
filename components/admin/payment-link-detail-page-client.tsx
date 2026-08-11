"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Activity,
  ArrowLeft,
  Ban,
  Copy,
  CreditCard,
  DollarSign,
  Eye,
  ExternalLink,
  Loader2,
  Mail,
  MousePointerClick,
  RefreshCw,
  Send,
  User,
  Webhook,
} from "lucide-react"

import {
  cancelOrderPaymentLinkAction,
  dispatchPaymentLinkWebhookAction,
  getPaymentLinkDetailAction,
  type PaymentLinkWebhookEvent,
} from "@/lib/actions/orders"
import { dispatchPaymentLinkMessageAction } from "@/lib/actions/messaging"
import { useAdminStore } from "@/contexts/admin-store-context"
import { buildStorefrontUrl } from "@/lib/storefront-url"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PaymentLinkEventSummary = {
  id: number
  payment_link_id: number
  event_type: string
  event_source: string | null
  payload_json: Record<string, unknown> | null
  occurred_at: string | null
  created_at: string
}

type PaymentLinkCustomerSummary = {
  id: number
  name: string | null
  email: string
  document: string | null
}

type PaymentLinkDetail = {
  link: {
    id: number
    store_id: number
    order_id: number | null
    customer_id: number | null
    customer_name?: string | null
    payment_method_id?: number | null
    token: string
    status: string
    amount_cents: number
    currency?: string
    description?: string | null
    expires_at: string | null
    completed_order_payment_id?: number | null
    open_count: number
    attempt_count: number
    last_opened_at?: string | null
    completed_at?: string | null
    created_at: string
    updated_at?: string
    meta: Record<string, unknown> | null
  }
  customer?: PaymentLinkCustomerSummary | null
  events: PaymentLinkEventSummary[]
}

type PaymentType = "PIX" | "BOLETO" | "CARD"

interface PaymentLinkDetailPageClientProps {
  initialDetail: PaymentLinkDetail
}

type CommunicationPanel = "message" | "webhook"
type PaymentLinkMessageTrigger = "PAYMENT_LINK_CREATED" | "PAYMENT_LINK_REMINDER"
type WebhookPayload = Record<string, unknown>

function sanitizePreviewHtml(input: string): string {
  return String(input || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
}

const STATUS_LABELS: Record<string, { label: string; chipClassName: string }> = {
  ACTIVE: {
    label: "Ativo",
    chipClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
  },
  COMPLETED: {
    label: "Concluído",
    chipClassName: "border-sky-100 bg-sky-50 text-sky-600",
  },
  CANCELLED: {
    label: "Cancelado",
    chipClassName: "border-rose-100 bg-rose-50 text-rose-600",
  },
  FAILED: {
    label: "Falhou",
    chipClassName: "border-rose-100 bg-rose-50 text-rose-600",
  },
  EXPIRED: {
    label: "Expirado",
    chipClassName: "border-amber-100 bg-amber-50 text-amber-600",
  },
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date)
}

function formatEventTypeLabel(value: string): string {
  const raw = String(value || "").trim().toUpperCase()
  const words = raw.split("_").filter(Boolean)
  if (words.length === 0) return "EVENT"
  return words.join(" ")
}

function eventTypeToneClass(value: string): string {
  const raw = String(value || "").trim().toUpperCase()
  if (raw.includes("FAILED") || raw.includes("ERROR") || raw.includes("CANCEL")) {
    return "border-rose-100 bg-rose-50 text-rose-600"
  }
  if (raw.includes("COMPLETED") || raw.includes("PAID") || raw.includes("SUCCESS")) {
    return "border-emerald-100 bg-emerald-50 text-emerald-600"
  }
  if (raw.includes("OPEN") || raw.includes("CREATED") || raw.includes("UPDATED")) {
    return "border-sky-100 bg-sky-50 text-sky-600"
  }
  if (raw.includes("EXPIRED")) {
    return "border-amber-100 bg-amber-50 text-amber-600"
  }
  return "border-border bg-muted text-foreground"
}

function eventRowToneClass(value: string): string {
  const raw = String(value || "").trim().toUpperCase()
  if (raw.includes("FAILED") || raw.includes("ERROR") || raw.includes("CANCEL")) {
    return "border-rose-200 bg-rose-50/40"
  }
  if (raw.includes("COMPLETED") || raw.includes("PAID") || raw.includes("SUCCESS")) {
    return "border-emerald-200 bg-emerald-50/40"
  }
  if (raw.includes("EXPIRED")) {
    return "border-amber-200 bg-amber-50/40"
  }
  return "border-border/40 bg-muted/30"
}

function formatEventSourceLabel(value: string | null): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!normalized) return "Não informado"
  if (normalized === "admin") return "Admin"
  if (normalized === "public") return "Público"
  if (normalized === "gateway" || normalized.startsWith("payment.gateway")) return "Gateway"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatEventPayload(value: Record<string, unknown> | null): string {
  try {
    return JSON.stringify(value || {}, null, 2)
  } catch {
    return "{}"
  }
}

function buildPaymentLinkPublicUrl(
  storefrontUrl: string,
  token: string,
  isPrivateStorefront = false,
): string {
  const pathPrefix = isPrivateStorefront ? "/private" : ""
  return buildStorefrontUrl(
    storefrontUrl,
    `${pathPrefix}/payment-links/${encodeURIComponent(token)}`,
  )
}

function extractAcceptedPaymentTypes(meta: Record<string, unknown> | null): PaymentType[] {
  const entries = Array.isArray(meta?.payment_types)
    ? meta?.payment_types
    : meta?.accepted_payment_types
  const normalized = Array.from(
    new Set(
      (Array.isArray(entries) ? entries : [meta?.payment_type])
        .map((entry) => String(entry || "").trim().toUpperCase())
        .filter((entry) => entry === "PIX" || entry === "BOLETO" || entry === "CARD"),
    ),
  ) as PaymentType[]

  return normalized.length > 0 ? normalized : ["PIX"]
}

function getStatusConfig(status: string) {
  const normalized = String(status || "").trim().toUpperCase()
  return (
    STATUS_LABELS[normalized] || {
      label: normalized || "Desconhecido",
      chipClassName: "border-border bg-muted text-foreground",
    }
  )
}

export default function PaymentLinkDetailPageClient({
  initialDetail,
}: PaymentLinkDetailPageClientProps) {
  const { storefrontUrl, store, session } = useAdminStore()
  const isPrivateStorefront = Boolean(store?.maintenanceMode)
  const [detail, setDetail] = useState<PaymentLinkDetail>(initialDetail)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [openPayloadIds, setOpenPayloadIds] = useState<Record<number, boolean>>({})
  const [communicationPanel, setCommunicationPanel] = useState<CommunicationPanel | null>(null)
  const [messageTrigger, setMessageTrigger] =
    useState<PaymentLinkMessageTrigger>("PAYMENT_LINK_CREATED")
  const [messageChannel, setMessageChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP")
  const [isDispatchingMessage, setIsDispatchingMessage] = useState(false)
  const [dispatchFeedback, setDispatchFeedback] = useState("")
  const [dispatchPreview, setDispatchPreview] = useState("")
  const [dispatchPreviewHtml, setDispatchPreviewHtml] = useState("")
  const [messageDispatchResultOpen, setMessageDispatchResultOpen] = useState(false)
  const [webhookEvent, setWebhookEvent] =
    useState<PaymentLinkWebhookEvent>("payment_link.created")
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false)
  const [webhookDispatchFeedback, setWebhookDispatchFeedback] = useState("")
  const [webhookDispatchPayload, setWebhookDispatchPayload] = useState<WebhookPayload | null>(null)
  const [webhookDispatchResultOpen, setWebhookDispatchResultOpen] = useState(false)

  const permissionSet = useMemo(
    () =>
      new Set(
        Array.isArray(session?.permissionCodes)
          ? session.permissionCodes
              .map((code) => String(code || "").trim().toLowerCase())
              .filter(Boolean)
          : [],
      ),
    [session?.permissionCodes],
  )
  const canSendMessages =
    !Array.isArray(session?.permissionCodes) || permissionSet.has("messaging.send")

  const link = detail.link
  const events = detail.events || []
  const statusConfig = getStatusConfig(link.status)
  const customerName =
    String(detail.customer?.name || link.customer_name || "").trim() ||
    (link.customer_id ? `Cliente #${link.customer_id}` : "Não informado")

  const publicUrl = useMemo(
    () => buildPaymentLinkPublicUrl(storefrontUrl, String(link.token), isPrivateStorefront),
    [storefrontUrl, link.token, isPrivateStorefront],
  )

  async function refresh() {
    setLoading(true)
    setError(null)
    setInfo(null)

    const result = await getPaymentLinkDetailAction(link.id)
    setLoading(false)

    if (!result.success || !result.data) {
      setError(result.error || "Erro ao atualizar link")
      return
    }

    setDetail(result.data as PaymentLinkDetail)
    setInfo("Dados atualizados")
  }

  async function handleCopy() {
    setError(null)
    setInfo(null)
    try {
      await navigator.clipboard.writeText(publicUrl)
      setInfo("Link copiado")
    } catch {
      setError("Não foi possível copiar o link")
    }
  }

  async function handleCancel() {
    if (link.status !== "ACTIVE") return

    setLoading(true)
    setError(null)
    setInfo(null)

    const result = await cancelOrderPaymentLinkAction(link.id, "cancelled_from_payment_link_detail")
    setLoading(false)

    if (!result.success) {
      setError(result.error || "Erro ao cancelar link")
      return
    }

    setInfo("Link cancelado")
    await refresh()
  }

  async function handleDispatchMessage() {
    if (!canSendMessages) {
      setDispatchFeedback("Você não tem permissão para enviar mensagens")
      return
    }

    setIsDispatchingMessage(true)
    setDispatchFeedback("")

    const result = await dispatchPaymentLinkMessageAction({
      paymentLinkId: link.id,
      trigger: messageTrigger,
      channel: messageChannel,
      storefrontBaseUrl: storefrontUrl,
    })

    if (!result.success || !result.data) {
      setDispatchFeedback(result.error || "Não foi possível disparar a mensagem")
      setIsDispatchingMessage(false)
      return
    }

    const renderedMessage = result.data.renderedMessage || ""
    setDispatchPreview(renderedMessage)
    setDispatchPreviewHtml(sanitizePreviewHtml(renderedMessage))
    setDispatchFeedback(`${result.data.message} (${result.data.recipient})`)
    setWebhookDispatchResultOpen(false)
    setMessageDispatchResultOpen(true)

    if (result.data.whatsappUrl) {
      window.open(result.data.whatsappUrl, "_blank", "noopener,noreferrer")
    }

    setIsDispatchingMessage(false)
  }

  async function handleDispatchWebhook() {
    setIsDispatchingWebhook(true)
    setWebhookDispatchFeedback("")
    setWebhookDispatchPayload(null)

    const result = await dispatchPaymentLinkWebhookAction(
      link.id,
      webhookEvent,
      storefrontUrl,
    )

    if (!result.success || !result.data) {
      setWebhookDispatchFeedback(result.error || "Não foi possível disparar o webhook")
      setIsDispatchingWebhook(false)
      return
    }

    setWebhookDispatchFeedback(`${result.data.message} (${result.data.event})`)
    setWebhookDispatchPayload((result.data.payload as WebhookPayload | undefined) || null)
    setMessageDispatchResultOpen(false)
    setWebhookDispatchResultOpen(true)
    setIsDispatchingWebhook(false)
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/payment-links">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-medium text-foreground">
              <CreditCard className="h-5 w-5 text-primary" />
              Link #{link.id}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <p>{formatDateTime(link.created_at)}</p>
              <Badge
                variant="outline"
                className={`text-xs font-medium ${statusConfig.chipClassName}`}
              >
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 rounded-full px-4"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 rounded-full px-4"
            onClick={() => void handleCopy()}
          >
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 rounded-full px-4"
            onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-9 gap-2 rounded-full px-4"
            onClick={() => void handleCancel()}
            disabled={loading || link.status !== "ACTIVE"}
          >
            <Ban className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-lg border border-border/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {info}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 border-t border-border/20 pt-6 text-sm">
              <p className="font-semibold">{customerName}</p>
              {detail.customer?.email ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {detail.customer.email}
                </p>
              ) : (
                <p className="text-muted-foreground">Sem e-mail</p>
              )}
              {detail.customer?.document ? (
                <p className="text-muted-foreground">Doc: {detail.customer.document}</p>
              ) : null}
              {link.customer_id ? (
                <Link
                  href={`/customers/${link.customer_id}`}
                  className="inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Ver cliente #{link.customer_id}
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 border-t border-border/20 pt-6 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${statusConfig.chipClassName}`}
                >
                  {statusConfig.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Pedido</span>
                {link.order_id ? (
                  <Link
                    href={`/orders/${link.order_id}`}
                    className="font-mono font-medium text-primary hover:underline"
                  >
                    #{link.order_id}
                  </Link>
                ) : (
                  <span className="font-medium">Avulso</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Pagamento</span>
                <span className="font-mono font-medium">
                  {link.completed_order_payment_id
                    ? `#${link.completed_order_payment_id}`
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Expira em</span>
                <span className="font-medium">{formatDateTime(link.expires_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Última abertura</span>
                <span className="font-medium">{formatDateTime(link.last_opened_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Concluído em</span>
                <span className="font-medium">{formatDateTime(link.completed_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card className="rounded-xl border-border/20 p-0 shadow-none">
              <CardContent className="flex items-center gap-4 pt-5 pb-5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-sky-100 text-sky-600">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="text-xl font-medium leading-tight">
                    {formatCurrency(link.amount_cents)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/20 p-0 shadow-none">
              <CardContent className="flex items-center gap-4 pt-5 pb-5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Eye className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aberturas</p>
                  <p className="text-xl font-medium leading-tight">{link.open_count}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/20 p-0 shadow-none">
              <CardContent className="flex items-center gap-4 pt-5 pb-5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-600">
                  <MousePointerClick className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tentativas</p>
                  <p className="text-xl font-medium leading-tight">{link.attempt_count}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Informações do Link
              </CardTitle>
              <CardDescription>
                URL pública, tipos aceitos e descrição da cobrança.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-border/20 pt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Tipos aceitos</p>
                <div className="flex flex-wrap gap-1.5">
                  {extractAcceptedPaymentTypes(link.meta).map((type) => (
                    <Badge key={type} variant="outline" className="text-xs font-medium">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              {link.description ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="text-sm whitespace-pre-wrap">{link.description}</p>
                </div>
              ) : null}

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">URL pública</p>
                <p className="break-all rounded-md border border-border/40 bg-muted/30 px-3 py-2 font-mono text-xs">
                  {publicUrl}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/20 shadow-none gap-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Eventos ({events.length})
              </CardTitle>
              <CardDescription>
                Histórico de criação, aberturas, tentativas e conclusões.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 border-t border-border/20 pt-6">
              {events.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                  Nenhum evento registrado para este link.
                </div>
              ) : (
                events.map((event) => {
                  const payloadOpen = Boolean(openPayloadIds[event.id])
                  return (
                    <div
                      key={event.id}
                      className={`space-y-3 rounded-lg border p-4 ${eventRowToneClass(event.event_type)}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${eventTypeToneClass(event.event_type)}`}
                          >
                            {formatEventTypeLabel(event.event_type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">#{event.id}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(event.occurred_at || event.created_at)}
                        </span>
                      </div>

                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        <p className="text-muted-foreground">
                          Origem:{" "}
                          <span className="font-medium text-foreground">
                            {formatEventSourceLabel(event.event_source)}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Registro:{" "}
                          <span className="font-medium text-foreground">
                            {formatDateTime(event.created_at)}
                          </span>
                        </p>
                      </div>

                      <Collapsible
                        open={payloadOpen}
                        onOpenChange={(open) =>
                          setOpenPayloadIds((current) => ({
                            ...current,
                            [event.id]: open,
                          }))
                        }
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground"
                          >
                            {payloadOpen ? "Ocultar payload" : "Ver payload"}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border/40 bg-background/80 p-3 font-mono text-xs leading-relaxed wrap-break-word text-foreground">
                            {formatEventPayload(event.payload_json)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <div className="print:hidden space-y-1 pl-1">
            {canSendMessages ? (
              <Button
                type="button"
                variant="link"
                className="inline-flex h-auto items-center gap-1.5 p-0 text-xs font-normal text-muted-foreground"
                onClick={() => setCommunicationPanel("message")}
              >
                <Send className="h-3.5 w-3.5" />
                Disparo de Mensagem ao Cliente
              </Button>
            ) : null}
            <Button
              type="button"
              variant="link"
              className="inline-flex h-auto items-center gap-1.5 p-0 text-xs font-normal text-muted-foreground"
              onClick={() => setCommunicationPanel("webhook")}
            >
              <Webhook className="h-3.5 w-3.5" />
              Disparo Manual de Webhook
            </Button>
          </div>
        </div>
      </div>

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
                {communicationPanel === "message"
                  ? "Disparo de Mensagem ao Cliente"
                  : "Disparo Manual de Webhook"}
              </span>
            </DrawerTitle>
            <DrawerDescription className="mt-1">
              {communicationPanel === "message"
                ? "Selecione trigger e canal para enviar usando o template ativo da mensageria."
                : "Dispare manualmente o evento de webhook do link usando o fluxo padrão do backend."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {communicationPanel === "message" ? (
              <Card className="rounded-xl border-border/30 shadow-none">
                <CardContent className="space-y-4 pt-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Trigger</Label>
                      <Select
                        value={messageTrigger}
                        onValueChange={(value) =>
                          setMessageTrigger(value as PaymentLinkMessageTrigger)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAYMENT_LINK_CREATED">
                            Link de Pagamento Criado
                          </SelectItem>
                          <SelectItem value="PAYMENT_LINK_REMINDER">
                            Lembrete de Link de Pagamento
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Canal</Label>
                      <Select
                        value={messageChannel}
                        onValueChange={(value) =>
                          setMessageChannel(value as "WHATSAPP" | "EMAIL")
                        }
                      >
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
                    <Button
                      onClick={() => {
                        void handleDispatchMessage()
                      }}
                      disabled={!canSendMessages || isDispatchingMessage || loading}
                    >
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
            ) : null}

            {communicationPanel === "webhook" ? (
              <Card className="rounded-xl border-border/30 shadow-none">
                <CardContent className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <Label>Evento</Label>
                    <Select
                      value={webhookEvent}
                      onValueChange={(value) =>
                        setWebhookEvent(value as PaymentLinkWebhookEvent)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_link.created">payment_link.created</SelectItem>
                        <SelectItem value="payment_link.updated">payment_link.updated</SelectItem>
                        <SelectItem value="payment_link.cancelled">
                          payment_link.cancelled
                        </SelectItem>
                        <SelectItem value="payment_link.expired">payment_link.expired</SelectItem>
                        <SelectItem value="payment_link.completed">
                          payment_link.completed
                        </SelectItem>
                        <SelectItem value="payment_link.payment_failed">
                          payment_link.payment_failed
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => {
                        void handleDispatchWebhook()
                      }}
                      disabled={isDispatchingWebhook || loading}
                    >
                      {isDispatchingWebhook ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Webhook className="mr-2 h-4 w-4" />
                      )}
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
        </DrawerContent>
      </Drawer>

      <Dialog open={messageDispatchResultOpen} onOpenChange={setMessageDispatchResultOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>Mensagem disparada</DialogTitle>
            <DialogDescription>{dispatchFeedback}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Pré-visualização enviada
              </p>
              {/[<][^>]+[>]/.test(dispatchPreview) ? (
                <div className="rounded-md border border-border/60 bg-background p-3">
                  <div
                    className="mx-auto w-full max-w-full rounded-md border border-border/60 bg-white px-5 py-4 text-[15px] leading-7 text-zinc-900 shadow-sm [&_a]:text-blue-700 [&_a]:underline [&_p]:mb-3 [&_p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: dispatchPreviewHtml || dispatchPreview }}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-border/60 bg-background p-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{dispatchPreview}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={webhookDispatchResultOpen} onOpenChange={setWebhookDispatchResultOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>Webhook disparado</DialogTitle>
            <DialogDescription>{webhookDispatchFeedback}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {webhookDispatchPayload ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Campos enviados
                </p>
                <pre className="max-h-[55vh] overflow-auto rounded-md bg-background p-3 text-xs leading-5 wrap-break-word whitespace-pre-wrap text-foreground">
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
  )
}
