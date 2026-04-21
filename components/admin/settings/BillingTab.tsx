"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Crown,
  Calendar,
  Receipt,
  Download,
  Loader2,
  Lock,
  CreditCard,
  Check,
  Copy,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  ArrowRight,
} from "lucide-react";
import type { SiteSettings, BillingPlan, BillingInvoice, BillingSettings } from "@/lib/types";
import { normalizeAdminLocale, tAdmin } from "@/lib/i18n/admin";

const AVAILABLE_PLANS: BillingPlan[] = [
  {
    id: "plan_starter",
    name: "Start B2B",
    priceMonthly: 49900,
    priceYearly: 49900 * 12,
    features: ["Até 5 vendedoras", "Produtos ilimitados", "E-mails transacionais", "Suporte via chat"],
    limits: { products: -1, users: 5, orders: -1, storage: 10 },
  },
  {
    id: "plan_profissional",
    name: "Pro B2B",
    priceMonthly: 89900,
    priceYearly: 89900 * 12,
    features: ["Até 15 vendedoras", "Gateway de pagamento incluso", "Integração Correios", "WhatsApp automático", "Suporte prioritário", "E-mail automático"],
    limits: { products: -1, users: 15, orders: -1, storage: 20 },
  },
  {
    id: "plan_avancado",
    name: "Scale B2B",
    priceMonthly: 149900,
    priceYearly: 149900 * 12,
    features: ["Até 40 vendedoras", "Gateway de pagamento incluso", "Integração Correios", "Mensageria robusta"],
    limits: { products: -1, users: 40, orders: -1, storage: 100 },
  },
  {
    id: "plan_multiloja",
    name: "Multiloja B2B+B2C",
    priceMonthly: 249900,
    priceYearly: 249900 * 12,
    features: ["2 lojas em 1 (B2B + B2C)", "Até 60 vendedoras", "Regras por canal de venda", "Preços diferenciados por canal"],
    limits: { products: -1, users: 60, orders: -1, storage: 250 },
  },
];

function getDefaultBillingSettings(): BillingSettings {
  return {
    subscription: {
      id: "sub_demo",
      plan: AVAILABLE_PLANS[1],
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      startDate: "2026-01-01",
      nextBillingDate: "2026-04-12",
    },
    paymentMethods: [
      {
        id: "pm_pix",
        type: "PIX",
        isDefault: true,
      },
    ],
    invoices: [
      {
        id: "inv_2026_01",
        description: "Plano Pro B2B - Janeiro 2026",
        amount: 89900,
        status: "PAID",
        dueDate: "2026-02-11",
        paidAt: "2026-02-11",
        downloadUrl: "#",
      },
      {
        id: "inv_2026_02",
        description: "Plano Pro B2B - Fevereiro 2026",
        amount: 89900,
        status: "PAID",
        dueDate: "2026-03-06",
        paidAt: "2026-03-06",
        downloadUrl: "#",
      },
      {
        id: "inv_2026_03",
        description: "Plano Pro B2B - Março 2026",
        amount: 89900,
        status: "PENDING",
        dueDate: "2026-03-20",
        downloadUrl: "#",
      },
    ],
  };
}

