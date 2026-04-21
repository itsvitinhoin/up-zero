"use client";

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
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { SiteSettings, PaymentSettings, CustomPaymentMethod } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

interface PaymentsTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  isSaving: boolean;
  onSave: () => void;
}

function formatPercentLabel(value: number | null | undefined): string {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";

  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function PaymentsTab({ locale = "en", settings, setSettings, isSaving, onSave }: PaymentsTabProps) {
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
      title: "Chaves da API Stripe",
      description: "Use a chave publicável, chave secreta e secret de webhook da Stripe.",
      apiKeyLabel: "Chave Publicável",
      apiKeyPlaceholder: "pk_live_...",
      secretKeyLabel: "Chave Secreta",
      secretKeyPlaceholder: "sk_live_...",
      webhookLabel: "Webhook Secret (opcional)",
      webhookPlaceholder: "whsec_...",
    },
    MERCADO_PAGO: {
      title: "Credenciais do Mercado Pago",
      description: "Informe a Public Key e o Access Token da conta do Mercado Pago.",
      apiKeyLabel: "Public Key",
      apiKeyPlaceholder: "APP_USR-...",
      secretKeyLabel: "Access Token",
      secretKeyPlaceholder: "APP_USR-...",
      webhookLabel: "Webhook Secret (opcional)",
      webhookPlaceholder: "Assinatura/segredo do webhook",
    },
    PAGSEGURO: {
      title: "Credenciais do PagBank",
      description: "Informe o Access Token. A Public Key pode ser salva opcionalmente.",
      apiKeyLabel: "Public Key (opcional)",
      apiKeyPlaceholder: "pk_live_...",
      secretKeyLabel: "Access Token",
      secretKeyPlaceholder: "AAEAA...",
      webhookLabel: "Notification URL (opcional)",
      webhookPlaceholder: "https://seu-dominio.com/payment/webhooks/pagbank",
    },
    ASAAS: {
      title: "Credenciais do Asaas",
      description: "Informe o token de API e, se aplicável, a credencial de webhook.",
      apiKeyLabel: "API Key (opcional)",
      apiKeyPlaceholder: "$aact_...",
      secretKeyLabel: "Access Token / API Key",
      secretKeyPlaceholder: "$aact_...",
      webhookLabel: "Webhook Token/Secret (opcional)",
      webhookPlaceholder: "Token de validação do webhook",
    },
  };

  const providerConfig =
    provider !== "NONE" ? gatewayCredentialConfig[provider as Exclude<PaymentSettings["provider"], "NONE">] : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? tAdmin(locale, "admin.common.saving", "Saving...") : tAdmin(locale, "admin.payments.save", "Save Payment Settings")}
        </Button>
      </div>

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

            {settings.paymentSettings.mode === "MANUAL" && (
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <Label htmlFor="manualInstructions">{tAdmin(locale, "admin.payments.manual.instructions", "Instructions for Customer")}</Label>
                <Textarea id="manualInstructions" value={settings.paymentSettings.manualInstructions} onChange={(e) => updatePaymentSettings({ manualInstructions: e.target.value })} placeholder={tAdmin(locale, "admin.payments.manual.instructions.placeholder", "After placing the order, our team will contact you...")} rows={3} />
                <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.payments.manual.instructions.help", "This message is shown to customers after checkout")}</p>
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
                <Label>Provedor</Label>
                <Select value={settings.paymentSettings.provider} onValueChange={(value: "STRIPE" | "MERCADO_PAGO" | "PAGSEGURO" | "ASAAS" | "NONE") => updatePaymentSettings({ provider: value })}>
                  <SelectTrigger><SelectValue placeholder={tAdmin(locale, "admin.payments.provider.placeholder", "Select a provider")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{tAdmin(locale, "admin.payments.provider.none", "None (configure later)")}</SelectItem>
                    <SelectItem value="STRIPE">Stripe</SelectItem>
                    <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
                    <SelectItem value="PAGSEGURO">PagBank</SelectItem>
                    <SelectItem value="ASAAS">Asaas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.paymentSettings.provider !== "NONE" && (
                <>
                  <Separator />
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-600">{providerConfig?.title || "Credenciais do Gateway"}</p>
                      <p className="text-sm text-muted-foreground">{providerConfig?.description || "Nunca compartilhe suas chaves secretas. Mantenha-as seguras."}</p>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">{providerConfig?.apiKeyLabel || "API Key"}</Label>
                      <Input id="apiKey" type="password" value={settings.paymentSettings.apiKey || ""} onChange={(e) => updatePaymentSettings({ apiKey: e.target.value || null })} placeholder={providerConfig?.apiKeyPlaceholder || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secretKey">{providerConfig?.secretKeyLabel || "Secret Key"}</Label>
                      <Input id="secretKey" type="password" value={settings.paymentSettings.secretKey || ""} onChange={(e) => updatePaymentSettings({ secretKey: e.target.value || null })} placeholder={providerConfig?.secretKeyPlaceholder || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhookSecret">{providerConfig?.webhookLabel || "Webhook (opcional)"}</Label>
                      <Input id="webhookSecret" type="password" value={settings.paymentSettings.webhookSecret || ""} onChange={(e) => updatePaymentSettings({ webhookSecret: e.target.value || null })} placeholder={providerConfig?.webhookPlaceholder || ""} />
                    </div>
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
                  <Label>PIX</Label>
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
                  <Label>Cartao de Credito</Label>
                  {settings.paymentSettings.mode === "MANUAL" && (
                    <Badge variant="outline" className="text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100">{tAdmin(locale, "admin.payments.requiresIntegration", "Requires integration")}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.payments.methods.card.help", "Installment payments with credit card")}</p>
              </div>
              <Switch checked={settings.paymentSettings.enableCreditCard} onCheckedChange={(checked) => updatePaymentSettings({ enableCreditCard: checked })} disabled={settings.paymentSettings.mode === "MANUAL"} />
            </div>
            {settings.paymentSettings.enableCreditCard && (
              <div className="ml-4 pl-4 border-l-2 border-muted space-y-2">
                <Label htmlFor="maxInstallments">Parcelamento sem juros</Label>
                <Select
                  value={String(settings.paymentSettings.maxInstallments ?? 12)}
                  onValueChange={(value) => updatePaymentSettings({ maxInstallments: Number.parseInt(value, 10) || 1 })}
                >
                  <SelectTrigger id="maxInstallments" className="w-full md:w-56">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((installments) => (
                      <SelectItem key={installments} value={String(installments)}>
                        {installments}x sem juros
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label>Faturado (A Prazo)</Label>
                    <Badge variant="outline" className="text-xs font-medium bg-violet-50 text-violet-600 border border-violet-100">B2B</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Pagamento faturado para clientes aprovados</p>
                </div>
                <Switch checked={settings.paymentSettings.enableFaturado} onCheckedChange={(checked) => updatePaymentSettings({ enableFaturado: checked })} />
              </div>
              {settings.paymentSettings.enableFaturado && (
                <div className="ml-4 pl-4 border-l-2 border-muted space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Minimo para Faturado (R$)</Label>
                      <CurrencyInput value={settings.paymentSettings.faturadoMinOrderValue || null} onChange={(value) => updatePaymentSettings({ faturadoMinOrderValue: value })} placeholder="500,00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Prazo Maximo (dias)</Label>
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
                    <div key={method.id} className={`overflow-hidden rounded-lg border transition-colors ${method.isActive ? "bg-card" : "bg-muted/40 opacity-70"}`}>
                      <div className="flex items-center gap-3 p-3">
                        <div className="shrink-0 flex flex-col gap-0.5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0}
                            onClick={() => {
                              const methods = [...(settings.paymentSettings.customMethods ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                              const cur = methods[idx]; const prev = methods[idx - 1];
                              updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === cur.id ? { ...m, sortOrder: prev.sortOrder } : m.id === prev.id ? { ...m, sortOrder: cur.sortOrder } : m) });
                            }}>
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === arr.length - 1}
                            onClick={() => {
                              const methods = [...(settings.paymentSettings.customMethods ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                              const cur = methods[idx]; const next = methods[idx + 1];
                              updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === cur.id ? { ...m, sortOrder: next.sortOrder } : m.id === next.id ? { ...m, sortOrder: cur.sortOrder } : m) });
                            }}>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{method.title || <span className="italic text-muted-foreground">Sem titulo</span>}</p>
                          {method.description && <p className="truncate text-xs text-muted-foreground">{method.description}</p>}
                          {(method.conditions?.discountPercent || 0) > 0 && (<Badge className="mt-1 bg-green-600 text-xs">{formatPercentLabel(method.conditions?.discountPercent)}% OFF</Badge>)}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <Switch checked={method.isActive} onCheckedChange={(checked) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === method.id ? { ...m, isActive: checked } : m) })} />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).filter(m => m.id !== method.id) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3 border-t bg-muted/20 p-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Titulo *</Label>
                            <Input value={method.title} onChange={(e) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === method.id ? { ...m, title: e.target.value } : m) })} placeholder="Ex: Deposito Bancario" className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Desconto (%)</Label>
                            <PercentageInput
                              value={(method.conditions?.discountPercent || 0) / 100}
                              onChange={(value) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === method.id ? { ...m, conditions: { ...m.conditions, discountPercent: (value ?? 0) * 100 } } : m) })}
                              min={0} max={100} decimals={1} placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Instrucoes para o Cliente</Label>
                          <Textarea value={method.description} onChange={(e) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === method.id ? { ...m, description: e.target.value } : m) })} placeholder="Detalhe como o cliente deve proceder..." rows={2} className="resize-none text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Valor Minimo (R$)</Label>
                            <CurrencyInput value={method.conditions?.minOrderValue ?? null} onChange={(value) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === method.id ? { ...m, conditions: { ...m.conditions, minOrderValue: value } } : m) })} min={0} placeholder="Sem minimo" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Valor Maximo (R$)</Label>
                            <CurrencyInput value={method.conditions?.maxOrderValue ?? null} onChange={(value) => updatePaymentSettings({ customMethods: (settings.paymentSettings.customMethods ?? []).map(m => m.id === method.id ? { ...m, conditions: { ...m.conditions, maxOrderValue: value } } : m) })} min={0} placeholder="Sem limite" />
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
                      <p className="font-medium">PIX</p>
                      <p className="text-xs text-muted-foreground">Configure desconto para pagamento via PIX</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.pixConditions?.discountPercent || 0) > 0 && (<Badge className="bg-green-600">{formatPercentLabel(settings.paymentSettings.pixConditions?.discountPercent)}% OFF</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Desconto (%)</Label>
                    <PercentageInput value={(settings.paymentSettings.pixConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="5" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Desconto Fixo (R$)</Label>
                    <CurrencyInput value={settings.paymentSettings.pixConditions?.discountFixed || null} onChange={(value) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, discountFixed: value ?? 0 } })} min={0} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Valor Minimo (R$)</Label>
                    <CurrencyInput value={settings.paymentSettings.pixConditions?.minOrderValue || null} onChange={(value) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, minOrderValue: value } })} min={0} placeholder="Sem minimo" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Label Customizado</Label>
                    <Input value={settings.paymentSettings.pixConditions?.label || ""} onChange={(e) => updatePaymentSettings({ pixConditions: { ...settings.paymentSettings.pixConditions, label: e.target.value || null } })} placeholder="Ex: 5% OFF no PIX" />
                  </div>
                </div>
              </div>
            )}

            {settings.paymentSettings.enableBoleto && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-muted p-2"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Boleto Bancario</p>
                      <p className="text-xs text-muted-foreground">Configure condicoes para boleto</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.boletoConditions?.feePercent || 0) > 0 && (<Badge variant="outline">+{formatPercentLabel(settings.paymentSettings.boletoConditions?.feePercent)}% taxa</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Desconto (%)</Label>
                    <PercentageInput value={(settings.paymentSettings.boletoConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Taxa Adicional (%)</Label>
                    <PercentageInput value={(settings.paymentSettings.boletoConditions?.feePercent || 0) / 100} onChange={(value) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, feePercent: (value ?? 0) * 100 } })} min={0} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Valor Minimo (R$)</Label>
                    <CurrencyInput value={settings.paymentSettings.boletoConditions?.minOrderValue || null} onChange={(value) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, minOrderValue: value } })} min={0} placeholder="Sem minimo" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Label Customizado</Label>
                    <Input value={settings.paymentSettings.boletoConditions?.label || ""} onChange={(e) => updatePaymentSettings({ boletoConditions: { ...settings.paymentSettings.boletoConditions, label: e.target.value || null } })} placeholder="Ex: Vencimento em 3 dias" />
                  </div>
                </div>
              </div>
            )}

            {settings.paymentSettings.enableCreditCard && (
              <div className="space-y-4 rounded-lg border bg-blue-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-blue-100 p-2"><CreditCard className="h-4 w-4 text-blue-600" /></div>
                    <div>
                      <p className="font-medium">Cartao de Credito</p>
                      <p className="text-xs text-muted-foreground">Configure condicoes para cartao</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.creditCardConditions?.feePercent || 0) > 0 && (<Badge variant="outline">+{formatPercentLabel(settings.paymentSettings.creditCardConditions?.feePercent)}% juros</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Desconto a vista (%)</Label>
                    <PercentageInput value={(settings.paymentSettings.creditCardConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Juros Parcelado (%)</Label>
                    <PercentageInput value={(settings.paymentSettings.creditCardConditions?.feePercent || 0) / 100} onChange={(value) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, feePercent: (value ?? 0) * 100 } })} min={0} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Valor Minimo (R$)</Label>
                    <CurrencyInput value={settings.paymentSettings.creditCardConditions?.minOrderValue || null} onChange={(value) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, minOrderValue: value } })} min={0} placeholder="Sem minimo" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Label Customizado</Label>
                    <Input value={settings.paymentSettings.creditCardConditions?.label || ""} onChange={(e) => updatePaymentSettings({ creditCardConditions: { ...settings.paymentSettings.creditCardConditions, label: e.target.value || null } })} placeholder="Ex: Em ate 12x" />
                  </div>
                </div>
              </div>
            )}

            {settings.paymentSettings.enableFaturado && (
              <div className="space-y-4 rounded-lg border bg-amber-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-amber-100 p-2"><FileText className="h-4 w-4 text-amber-600" /></div>
                    <div>
                      <p className="font-medium">Faturado (A Prazo)</p>
                      <p className="text-xs text-muted-foreground">Configure condicoes para faturamento</p>
                    </div>
                  </div>
                  {(settings.paymentSettings.faturadoConditions?.discountPercent || 0) > 0 && (<Badge className="bg-amber-600">{formatPercentLabel(settings.paymentSettings.faturadoConditions?.discountPercent)}% OFF</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Desconto (%)</Label>
                    <PercentageInput value={(settings.paymentSettings.faturadoConditions?.discountPercent || 0) / 100} onChange={(value) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, discountPercent: (value ?? 0) * 100 } })} min={0} max={100} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Taxa Adicional (%)</Label>
                    <PercentageInput value={(settings.paymentSettings.faturadoConditions?.feePercent || 0) / 100} onChange={(value) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, feePercent: (value ?? 0) * 100 } })} min={0} decimals={1} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Valor Maximo (R$)</Label>
                    <CurrencyInput value={settings.paymentSettings.faturadoConditions?.maxOrderValue || null} onChange={(value) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, maxOrderValue: value } })} min={0} placeholder="Sem limite" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Label Customizado</Label>
                    <Input value={settings.paymentSettings.faturadoConditions?.label || ""} onChange={(e) => updatePaymentSettings({ faturadoConditions: { ...settings.paymentSettings.faturadoConditions, label: e.target.value || null } })} placeholder="Ex: 30/60/90 dias" />
                  </div>
                </div>
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
    </div>
  );
}
