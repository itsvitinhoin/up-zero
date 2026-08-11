"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import CurrencyInput from "@/components/form/CurrencyInput";
import PercentageInput from "@/components/form/PercentageInput";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  FileText,
  Percent,
  QrCode,
  CreditCard,
  AlertCircle,
  Check,
  Copy,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import type { SiteSettings, PaymentSettings, CustomPaymentMethod } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

function customPaymentMethodKey(method: CustomPaymentMethod, index: number): string {
  if (method.paymentMethodId != null) {
    return `pm-${method.paymentMethodId}`;
  }

  return `${method.id}-${index}`;
}

function customPaymentMethodsMatch(left: CustomPaymentMethod, right: CustomPaymentMethod): boolean {
  if (left.paymentMethodId != null && right.paymentMethodId != null) {
    return left.paymentMethodId === right.paymentMethodId;
  }

  return left.id === right.id;
}

interface PaymentsTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  isSaving: boolean;
  onSave: () => void;
  onManageGetnetWebhookSubscription?: (
    operation: "register" | "consult" | "remove",
    eventName?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
}

function formatPercentLabel(value: number | null | undefined): string {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";

  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function hasConfiguredDiscount(conditions?: PaymentSettings["pixConditions"]): boolean {
  if (!conditions) return false;
  const percent = Number(conditions.discountPercent ?? 0);
  const fixed = Number(conditions.discountFixed ?? 0);
  return (Number.isFinite(percent) && percent > 0) || (Number.isFinite(fixed) && fixed > 0);
}

export function PaymentsTab({
  locale = "en",
  settings,
  setSettings,
  isSaving,
  onSave,
  onManageGetnetWebhookSubscription,
}: PaymentsTabProps) {
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [getnetOperation, setGetnetOperation] = useState<"register" | "consult" | "remove" | null>(null);
  const [getnetFeedback, setGetnetFeedback] = useState<string>("");

  function updatePaymentSettings(updates: Partial<PaymentSettings>) {
    setSettings({ ...settings, paymentSettings: { ...settings.paymentSettings, ...updates } });
  }

  const provider = settings.paymentSettings.provider;

  const gatewayCredentialConfig: Record<Exclude<PaymentSettings["provider"], "NONE">, {
    title: string;
    description: string;
    apiKeyLabel: string;
    apiKeyPlaceholder: string;
    secretKeyLabel: string;
    secretKeyPlaceholder: string;
    webhookLabel: string;
    webhookPlaceholder: string;
  }> = {
    STRIPE: {
      title: tAdmin(locale, "admin.payments.gateway.stripe.title", "Stripe API Keys"),
      description: tAdmin(locale, "admin.payments.gateway.stripe.description", "Use Stripe publishable key, secret key and webhook secret."),
      apiKeyLabel: tAdmin(locale, "admin.payments.gateway.stripe.apiKeyLabel", "Publishable Key"),
      apiKeyPlaceholder: "pk_live_...",
      secretKeyLabel: tAdmin(locale, "admin.payments.gateway.stripe.secretKeyLabel", "Secret Key"),
      secretKeyPlaceholder: "sk_live_...",
      webhookLabel: tAdmin(locale, "admin.payments.gateway.webhookSecretOptional", "Webhook Secret (optional)"),
      webhookPlaceholder: "whsec_...",
    },
    MERCADO_PAGO: {
      title: tAdmin(locale, "admin.payments.gateway.mercadoPago.title", "Mercado Pago Credentials"),
      description: tAdmin(locale, "admin.payments.gateway.mercadoPago.description", "Provide Public Key and Access Token from your Mercado Pago account."),
      apiKeyLabel: "Public Key",
      apiKeyPlaceholder: "APP_USR-...",
      secretKeyLabel: "Access Token",
      secretKeyPlaceholder: "APP_USR-...",
      webhookLabel: tAdmin(locale, "admin.payments.gateway.webhookSecretOptional", "Webhook Secret (optional)"),
      webhookPlaceholder: tAdmin(locale, "admin.payments.gateway.webhookPlaceholder", "Webhook signature/secret"),
    },
    PAGBANK: {
      title: tAdmin(locale, "admin.payments.gateway.pagbank.title", "PagBank Credentials"),
      description: tAdmin(locale, "admin.payments.gateway.pagbank.description", "Provide Access Token. Public Key is optional."),
      apiKeyLabel: tAdmin(locale, "admin.payments.gateway.publicKeyOptional", "Public Key (optional)"),
      apiKeyPlaceholder: "pk_live_...",
      secretKeyLabel: "Access Token",
      secretKeyPlaceholder: "AAEAA...",
      webhookLabel: tAdmin(locale, "admin.payments.gateway.webhookTokenOptional", "Webhook Token/Secret (optional)"),
      webhookPlaceholder: tAdmin(locale, "admin.payments.gateway.webhookValidationToken", "Webhook validation token"),
    },
    ASAAS: {
      title: tAdmin(locale, "admin.payments.gateway.asaas.title", "Asaas Credentials"),
      description: tAdmin(locale, "admin.payments.gateway.asaas.description", "Provide API token and webhook credential when applicable."),
      apiKeyLabel: tAdmin(locale, "admin.payments.gateway.apiKeyOptional", "API Key (optional)"),
      apiKeyPlaceholder: "$aact_...",
      secretKeyLabel: "Access Token / API Key",
      secretKeyPlaceholder: "$aact_...",
      webhookLabel: tAdmin(locale, "admin.payments.gateway.webhookTokenOptional", "Webhook Token/Secret (optional)"),
      webhookPlaceholder: tAdmin(locale, "admin.payments.gateway.webhookValidationToken", "Webhook validation token"),
    },
    GETNET: {
      title: "Getnet Credentials",
      description: "Provide Client ID, Client Secret and Seller ID for Getnet Global API.",
      apiKeyLabel: "Client ID",
      apiKeyPlaceholder: "sbx_...",
      secretKeyLabel: "Client Secret",
      secretKeyPlaceholder: "...",
      webhookLabel: "Seller ID",
      webhookPlaceholder: "UUID do seller",
    },
    REDE: {
      title: "e-Rede Credentials",
      description: "Provide PV and Integration Key for e-Rede OAuth 2.0. For PIX in production, register the webhook URL with Rede support.",
      apiKeyLabel: "PV",
      apiKeyPlaceholder: "12345678",
      secretKeyLabel: "Chave de Integração",
      secretKeyPlaceholder: "...",
      webhookLabel: "Webhook Authorization (opcional)",
      webhookPlaceholder: "Bearer token enviado pela Rede",
    },
    PAGARME: {
      title: "Pagar.me Credentials",
      description: "Provide Secret Key for server-side calls. Public Key is optional for frontend tokenization.",
      apiKeyLabel: tAdmin(locale, "admin.payments.gateway.publicKeyOptional", "Public Key (optional)"),
      apiKeyPlaceholder: "pk_...",
      secretKeyLabel: "Secret Key",
      secretKeyPlaceholder: "sk_...",
      webhookLabel: tAdmin(locale, "admin.payments.gateway.webhookSecretOptional", "Webhook Secret (optional)"),
      webhookPlaceholder: tAdmin(locale, "admin.payments.gateway.webhookPlaceholder", "Webhook signature/secret"),
    },
  };

  const providerConfig =
    provider !== "NONE" ? gatewayCredentialConfig[provider as Exclude<PaymentSettings["provider"], "NONE">] : null;

  const providerWebhookUrl = settings.paymentSettings.providerWebhookUrl?.trim() || "";
  const getnetWebhookEvent = settings.paymentSettings.getnetWebhookEvent?.trim() || "APPROVED_TRANSACTIONS";
  const getnetSubscriptionId = settings.paymentSettings.getnetWebhookSubscriptionId?.trim() || "";
  const getnetAuthenticationType = settings.paymentSettings.getnetWebhookAuthenticationType?.trim() || "oauth";

  async function handleCopyWebhookUrl() {
    if (!providerWebhookUrl) return;

    try {
      await navigator.clipboard.writeText(providerWebhookUrl);
      setCopiedWebhookUrl(true);
      window.setTimeout(() => setCopiedWebhookUrl(false), 1500);
    } catch {
      setCopiedWebhookUrl(false);
    }
  }

  async function handleManageGetnetSubscription(operation: "register" | "consult" | "remove") {
    if (!onManageGetnetWebhookSubscription) return;

    setGetnetOperation(operation);
    setGetnetFeedback("");
    const result = await onManageGetnetWebhookSubscription(operation, getnetWebhookEvent);
    if (!result.success) {
      setGetnetFeedback(result.error || "Falha ao processar subscription da Getnet");
    } else {
      const successMessage = operation === "register"
        ? "Subscription registrada com sucesso."
        : operation === "consult"
          ? "Subscription consultada e sincronizada."
          : "Subscription removida com sucesso.";
      setGetnetFeedback(successMessage);
    }
    setGetnetOperation(null);
  }

  return (
    <div className="space-y-6">

      <div className="grid gap-6">
        {/* Payment Mode */}
        <Card id="payment-mode">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {tAdmin(locale, "admin.payments.mode.title", "Payment Mode")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.payments.mode.description", "Choose how you want to receive payments")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${settings.paymentSettings.mode === "MANUAL" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}
                onClick={() => updatePaymentSettings({ mode: "MANUAL", provider: "NONE" })}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${settings.paymentSettings.mode === "MANUAL" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">{tAdmin(locale, "admin.payments.mode.manual", "Manual Payment")}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{tAdmin(locale, "admin.payments.mode.manual.help", "Receive the order and mark it paid manually after offline payment confirmation")}</p>
                  </div>
                </div>
              </div>
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${settings.paymentSettings.mode === "INTEGRATED" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}
                onClick={() => updatePaymentSettings({ mode: "INTEGRATED" })}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${settings.paymentSettings.mode === "INTEGRATED" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">{tAdmin(locale, "admin.payments.mode.integrated", "Integrated Payment")}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{tAdmin(locale, "admin.payments.mode.integrated.help", "Integrate with a payment gateway to receive online payments automatically")}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <Label htmlFor="manualInstructions">{tAdmin(locale, "admin.payments.manual.instructions", "Instructions for Customer")}</Label>
              <Textarea id="manualInstructions" value={settings.paymentSettings.manualInstructions} onChange={(e) => updatePaymentSettings({ manualInstructions: e.target.value })} placeholder={tAdmin(locale, "admin.payments.manual.instructions.placeholder", "After placing the order, our team will contact you...")} rows={3} />
              <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.payments.manual.instructions.help", "This message is shown to customers after checkout")}</p>
            </div>

            {settings.paymentSettings.mode === "INTEGRATED" && (
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <Label htmlFor="integratedFlow">Estratégia de cobrança integrada</Label>
                <Select
                  value={settings.paymentSettings.integratedFlow || "AUTO_CHARGE"}
                  onValueChange={(value: "AUTO_CHARGE" | "LINK_AFTER_VALIDATION") => updatePaymentSettings({ integratedFlow: value })}
                >
                  <SelectTrigger id="integratedFlow">
                    <SelectValue placeholder="Selecione a estratégia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO_CHARGE">Cobrança automática no checkout</SelectItem>
                    <SelectItem value="LINK_AFTER_VALIDATION">Gerar link após validação</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Defina se o pedido cobra automaticamente no checkout ou se a loja valida primeiro e envia link de pagamento depois.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Provider */}
        {settings.paymentSettings.mode === "INTEGRATED" && (
          <Card>
            <CardHeader>
              <CardTitle>{tAdmin(locale, "admin.payments.provider.title", "Payment Provider")}</CardTitle>
              <CardDescription>{tAdmin(locale, "admin.payments.provider.description", "Select and configure your payment gateway")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.payments.provider.label", "Provider")}</Label>
                <Select value={settings.paymentSettings.provider} onValueChange={(value: "STRIPE" | "MERCADO_PAGO" | "PAGBANK" | "ASAAS" | "GETNET" | "PAGARME" | "REDE" | "NONE") => updatePaymentSettings({ provider: value })}>
                  <SelectTrigger><SelectValue placeholder={tAdmin(locale, "admin.payments.provider.placeholder", "Select a provider")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{tAdmin(locale, "admin.payments.provider.none", "None (configure later)")}</SelectItem>
                    <SelectItem value="STRIPE">Stripe</SelectItem>
                    <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
                    <SelectItem value="PAGBANK">PagBank</SelectItem>
                    <SelectItem value="ASAAS">Asaas</SelectItem>
                    <SelectItem value="GETNET">Getnet</SelectItem>
                    <SelectItem value="REDE">e-Rede</SelectItem>
                    <SelectItem value="PAGARME">Pagar.me</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.paymentSettings.provider !== "NONE" && (
                <div className="space-y-2">
                  <Label htmlFor="gatewayEnvironment">Ambiente do gateway</Label>
                  <Select
                    value={settings.paymentSettings.gatewayEnvironment || "PRODUCTION"}
                    onValueChange={(value: "PRODUCTION" | "SANDBOX") =>
                      updatePaymentSettings({
                        gatewayEnvironment: value,
                      })
                    }
                  >
                    <SelectTrigger id="gatewayEnvironment">
                      <SelectValue placeholder="Selecione o ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUCTION">Produção</SelectItem>
                      <SelectItem value="SANDBOX">Sandbox / Homologação</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Usado pelo backend para resolver URL e credenciais por ambiente. Para PagBank, sandbox troca automaticamente para endpoint sandbox quando não houver base_url customizada.
                  </p>
                </div>
              )}

              {settings.paymentSettings.provider !== "NONE" && (
                <>
                  <Separator />
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-600">{providerConfig?.title || tAdmin(locale, "admin.payments.gateway.credentials.title", "Gateway Credentials")}</p>
                      <p className="text-sm text-muted-foreground">{providerConfig?.description || tAdmin(locale, "admin.payments.gateway.credentials.help", "Never share your secret keys. Keep them safe.")}</p>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">{providerConfig?.apiKeyLabel || "API Key"}</Label>
                      <div className="relative">
                        <Input
                          id="apiKey"
                          type={showApiKey ? "text" : "password"}
                          value={settings.paymentSettings.apiKey || ""}
                          onChange={(e) => updatePaymentSettings({ apiKey: e.target.value || null })}
                          placeholder={providerConfig?.apiKeyPlaceholder || ""}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                          onClick={() => setShowApiKey((prev) => !prev)}
                          aria-label={showApiKey ? "Ocultar chave" : "Mostrar chave"}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secretKey">{providerConfig?.secretKeyLabel || "Secret Key"}</Label>
                      <div className="relative">
                        <Input
                          id="secretKey"
                          type={showSecretKey ? "text" : "password"}
                          value={settings.paymentSettings.secretKey || ""}
                          onChange={(e) => updatePaymentSettings({ secretKey: e.target.value || null })}
                          placeholder={providerConfig?.secretKeyPlaceholder || ""}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                          onClick={() => setShowSecretKey((prev) => !prev)}
                          aria-label={showSecretKey ? "Ocultar segredo" : "Mostrar segredo"}
                        >
                          {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhookSecret">{providerConfig?.webhookLabel || "Webhook (opcional)"}</Label>
                      <div className="relative">
                        <Input
                          id="webhookSecret"
                          type={showWebhookSecret ? "text" : "password"}
                          value={provider === "PAGBANK" ? (settings.paymentSettings.webhookToken || "") : (settings.paymentSettings.webhookSecret || "")}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            if (provider === "PAGBANK") {
                              updatePaymentSettings({ webhookToken: value });
                              return;
                            }

                            updatePaymentSettings({ webhookSecret: value });
                          }}
                          placeholder={providerConfig?.webhookPlaceholder || ""}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                          onClick={() => setShowWebhookSecret((prev) => !prev)}
                          aria-label={showWebhookSecret ? "Ocultar webhook" : "Mostrar webhook"}
                        >
                          {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="providerWebhookUrl">URL do Webhook (automatico via API)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="providerWebhookUrl"
                          value={providerWebhookUrl}
                          readOnly
                          placeholder="Defina PAYMENT_WEBHOOK_BASE_URL no backend para preencher automaticamente"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleCopyWebhookUrl}
                          disabled={!providerWebhookUrl}
                          aria-label="Copiar URL do webhook"
                          title="Copiar URL do webhook"
                        >
                          {copiedWebhookUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Esta URL e enviada automaticamente nas chamadas da API do gateway. Copie e use no painel apenas como contingencia.
                      </p>
                      {!providerWebhookUrl && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                          URL nao preenchida. Configure a env PAYMENT_WEBHOOK_BASE_URL no backend e salve novamente.
                        </div>
                      )}
                    </div>

                    {provider === "GETNET" && (
                      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                        <p className="text-sm font-medium text-emerald-800">Subscription de webhook Getnet</p>
                        <p className="text-xs text-emerald-700/90">
                          Registra/consulta/remove direto na API da Getnet e persiste o subscription_id na configuração da loja.
                        </p>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="getnetWebhookEvent">Evento da subscription</Label>
                            <Input
                              id="getnetWebhookEvent"
                              value={getnetWebhookEvent}
                              onChange={(e) =>
                                updatePaymentSettings({ getnetWebhookEvent: e.target.value.toUpperCase() || null })
                              }
                              placeholder="APPROVED_TRANSACTIONS"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="getnetSubscriptionId">Subscription ID</Label>
                            <Input
                              id="getnetSubscriptionId"
                              value={getnetSubscriptionId}
                              readOnly
                              placeholder="Ainda não registrada"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="getnetAuthType">Authentication Type</Label>
                            <Input id="getnetAuthType" value={getnetAuthenticationType} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="getnetCallbackUrl">Callback URL ativo</Label>
                            <Input id="getnetCallbackUrl" value={providerWebhookUrl} readOnly />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="default"
                            disabled={isSaving || !providerWebhookUrl || getnetOperation !== null}
                            onClick={() => void handleManageGetnetSubscription("register")}
                          >
                            {getnetOperation === "register" ? "Registrando..." : "Registrar"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isSaving || !providerWebhookUrl || getnetOperation !== null}
                            onClick={() => void handleManageGetnetSubscription("consult")}
                          >
                            {getnetOperation === "consult" ? "Consultando..." : "Consultar"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={isSaving || !providerWebhookUrl || getnetOperation !== null}
                            onClick={() => void handleManageGetnetSubscription("remove")}
                          >
                            {getnetOperation === "remove" ? "Removendo..." : "Remover"}
                          </Button>
                        </div>

                        {getnetFeedback && (
                          <p className="text-xs text-muted-foreground">{getnetFeedback}</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Methods */}
        <Card id="payment-methods">
          <CardHeader>
            <CardTitle>{tAdmin(locale, "admin.payments.methods.title", "Accepted Payment Methods")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.payments.methods.description", "Choose which payment methods are available")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                      <Label>{tAdmin(locale, "admin.payments.methods.pix", "PIX")}</Label>
                  <Badge variant="outline" className="text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">{tAdmin(locale, "admin.payments.instant", "Instant")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.payments.methods.pix.help", "Instant payment via PIX")}</p>
              </div>
              <Switch checked={settings.paymentSettings.enablePix} onCheckedChange={(checked) => updatePaymentSettings({ enablePix: checked })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{tAdmin(locale, "admin.payments.methods.boleto", "Bank Slip")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.payments.methods.boleto.help", "Bank slip payment due in 3 days")}</p>
              </div>
              <Switch checked={settings.paymentSettings.enableBoleto} onCheckedChange={(checked) => updatePaymentSettings({ enableBoleto: checked })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>{tAdmin(locale, "admin.payments.methods.card", "Credit Card")}</Label>
                </div>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.payments.methods.card.help", "Installment payments with credit card")}</p>
              </div>
              <Switch checked={settings.paymentSettings.enableCreditCard} onCheckedChange={(checked) => updatePaymentSettings({ enableCreditCard: checked })} />
            </div>
            {settings.paymentSettings.enableCreditCard && (
              <div className="ml-4 pl-4 border-l-2 border-muted space-y-2">
                <div className="grid gap-4 md:grid-cols-[224px_minmax(0,220px)] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="maxInstallments">{tAdmin(locale, "admin.payments.installments.label", "Interest-free installments")}</Label>
                    <Select
                      value={String(settings.paymentSettings.maxInstallments ?? 12)}
                      onValueChange={(value) => updatePaymentSettings({ maxInstallments: Number.parseInt(value, 10) || 1 })}
                    >
                      <SelectTrigger id="maxInstallments" className="w-full md:w-56">
                        <SelectValue placeholder={tAdmin(locale, "admin.common.select", "Select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, index) => index + 1).map((installments) => (
                          <SelectItem key={installments} value={String(installments)}>
                            {tAdmin(locale, "admin.payments.installments.option", `${installments}x interest-free`).replace("{n}", String(installments))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{tAdmin(locale, "admin.payments.installments.minAmount", "Minimum installment amount (R$)")}</Label>
                    <CurrencyInput
                      value={settings.paymentSettings.creditCardConditions?.minInstallmentAmount ?? null}
                      onChange={(value) => updatePaymentSettings({
                        creditCardConditions: {
                          ...settings.paymentSettings.creditCardConditions,
                          minInstallmentAmount: value,
                        },
                      })}
                      min={0}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
            )}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label>{tAdmin(locale, "admin.payments.methods.faturado", "Invoice Terms")}</Label>
                    <Badge variant="outline" className="text-xs font-medium bg-violet-50 text-violet-600 border border-violet-100">B2B</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.payments.methods.faturado.help", "Invoice payment for approved customers")}</p>
                </div>
                <Switch checked={settings.paymentSettings.enableFaturado} onCheckedChange={(checked) => updatePaymentSettings({ enableFaturado: checked })} />
              </div>
              {settings.paymentSettings.enableFaturado && (
                <div className="ml-4 pl-4 border-l-2 border-muted space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{tAdmin(locale, "admin.payments.faturado.minOrder", "Minimum invoice amount (R$)")}</Label>
                      <CurrencyInput value={settings.paymentSettings.faturadoMinOrderValue || null} onChange={(value) => updatePaymentSettings({ faturadoMinOrderValue: value })} placeholder="500,00" />
                    </div>
                    <div className="space-y-2">
                      <Label>{tAdmin(locale, "admin.payments.faturado.maxDays", "Maximum term (days)")}</Label>
                      <Input type="number" value={settings.paymentSettings.faturadoMaxDays} onChange={(e) => updatePaymentSettings({ faturadoMaxDays: Number.parseInt(e.target.value) || 30 })} placeholder="30" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Custom Manual Payment Methods */}
        <Card id="manual-payments">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {tAdmin(locale, "admin.payments.manualMethods.title", "Manual Payment Methods")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.payments.manualMethods.description", "Create custom manual payment options such as bank transfer, check, and others")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(settings.paymentSettings.customMethods ?? []).length === 0 ? (
              <div className="rounded-lg border-2 border-dashed py-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" />
                <p className="text-sm">{tAdmin(locale, "admin.payments.manualMethods.empty", "No manual method added")}</p>
                <p className="text-xs">{tAdmin(locale, "admin.payments.manualMethods.emptyHint", "Click \"Add Method\" to create one")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(settings.paymentSettings.customMethods ?? [])
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((method, idx, arr) => (
                    <div key={customPaymentMethodKey(method, idx)} className={`overflow-hidden rounded-lg border transition-colors ${method.isActive ? "bg-card" : "bg-muted/40 opacity-70"}`}>
                      <div className="flex items-center gap-3 p-3">
                        <div className="shrink-0 flex flex-col gap-0.5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0}
                            onClick={() => {
                              const methods = [...(settings.paymentSettings.customMethods ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                              const cur = methods[idx]; const prev = methods[idx - 1];
                              updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, cur) ? { ...m, sortOrder: prev.sortOrder } : customPaymentMethodsMatch(m, prev) ? { ...m, sortOrder: cur.sortOrder } : m) });
                            }}>
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === arr.length - 1}
                            onClick={() => {
                              const methods = [...(settings.paymentSettings.customMethods ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                              const cur = methods[idx]; const next = methods[idx + 1];
                              updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, cur) ? { ...m, sortOrder: next.sortOrder } : customPaymentMethodsMatch(m, next) ? { ...m, sortOrder: cur.sortOrder } : m) });
                            }}>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{method.title || <span className="italic text-muted-foreground">{tAdmin(locale, "admin.payments.manualMethods.noTitle", "Untitled")}</span>}</p>
                          {method.description && <p className="truncate text-xs text-muted-foreground">{method.description}</p>}
                          {(method.conditions?.discountPercent || 0) > 0 && (<Badge className="mt-1 bg-green-600 text-xs">{formatPercentLabel(method.conditions?.discountPercent)}% OFF</Badge>)}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <Switch checked={method.isActive} onCheckedChange={(checked) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, method) ? { ...m, isActive: checked } : m) })} />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).filter(m => !customPaymentMethodsMatch(m, method)) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3 border-t bg-muted/20 p-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">{tAdmin(locale, "admin.payments.manualMethods.field.title", "Title")}</Label>
                            <Input value={method.title} onChange={(e) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, method) ? { ...m, title: e.target.value } : m) })} placeholder={tAdmin(locale, "admin.payments.manualMethods.field.title.placeholder", "e.g. Bank Transfer")} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">{tAdmin(locale, "admin.payments.field.discountPercent", "Discount (%)")}</Label>
                            <PercentageInput
                              value={(method.conditions?.discountPercent || 0) / 100}
                              onChange={(value) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, method) ? { ...m, conditions: { ...m.conditions, discountPercent: (value ?? 0) * 100 } } : m) })}
                              min={0} max={100} decimals={1} placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{tAdmin(locale, "admin.payments.manualMethods.field.instructions", "Customer instructions")}</Label>
                          <Textarea value={method.description} onChange={(e) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, method) ? { ...m, description: e.target.value } : m) })} placeholder={tAdmin(locale, "admin.payments.manualMethods.field.instructions.placeholder", "Describe how the customer should proceed...")} rows={2} className="resize-none text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">{tAdmin(locale, "admin.payments.field.minValue", "Minimum value (R$)")}</Label>
                            <CurrencyInput value={method.conditions?.minOrderValue ?? null} onChange={(value) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, method) ? { ...m, conditions: { ...m.conditions, minOrderValue: value } } : m) })} min={0} placeholder={tAdmin(locale, "admin.payments.field.noMinimum", "No minimum")} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">{tAdmin(locale, "admin.payments.field.maxValue", "Maximum value (R$)")}</Label>
                            <CurrencyInput value={method.conditions?.maxOrderValue ?? null} onChange={(value) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => customPaymentMethodsMatch(m, method) ? { ...m, conditions: { ...m.conditions, maxOrderValue: value } } : m) })} min={0} placeholder={tAdmin(locale, "admin.payments.field.noLimit", "No limit")} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <Button variant="outline" className="w-full"
              onClick={() => {
                const maxOrder = Math.max(0, ...(settings.paymentSettings.customMethods ?? []).map(m => m.sortOrder));
                const newMethod: CustomPaymentMethod = { id: `custom_${Date.now()}`, title: "", description: "", icon: null, isActive: true, sortOrder: maxOrder + 1, conditions: { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, label: null } };
                updatePaymentSettings({ customMethods: [...(settings.paymentSettings.customMethods ?? []), newMethod] });
              }}>
              <Plus className="mr-2 h-4 w-4" />
              {tAdmin(locale, "admin.payments.manualMethods.add", "Add Manual Method")}
            </Button>
          </CardContent>
        </Card>

        {/* Conditions / Discounts per method */}
        <Card id="payment-conditions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              {tAdmin(locale, "admin.payments.conditions.title", "Discounts and Method Conditions")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.payments.conditions.description", "Configure discounts, fees, and specific conditions for each payment method")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings.paymentSettings.enablePix && (
              <div className="space-y-4 rounded-lg border bg-green-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-green-100 p-2"><QrCode className="h-4 w-4 text-green-600" /></div>
                    <div>
                      <p className="font-medium">{tAdmin(locale, "admin.payments.methods.pix", "PIX")}</p>
                      <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.payments.conditions.pix.help", "Configure discount for PIX payments")}</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.pixConditions?.discountPercent || 0) > 0 && (<Badge className="bg-green-600">{formatPercentLabel(settings.paymentSettings.pixConditions?.discountPercent)}% OFF</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.discountPercent", "Discount (%)")}</Label>
                    <PercentageInput value={(settings.paymentSettings.pixConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="5" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.fixedDiscount", "Fixed discount (R$)")}</Label>
                    <CurrencyInput value={settings.paymentSettings.pixConditions?.discountFixed || null} onChange={(value) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, discountFixed: value ?? 0 } })} min={0} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.minValue", "Minimum value (R$)")}</Label>
                    <CurrencyInput value={settings.paymentSettings.pixConditions?.minOrderValue || null} onChange={(value) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, minOrderValue: value } })} min={0} placeholder={tAdmin(locale, "admin.payments.field.noMinimum", "No minimum")} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.customLabel", "Custom label")}</Label>
                    <Input value={settings.paymentSettings.pixConditions?.label || ""} onChange={(e) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, label: e.target.value || null } })} placeholder={tAdmin(locale, "admin.payments.conditions.pix.label.placeholder", "e.g. 5% OFF on PIX")} />
                  </div>
                </div>
                {hasConfiguredDiscount(settings.paymentSettings.pixConditions) && (
                  <div className="flex items-center justify-between rounded-md border bg-background/70 px-3 py-2">
                    <Label className="text-xs">
                      {tAdmin(locale, "admin.payments.field.allowDiscountCombination", "Permitir combinação com produtos em promoção")}
                    </Label>
                    <Switch
                      checked={settings.paymentSettings.pixConditions?.allowDiscountCombination ?? true}
                      onCheckedChange={(checked) =>
                        updatePaymentSettings({
                          pixConditions: {
                            ...settings.paymentSettings.pixConditions,
                            allowDiscountCombination: checked,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {settings.paymentSettings.enableBoleto && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-muted p-2"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">{tAdmin(locale, "admin.payments.methods.boleto", "Bank Slip")}</p>
                      <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.payments.conditions.boleto.help", "Configure conditions for bank slip")}</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.boletoConditions?.feePercent || 0) > 0 && (<Badge variant="outline">+{formatPercentLabel(settings.paymentSettings.boletoConditions?.feePercent)}% taxa</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.discountPercent", "Discount (%)")}</Label>
                    <PercentageInput value={(settings.paymentSettings.boletoConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.additionalFee", "Additional fee (%)")}</Label>
                    <PercentageInput value={(settings.paymentSettings.boletoConditions?.feePercent || 0) / 100} onChange={(value) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, feePercent: (value ?? 0) * 100 } })} min={0} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.minValue", "Minimum value (R$)")}</Label>
                    <CurrencyInput value={settings.paymentSettings.boletoConditions?.minOrderValue || null} onChange={(value) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, minOrderValue: value } })} min={0} placeholder={tAdmin(locale, "admin.payments.field.noMinimum", "No minimum")} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.customLabel", "Custom label")}</Label>
                    <Input value={settings.paymentSettings.boletoConditions?.label || ""} onChange={(e) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, label: e.target.value || null } })} placeholder={tAdmin(locale, "admin.payments.conditions.boleto.label.placeholder", "e.g. Due in 3 days")} />
                  </div>
                </div>
                {hasConfiguredDiscount(settings.paymentSettings.boletoConditions) && (
                  <div className="flex items-center justify-between rounded-md border bg-background/70 px-3 py-2">
                    <Label className="text-xs">
                      {tAdmin(locale, "admin.payments.field.allowDiscountCombination", "Permitir combinação com produtos em promoção")}
                    </Label>
                    <Switch
                      checked={settings.paymentSettings.boletoConditions?.allowDiscountCombination ?? true}
                      onCheckedChange={(checked) =>
                        updatePaymentSettings({
                          boletoConditions: {
                            ...settings.paymentSettings.boletoConditions,
                            allowDiscountCombination: checked,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {settings.paymentSettings.enableCreditCard && (
              <div className="space-y-4 rounded-lg border bg-blue-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-blue-100 p-2"><CreditCard className="h-4 w-4 text-blue-600" /></div>
                    <div>
                      <p className="font-medium">{tAdmin(locale, "admin.payments.methods.card", "Credit Card")}</p>
                      <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.payments.conditions.card.help", "Configure card conditions")}</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.creditCardConditions?.feePercent || 0) > 0 && (<Badge variant="outline">+{formatPercentLabel(settings.paymentSettings.creditCardConditions?.feePercent)}% juros</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.conditions.card.cashDiscount", "Cash discount (%)")}</Label>
                    <PercentageInput value={(settings.paymentSettings.creditCardConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.conditions.card.installmentInterest", "Installment interest (%)")}</Label>
                    <PercentageInput value={(settings.paymentSettings.creditCardConditions?.feePercent || 0) / 100} onChange={(value) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, feePercent: (value ?? 0) * 100 } })} min={0} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.minValue", "Minimum value (R$)")}</Label>
                    <CurrencyInput value={settings.paymentSettings.creditCardConditions?.minOrderValue || null} onChange={(value) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, minOrderValue: value } })} min={0} placeholder={tAdmin(locale, "admin.payments.field.noMinimum", "No minimum")} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.customLabel", "Custom label")}</Label>
                    <Input value={settings.paymentSettings.creditCardConditions?.label || ""} onChange={(e) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, label: e.target.value || null } })} placeholder={tAdmin(locale, "admin.payments.conditions.card.label.placeholder", "e.g. Up to 12 installments")} />
                  </div>
                </div>
                {hasConfiguredDiscount(settings.paymentSettings.creditCardConditions) && (
                  <div className="flex items-center justify-between rounded-md border bg-background/70 px-3 py-2">
                    <Label className="text-xs">
                      {tAdmin(locale, "admin.payments.field.allowDiscountCombination", "Permitir combinação com produtos em promoção")}
                    </Label>
                    <Switch
                      checked={settings.paymentSettings.creditCardConditions?.allowDiscountCombination ?? true}
                      onCheckedChange={(checked) =>
                        updatePaymentSettings({
                          creditCardConditions: {
                            ...settings.paymentSettings.creditCardConditions,
                            allowDiscountCombination: checked,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {settings.paymentSettings.enableFaturado && (
              <div className="space-y-4 rounded-lg border bg-amber-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-amber-100 p-2"><FileText className="h-4 w-4 text-amber-600" /></div>
                    <div>
                      <p className="font-medium">{tAdmin(locale, "admin.payments.methods.faturado", "Invoice Terms")}</p>
                      <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.payments.conditions.faturado.help", "Configure invoice conditions")}</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.faturadoConditions?.discountPercent || 0) > 0 && (<Badge className="bg-amber-600">{formatPercentLabel(settings.paymentSettings.faturadoConditions?.discountPercent)}% OFF</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.discountPercent", "Discount (%)")}</Label>
                    <PercentageInput value={(settings.paymentSettings.faturadoConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.additionalFee", "Additional fee (%)")}</Label>
                    <PercentageInput value={(settings.paymentSettings.faturadoConditions?.feePercent || 0) / 100} onChange={(value) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, feePercent: (value ?? 0) * 100 } })} min={0} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.maxValue", "Maximum value (R$)")}</Label>
                    <CurrencyInput value={settings.paymentSettings.faturadoConditions?.maxOrderValue || null} onChange={(value) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, maxOrderValue: value } })} min={0} placeholder={tAdmin(locale, "admin.payments.field.noLimit", "No limit")} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tAdmin(locale, "admin.payments.field.customLabel", "Custom label")}</Label>
                    <Input value={settings.paymentSettings.faturadoConditions?.label || ""} onChange={(e) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, label: e.target.value || null } })} placeholder={tAdmin(locale, "admin.payments.conditions.faturado.label.placeholder", "e.g. 30/60/90 days")} />
                  </div>
                </div>
                {hasConfiguredDiscount(settings.paymentSettings.faturadoConditions) && (
                  <div className="flex items-center justify-between rounded-md border bg-background/70 px-3 py-2">
                    <Label className="text-xs">
                      {tAdmin(locale, "admin.payments.field.allowDiscountCombination", "Permitir combinação com produtos em promoção")}
                    </Label>
                    <Switch
                      checked={settings.paymentSettings.faturadoConditions?.allowDiscountCombination ?? true}
                      onCheckedChange={(checked) =>
                        updatePaymentSettings({
                          faturadoConditions: {
                            ...settings.paymentSettings.faturadoConditions,
                            allowDiscountCombination: checked,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {!settings.paymentSettings.enablePix && !settings.paymentSettings.enableBoleto && !settings.paymentSettings.enableCreditCard && !settings.paymentSettings.enableFaturado && (
              <div className="py-8 text-center text-muted-foreground">
                <p>{tAdmin(locale, "admin.payments.conditions.empty", "Enable at least one payment method above to configure discounts and conditions.")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={onSave}
        disabled={isSaving}
        className="fixed sm:bottom-6 bottom-20 right-6 z-50 h-12 rounded-full px-4 shadow-lg"
        aria-label="Salvar"
        title="Salvar"
      >
        <Save className="mr-2 h-5 w-5" />
        Salvar
      </Button>
    </div>
  );
}