function formatMoney(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoneyCompact(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function getCardBrand(number: string) {
  const clean = number.replace(/\s/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^5[1-5]/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "Amex";
  return "Card";
}

interface CardForm {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

interface BillingTabProps {
  locale?: string;
  settings: SiteSettings;
}

export function BillingTab({ locale = "en", settings }: BillingTabProps) {
  const normalizedLocale = normalizeAdminLocale(locale);
  const uiLocale = normalizedLocale === "pt-BR" ? "pt-BR" : normalizedLocale;
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback);

  function formatDateByLocale(date: string) {
    return new Date(date).toLocaleDateString(uiLocale);
  }

  function formatDateLongByLocale(date: string) {
    return new Date(date).toLocaleDateString(uiLocale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  const billingCopy: Record<string, { name: string; features: string[] }> = {
    plan_starter: {
      name: "Starter B2B",
      features: ["Up to 5 sellers", "Unlimited products", "Transactional emails", "Chat support"],
    },
    plan_profissional: {
      name: "Pro B2B",
      features: ["Up to 15 sellers", "Payment gateway included", "Correios integration", "Automated WhatsApp", "Priority support", "Automated email"],
    },
    plan_avancado: {
      name: "Scale B2B",
      features: ["Up to 40 sellers", "Payment gateway included", "Correios integration", "Robust messaging"],
    },
    plan_multiloja: {
      name: "Multi-store B2B+B2C",
      features: ["2 stores in 1 (B2B + B2C)", "Up to 60 sellers", "Rules by sales channel", "Channel-specific pricing"],
    },
  };

  const invoiceCopy: Record<string, string> = {
    inv_2026_01: "Pro B2B Plan - January 2026",
    inv_2026_02: "Pro B2B Plan - February 2026",
    inv_2026_03: "Pro B2B Plan - March 2026",
  };

  function getPlanName(plan: BillingPlan) {
    return tr(`admin.billing.plan.${plan.id}.name`, billingCopy[plan.id]?.name || plan.name);
  }

  function getPlanFeatures(plan: BillingPlan) {
    const features = billingCopy[plan.id]?.features || plan.features;
    return features.map((feature, index) => tr(`admin.billing.plan.${plan.id}.feature${index + 1}`, feature));
  }

  function getInvoiceDescription(invoice: BillingInvoice) {
    return tr(`admin.billing.invoice.${invoice.id}.description`, invoiceCopy[invoice.id] || invoice.description);
  }

  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
  const [showPayInvoiceDialog, setShowPayInvoiceDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [cardForm, setCardForm] = useState<CardForm>({ number: "", name: "", expiry: "", cvv: "" });

  const billing = settings.billing ?? getDefaultBillingSettings();
  const defaultPaymentMethod = billing?.paymentMethods.find((pm) => pm.isDefault) || billing?.paymentMethods[0] || null;

  function handleSelectPlanForUpgrade(plan: BillingPlan) {
    setSelectedPlan(plan);
    setShowUpgradeDialog(true);
  }

  async function processCardPayment() {
    setIsProcessingPayment(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsProcessingPayment(false);
    setShowUpgradeDialog(false);
    setShowPayInvoiceDialog(false);
  }

  async function processPixPayment() {
    setIsProcessingPayment(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsProcessingPayment(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function handlePayInvoice(invoice: BillingInvoice) {
    setSelectedInvoice(invoice);
    setShowPayInvoiceDialog(true);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                {tr("admin.billing.currentPlan.title", "Current Plan")}
              </CardTitle>
              <CardDescription>
                {tr("admin.billing.currentPlan.description", "Manage your subscription and see your plan details")}
              </CardDescription>
            </div>
            {billing.subscription?.status === "ACTIVE" && (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {tr("admin.billing.status.active", "Active")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {billing.subscription ? (
            <>
              <div className="rounded-lg border bg-linear-to-br from-primary/5 to-primary/10 p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {getPlanName(billing.subscription.plan)}
                    </h3>
                    <p className="text-muted-foreground">
                      {billing.subscription.billingCycle === "MONTHLY" ? tr("admin.billing.cycle.monthly", "Monthly") : tr("admin.billing.cycle.yearly", "Yearly")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">
                      R$ {billing.subscription.billingCycle === "MONTHLY"
                        ? formatMoney(billing.subscription.plan.priceMonthly)
                        : formatMoney(billing.subscription.plan.priceYearly)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      /{billing.subscription.billingCycle === "MONTHLY" ? tr("admin.billing.cycle.monthShort", "month") : tr("admin.billing.cycle.yearShort", "year")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {getPlanFeatures(billing.subscription.plan).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {billing.subscription.plan.limits.products === -1 ? "∞" : billing.subscription.plan.limits.products}
                    </p>
                    <p className="text-xs text-muted-foreground">{tr("admin.billing.metrics.products", "Products")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {billing.subscription.plan.limits.users}
                    </p>
                    <p className="text-xs text-muted-foreground">{tr("admin.billing.metrics.users", "Users")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {billing.subscription.plan.limits.orders === -1 ? "∞" : billing.subscription.plan.limits.orders}
                    </p>
                    <p className="text-xs text-muted-foreground">{tr("admin.billing.metrics.ordersPerMonth", "Orders/month")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {billing.subscription.plan.limits.storage}GB
                    </p>
                    <p className="text-xs text-muted-foreground">{tr("admin.billing.metrics.storage", "Storage")}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">{tr("admin.billing.nextCharge", "Next Charge")}</span>
                  </div>
                  <p className="font-semibold">
                    {formatDateLongByLocale(billing.subscription.nextBillingDate)}
                  </p>
                </div>
                <div
                  className="cursor-pointer rounded-lg border p-4 transition-colors hover:border-primary"
                  onClick={() => setShowPaymentMethodDialog(true)}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-sm">{tr("admin.billing.paymentMethod", "Payment Method")}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{tr("admin.common.change", "Change")}</Badge>
                  </div>
                  <p className="font-semibold">
                    {defaultPaymentMethod?.type === "CREDIT_CARD"
                      ? `${tr("admin.billing.card", "Card")} •••• ${defaultPaymentMethod?.last4 || "****"}`
                      : defaultPaymentMethod?.type || tr("admin.common.notDefined", "Not defined")}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Receipt className="h-4 w-4" />
                    <span className="text-sm">{tr("admin.billing.monthlyValue", "Monthly Value")}</span>
                  </div>
                  <p className="font-semibold">
                    R$ {formatMoney(billing.subscription.plan.priceMonthly)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowUpgradeDialog(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {tr("admin.billing.upgrade", "Upgrade")}
                </Button>
                <Button variant="outline" onClick={() => setShowPaymentMethodDialog(true)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {tr("admin.billing.changePayment", "Change Payment")}
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive">
                  {tr("admin.billing.cancelSubscription", "Cancel Subscription")}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">
                {tr("admin.billing.noActiveSubscription", "You don't have an active subscription yet")}
              </p>
              <Button onClick={() => setShowUpgradeDialog(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                {tr("admin.billing.viewPlans", "View Available Plans")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr("admin.billing.plans.title", "Available Plans")}</CardTitle>
          <CardDescription>
            {tr("admin.billing.plans.description", "Compare plans and choose the best one for your business")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 md:grid-cols-2">
            {AVAILABLE_PLANS.map((plan) => {
              const isCurrentPlan = billing.subscription?.plan.id === plan.id;
              const isMultiloja = plan.id === "plan_multiloja";

              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-4 ${
                    isCurrentPlan
                      ? "relative border-2 border-primary"
                      : isMultiloja
                        ? "bg-linear-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10"
                        : ""
                  }`}
                >
                  {isCurrentPlan && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                      {tr("admin.billing.currentPlan.badge", "Current Plan")}
                    </Badge>
                  )}
                  <div className={`mb-1 flex items-center gap-1 ${isCurrentPlan ? "mt-2" : ""}`}>
                    {isMultiloja && <Crown className="h-4 w-4 text-amber-500" />}
                    <h4 className="font-semibold">{getPlanName(plan)}</h4>
                  </div>
                  {isMultiloja && (
                    <p className="mb-1 text-xs text-muted-foreground">{tr("admin.billing.multistore.badge", "B2B + B2C")}</p>
                  )}
                  <p className="mb-2 text-2xl font-bold">
                    R$ {formatMoneyCompact(plan.priceMonthly)}
                  </p>
                  <p className="mb-4 text-xs text-muted-foreground">/{tr("admin.billing.cycle.monthShort", "month")}</p>
                  <ul className="space-y-2 text-sm">
                    {getPlanFeatures(plan).slice(0, 4).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="h-3 w-3 shrink-0 text-green-500" />
                        <span className="truncate">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={isCurrentPlan ? "default" : "outline"}
                    size="sm"
                    className="mt-4 w-full"
                    disabled={isCurrentPlan}
                    onClick={() => !isCurrentPlan && handleSelectPlanForUpgrade(plan)}
                  >
                    {isCurrentPlan ? tr("admin.billing.currentPlan.badge", "Current Plan") : tr("admin.billing.upgrade", "Upgrade")}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {tr("admin.billing.invoices.title", "Invoice History")}
              </CardTitle>
              <CardDescription>
                {tr("admin.billing.invoices.description", "View and download your previous invoices")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {billing.invoices.length > 0 ? (
            <div className="space-y-3">
              {billing.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-full p-2 ${
                      invoice.status === "PAID"
                        ? "bg-green-100"
                        : invoice.status === "PENDING"
                          ? "bg-amber-100"
                          : "bg-red-100"
                    }`}>
                      {invoice.status === "PAID" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : invoice.status === "PENDING" ? (
                        <Clock className="h-4 w-4 text-amber-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{getInvoiceDescription(invoice)}</p>
                      <p className="text-sm text-muted-foreground">
                        {tr("admin.billing.invoice.dueDate", "Due date")}: {formatDateByLocale(invoice.dueDate)}
                        {invoice.paidAt && (
                          <> • {tr("admin.billing.invoice.paidAt", "Paid at")}: {formatDateByLocale(invoice.paidAt)}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">R$ {formatMoney(invoice.amount)}</p>
                      <Badge
                        variant={
                          invoice.status === "PAID"
                            ? "default"
                            : invoice.status === "PENDING"
                              ? "secondary"
                              : "destructive"
                        }
                        className={
                          invoice.status === "PAID"
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : ""
                        }
                      >
                        {invoice.status === "PAID" && tr("admin.billing.invoiceStatus.paid", "Paid")}
                        {invoice.status === "PENDING" && tr("admin.billing.invoiceStatus.pending", "Pending")}
                        {invoice.status === "OVERDUE" && tr("admin.billing.invoiceStatus.overdue", "Overdue")}
                        {invoice.status === "CANCELLED" && tr("admin.billing.invoiceStatus.cancelled", "Cancelled")}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {invoice.status === "PENDING" && (
                        <Button size="sm" onClick={() => handlePayInvoice(invoice)}>
                          {tr("admin.billing.payNow", "Pay Now")}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <a href={invoice.downloadUrl || "#"} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Receipt className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>{tr("admin.billing.invoices.empty", "No invoices found")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr("admin.billing.dialog.upgrade.title", "Upgrade Plan")}</DialogTitle>
            <DialogDescription>
              {tr("admin.billing.dialog.upgrade.description", "Choose payment method to confirm your upgrade")}
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-6">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{getPlanName(selectedPlan)}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPlan.limits.users} {tr("admin.billing.sellers", "sellers")} • {selectedPlan.features.length} {tr("admin.billing.features", "features")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">R$ {formatMoney(selectedPlan.priceMonthly)}</p>
                    <p className="text-sm text-muted-foreground">/{tr("admin.billing.cycle.monthShort", "month")}</p>
                  </div>
                </div>
                {billing.subscription && (
                  <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">{tr("admin.billing.currentPlan.label", "Current plan")}: </span>
                    <span>{getPlanName(billing.subscription.plan)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-primary">{getPlanName(selectedPlan)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">{tr("admin.billing.paymentMethod", "Payment Method")}</Label>
                <RadioGroup
                  value={selectedPaymentMethod}
                  onValueChange={(value) => setSelectedPaymentMethod(value as "PIX" | "CREDIT_CARD")}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                    <Label
                      htmlFor="pix"
                      className="cursor-pointer rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground flex flex-col items-center justify-between peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <QrCode className="mb-3 h-6 w-6" />
                      <span className="font-medium">PIX</span>
                      <span className="text-xs text-muted-foreground">{tr("admin.billing.pix.instant", "Instant payment")}</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="CREDIT_CARD" id="card" className="peer sr-only" />
                    <Label
                      htmlFor="card"
                      className="cursor-pointer rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground flex flex-col items-center justify-between peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <CreditCard className="mb-3 h-6 w-6" />
                      <span className="font-medium">{tr("admin.billing.creditCard", "Credit Card")}</span>
                      <span className="text-xs text-muted-foreground">{tr("admin.billing.creditCard.installments", "Installments or one-time")}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {selectedPaymentMethod === "PIX" && (
                <div className="space-y-4 rounded-lg border p-6 text-center">
                  <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg bg-muted">
                    <QrCode className="h-32 w-32 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tr("admin.billing.pix.scanOrCopy", "Scan the QR Code or copy PIX code to pay")}
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" onClick={() => copyToClipboard("00020126580014br.gov.bcb.pix...")}>
                      <Copy className="mr-2 h-4 w-4" />
                      {tr("admin.billing.pix.copyCode", "Copy PIX Code")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr("admin.billing.pix.expires", "PIX code expires in 30 minutes")}
                  </p>
                </div>
              )}

              {selectedPaymentMethod === "CREDIT_CARD" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">{tr("admin.billing.cardNumber", "Card Number")}</Label>
                    <div className="relative">
                      <Input
                        id="cardNumber"
                        placeholder="0000 0000 0000 0000"
                        value={cardForm.number}
                        onChange={(e) => setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })}
                        maxLength={19}
                      />
                      {getCardBrand(cardForm.number) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                          {getCardBrand(cardForm.number)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardName">{tr("admin.billing.cardName", "Name on Card")}</Label>
                    <Input
                      id="cardName"
                      placeholder={tr("admin.billing.cardNamePlaceholder", "NAME AS SHOWN ON CARD")}
                      value={cardForm.name}
                      onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry">{tr("admin.billing.cardExpiry", "Expiry")}</Label>
                      <Input
                        id="cardExpiry"
                        placeholder="MM/AA"
                        value={cardForm.expiry}
                        onChange={(e) => setCardForm({ ...cardForm, expiry: formatExpiry(e.target.value) })}
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">{tr("admin.billing.cardCvv", "CVV")}</Label>
                      <Input
                        id="cardCvv"
                        placeholder="123"
                        value={cardForm.cvv}
                        onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, "") })}
                        maxLength={4}
                        type="password"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span>{tr("admin.billing.security.ssl", "Your data is protected with SSL encryption")}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              {tr("admin.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={selectedPaymentMethod === "CREDIT_CARD" ? processCardPayment : processPixPayment}
              disabled={isProcessingPayment || (selectedPaymentMethod === "CREDIT_CARD" && (!cardForm.number || !cardForm.name || !cardForm.expiry || !cardForm.cvv))}
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr("admin.common.processing", "Processing...")}
                </>
              ) : (
                <>{tr("admin.billing.confirmUpgrade", "Confirm Upgrade")}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("admin.billing.dialog.changePayment.title", "Change Payment Method")}</DialogTitle>
            <DialogDescription>
              {tr("admin.billing.dialog.changePayment.description", "Choose how to pay your monthly invoices")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {billing.paymentMethods.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-1 text-sm text-muted-foreground">{tr("admin.billing.currentMethod", "Current method")}</p>
                <p className="font-medium">
                  {defaultPaymentMethod?.type === "CREDIT_CARD"
                    ? `${tr("admin.billing.cardEnding", "Card ending in")} ${defaultPaymentMethod?.last4 || "****"}`
                    : defaultPaymentMethod?.type || tr("admin.common.none", "None")}
                </p>
              </div>
            )}

            <RadioGroup
              value={selectedPaymentMethod}
              onValueChange={(value) => setSelectedPaymentMethod(value as "PIX" | "CREDIT_CARD")}
              className="space-y-3"
            >
              <div className="flex cursor-pointer items-center space-x-3 rounded-lg border p-4 hover:bg-accent">
                <RadioGroupItem value="PIX" id="pm-pix" />
                <Label htmlFor="pm-pix" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5" />
                    <div>
                      <p className="font-medium">PIX</p>
                      <p className="text-sm text-muted-foreground">{tr("admin.billing.pix.newCodePerInvoice", "Generate a new code for each invoice")}</p>
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex cursor-pointer items-center space-x-3 rounded-lg border p-4 hover:bg-accent">
                <RadioGroupItem value="CREDIT_CARD" id="pm-card" />
                <Label htmlFor="pm-card" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{tr("admin.billing.creditCard", "Credit Card")}</p>
                      <p className="text-sm text-muted-foreground">{tr("admin.billing.creditCard.monthlyAutoCharge", "Automatic monthly charge")}</p>
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {selectedPaymentMethod === "CREDIT_CARD" && (
              <div className="space-y-4 border-t pt-4">
                <p className="font-medium">{tr("admin.billing.cardData", "Card Data")}</p>
                <div className="space-y-2">
                  <Label htmlFor="pm-cardNumber">{tr("admin.billing.cardNumber", "Card Number")}</Label>
                  <div className="relative">
                    <Input
                      id="pm-cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={cardForm.number}
                      onChange={(e) => setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })}
                      maxLength={19}
                    />
                    {getCardBrand(cardForm.number) && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                        {getCardBrand(cardForm.number)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pm-cardName">{tr("admin.billing.cardName", "Name on Card")}</Label>
                  <Input
                    id="pm-cardName"
                    placeholder="NOME COMO ESTÁ NO CARTÃO"
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pm-cardExpiry">{tr("admin.billing.cardExpiry", "Expiry")}</Label>
                    <Input
                      id="pm-cardExpiry"
                      placeholder="MM/AA"
                      value={cardForm.expiry}
                      onChange={(e) => setCardForm({ ...cardForm, expiry: formatExpiry(e.target.value) })}
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pm-cardCvv">{tr("admin.billing.cardCvv", "CVV")}</Label>
                    <Input
                      id="pm-cardCvv"
                      placeholder="123"
                      value={cardForm.cvv}
                      onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, "") })}
                      maxLength={4}
                      type="password"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                    <span>{tr("admin.billing.security.ssl", "Your data is protected with SSL encryption")}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentMethodDialog(false)}>
              {tr("admin.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => {
                setShowPaymentMethodDialog(false);
                setCardForm({ number: "", name: "", expiry: "", cvv: "" });
              }}
              disabled={selectedPaymentMethod === "CREDIT_CARD" && (!cardForm.number || !cardForm.name || !cardForm.expiry || !cardForm.cvv)}
            >
              {tr("admin.billing.saveMethod", "Save Method")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayInvoiceDialog} onOpenChange={setShowPayInvoiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("admin.billing.dialog.payInvoice.title", "Pay Invoice")}</DialogTitle>
            <DialogDescription>
              {selectedInvoice ? getInvoiceDescription(selectedInvoice) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{tr("admin.billing.amountToPay", "Amount to pay")}</p>
                    <p className="text-2xl font-bold">R$ {formatMoney(selectedInvoice.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{tr("admin.billing.invoice.dueDate", "Due date")}</p>
                    <p className="font-medium">
                      {formatDateByLocale(selectedInvoice.dueDate)}
                    </p>
                  </div>
                </div>
              </div>

              <RadioGroup
                value={selectedPaymentMethod}
                onValueChange={(value) => setSelectedPaymentMethod(value as "PIX" | "CREDIT_CARD")}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="PIX" id="inv-pix" className="peer sr-only" />
                  <Label
                    htmlFor="inv-pix"
                    className="cursor-pointer rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground flex flex-col items-center justify-between peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <QrCode className="mb-3 h-6 w-6" />
                    <span className="font-medium">PIX</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="CREDIT_CARD" id="inv-card" className="peer sr-only" />
                  <Label
                    htmlFor="inv-card"
                    className="cursor-pointer rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground flex flex-col items-center justify-between peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <CreditCard className="mb-3 h-6 w-6" />
                    <span className="font-medium">{tr("admin.billing.card", "Card")}</span>
                  </Label>
                </div>
              </RadioGroup>

              {selectedPaymentMethod === "PIX" && (
                <div className="space-y-3 rounded-lg border p-4 text-center">
                  <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg bg-muted">
                    <QrCode className="h-24 w-24 text-muted-foreground" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard("00020126580014br.gov.bcb.pix...")}>
                    <Copy className="mr-2 h-4 w-4" />
                    {tr("admin.common.copyCode", "Copy Code")}
                  </Button>
                </div>
              )}

              {selectedPaymentMethod === "CREDIT_CARD" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{tr("admin.billing.cardNumber", "Card Number")}</Label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={cardForm.number}
                      onChange={(e) => setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })}
                      maxLength={19}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tr("admin.billing.cardName", "Name on Card")}</Label>
                    <Input
                      placeholder={tr("admin.billing.cardNamePlaceholder", "NAME AS SHOWN ON CARD")}
                      value={cardForm.name}
                      onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{tr("admin.billing.cardExpiry", "Expiry")}</Label>
                      <Input
                        placeholder="MM/AA"
                        value={cardForm.expiry}
                        onChange={(e) => setCardForm({ ...cardForm, expiry: formatExpiry(e.target.value) })}
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{tr("admin.billing.cardCvv", "CVV")}</Label>
                      <Input
                        placeholder="123"
                        value={cardForm.cvv}
                        onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, "") })}
                        maxLength={4}
                        type="password"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayInvoiceDialog(false)}>
              {tr("admin.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={processCardPayment}
              disabled={isProcessingPayment || (selectedPaymentMethod === "CREDIT_CARD" && (!cardForm.number || !cardForm.name || !cardForm.expiry || !cardForm.cvv))}
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr("admin.common.processing", "Processing...")}
                </>
              ) : (
                <>{tr("admin.billing.pay", "Pay")} R$ {selectedInvoice ? formatMoney(selectedInvoice.amount) : "0,00"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
