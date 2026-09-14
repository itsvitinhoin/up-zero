"use client";

import { useState } from "react";
import { BillingUsage } from "./BillingUsage";
import { BillingPayments, useBillingAccount } from "./BillingPayments";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, CreditCard, Download, MessageCircle, Receipt, Sparkles, Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SiteSettings } from "@/lib/types";
import { BILLING_PRICES, STARTER_FEATURES, PRO_FEATURES, estimateBilling, formatBRL, type CommercialPlan } from "@/lib/billing/catalog";

const invoiceStatuses: Record<string, string> = {
  PAID: "Paga", PENDING: "Em aberto", OVERDUE: "Vencida", CANCELLED: "Cancelada",
  RECEIVED: "Paga", CONFIRMED: "Pagamento confirmado", RECEIVED_IN_CASH: "Paga",
  REFUNDED: "Estornada", REFUND_REQUESTED: "Estorno solicitado", REFUND_IN_PROGRESS: "Estorno em andamento",
  CHARGEBACK_REQUESTED: "Contestada", CHARGEBACK_DISPUTE: "Contestação em análise",
  AWAITING_CHARGEBACK_REVERSAL: "Contestação em análise", AWAITING_RISK_ANALYSIS: "Pagamento em análise",
  DUNNING_RECEIVED: "Recuperada", DUNNING_REQUESTED: "Em recuperação", DELETED: "Cancelada",
};
const subscriptionStatuses = { ACTIVE: "Ativa", INACTIVE: "Inativa", CANCELLED: "Cancelada", TRIAL: "Em teste", PAST_DUE: "Pagamento pendente" };
function dateLabel(value?: string) {
  if (!value) return "Não informado";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleDateString("pt-BR");
}
function safeDownload(value?: string | null) {
  if (!value || value === "#") return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; }
}

export function BillingTab({ settings }: { locale?: string; settings: SiteSettings }) {
  const account = useBillingAccount();
  const [checkoutPlan, setCheckoutPlan] = useState<CommercialPlan | null>(null);
  const active = account.view?.subscription;
  const billing = account.view?.configured ? {
    subscription: active ? { ...active, billingCycle: "MONTHLY", nextBillingDate: active.nextDueDate, plan: { id: active.plan, name: active.plan === "plan_starter" ? "Starter B2B" : "Pro B2B" }, status: active.status === "CANCELLED" ? "CANCELLED" : active.status === "ACTIVE" ? "ACTIVE" : "INACTIVE" } : null,
    paymentMethods: account.view.methods.map(m => ({ ...m, type: "CREDIT_CARD", isDefault: m.id === account.view?.defaultMethodId })),
    invoices: account.view.invoices.map(i => ({ ...i, status: i.status, downloadUrl: null })),
  } : settings.billing;
  const subscription = billing?.subscription;
  const invoices = billing?.invoices ?? [];
  const payment = billing?.paymentMethods?.find(item => item.isDefault) ?? billing?.paymentMethods?.[0];
  const [plan, setPlan] = useState<CommercialPlan>("plan_starter");
  const [numbers, setNumbers] = useState("0");
  const [generations, setGenerations] = useState("0");
  const validQuantity = (value: string) => /^\d+$/.test(value) && Number(value) <= 1_000_000;
  const estimate = validQuantity(numbers) && validQuantity(generations) ? estimateBilling(plan, Number(numbers), Number(generations)) : null;
  const pending = invoices.filter(invoice => invoice.status === "PENDING" || invoice.status === "OVERDUE");
  const currentPlanName = subscription?.plan.id === "plan_starter" ? "Starter B2B" : subscription?.plan.id === "plan_profissional" ? "Pro B2B" : subscription?.plan.name;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">UP Zero · Financeiro</p>
          <h2 className="text-2xl font-semibold tracking-tight">Planos e cobrança</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Sua assinatura, os adicionais contratados e o consumo do Estúdio IA em um só lugar.</p>
        </div>
        <a href="#billing-simulator" className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"><Calculator className="size-4" />Simular mensalidade</a>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="gap-3"><CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="size-4" />Assinatura atual</div>
          <p className="text-xl font-semibold">{currentPlanName ?? "Não informada"}</p>
          {subscription ? <Badge variant="secondary">{subscriptionStatuses[subscription.status as keyof typeof subscriptionStatuses]}</Badge> : <p className="text-xs text-muted-foreground">Aguardando os dados da sua assinatura.</p>}
        </CardContent></Card>
        <Card className="gap-3"><CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" />Próximo vencimento</div>
          <p className="text-xl font-semibold">{dateLabel(subscription?.nextBillingDate)}</p>
          <p className="text-xs text-muted-foreground">{payment ? payment.type === "CREDIT_CARD" ? `Cartão ${payment.brand ?? ""} •••• ${payment.last4 ?? "****"}` : payment.type === "PIX" ? "Pagamento via Pix" : "Pagamento via boleto" : "Forma de pagamento não informada."}</p>
        </CardContent></Card>
        <Card className="gap-3"><CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Receipt className="size-4" />Faturas em aberto</div>
          <p className="text-xl font-semibold">{billing ? formatBRL(pending.reduce((sum, invoice) => sum + invoice.amount, 0)) : "Não informado"}</p>
          <p className="text-xs text-muted-foreground">{billing ? `${pending.length} fatura(s) pendente(s) ou vencida(s).` : "Nenhuma informação de faturamento recebida."}</p>
        </CardContent></Card>
      </div>

      <BillingUsage monthlyAmount={active?.status === "ACTIVE" ? Math.round(active.value * 100) : null} />

      <BillingPayments {...account} checkoutPlan={checkoutPlan} closeCheckout={() => setCheckoutPlan(null)} />

      <section aria-labelledby="billing-plans-title" className="space-y-4">
        <div><h3 id="billing-plans-title" className="text-lg font-semibold">Planos da plataforma</h3><p className="mt-1 text-sm text-muted-foreground">Produtos e vendedoras ilimitados em ambos os planos.</p></div>
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          {([
            { id: "plan_starter", name: "Starter B2B", description: "O essencial para sua operação de atacado.", price: BILLING_PRICES.starterMonthly, features: STARTER_FEATURES },
            { id: "plan_profissional", name: "Pro B2B", description: "Toda a base do Starter, com módulos para expandir sua operação.", price: BILLING_PRICES.proMonthly, features: PRO_FEATURES },
          ] as const).map(item => <Card key={item.id} className={item.id === "plan_profissional" ? "border-primary/35 bg-primary/[0.025]" : ""}>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2"><CardTitle>{item.name}</CardTitle>{subscription?.plan.id === item.id && <Badge variant="secondary">Plano atual</Badge>}</div>
              <CardDescription>{item.description}</CardDescription>
              <div className="flex items-baseline gap-2 pt-2"><span className="text-3xl font-semibold tracking-tight">{formatBRL(item.price)}</span><span className="text-sm text-muted-foreground">/mês</span></div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-6">
              <ul className="space-y-3">{item.features.map(feature => <li key={feature} className="flex gap-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>{feature}</span></li>)}</ul>
              {item.id === "plan_profissional" && <p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">As gerações do Estúdio IA são cobradas por uso, separadamente da mensalidade.</p>}
              <button type="button" disabled={account.loading || (account.view !== null && !account.view.canManage) || (active?.plan === item.id && active.status !== 'CANCELLED')} onClick={() => setCheckoutPlan(item.id)} className="mt-auto flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{active?.plan === item.id && active.status !== 'CANCELLED' ? 'Plano atual' : active && active.status !== 'CANCELLED' ? 'Alterar para este plano' : 'Assinar plano'}</button>
              <button type="button" onClick={() => { setPlan(item.id); document.getElementById("billing-simulator")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted">Simular com este plano<ArrowUpRight className="size-4" /></button>
            </CardContent>
          </Card>)}
        </div>
      </section>

      <section aria-labelledby="billing-addons-title" className="space-y-4">
        <div><h3 id="billing-addons-title" className="text-lg font-semibold">Adicionais</h3><p className="mt-1 text-sm text-muted-foreground">Valores separados da assinatura da plataforma.</p></div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardContent className="space-y-4">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600"><MessageCircle className="size-5" /></span><div><h4 className="font-semibold">WhatsApp automático</h4><p className="text-xs text-muted-foreground">Adicional mensal por número</p></div></div>
            <p><span className="text-2xl font-semibold">{formatBRL(BILLING_PRICES.whatsappNumberMonthly)}</span><span className="text-sm text-muted-foreground"> / número / mês</span></p>
            <p className="text-sm text-muted-foreground">Cada número integrado à plataforma para disparos automáticos acrescenta R$ 99,00 à mensalidade.</p>
            <Link href="/mensageria/whatsapp" className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">Gerenciar WhatsApp<ArrowUpRight className="size-4" /></Link>
          </CardContent></Card>
          <Card><CardContent className="space-y-4">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-500/10 p-3 text-violet-600"><Sparkles className="size-5" /></span><div><h4 className="font-semibold">Estúdio IA</h4><p className="text-xs text-muted-foreground">Pagamento por uso</p></div></div>
            <p><span className="text-2xl font-semibold">{formatBRL(BILLING_PRICES.studioGeneration)}</span><span className="text-sm text-muted-foreground"> / geração de 4 fotos</span></p>
            <p className="text-sm text-muted-foreground">Frente, costas, lateral e detalhe. As gerações se acumulam na cobrança do cliente, conforme o uso.</p>
            <Link href="/ai-studio" className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">Abrir Estúdio IA<ArrowUpRight className="size-4" /></Link>
          </CardContent></Card>
        </div>
      </section>

      <Card id="billing-simulator" className="scroll-mt-6">
        <CardHeader className="space-y-2"><div className="flex flex-wrap items-center gap-3"><CardTitle>Simule sua cobrança mensal</CardTitle><Badge variant="secondary">Simulação</Badge></div><CardDescription>Estime os custos com seu volume de uso. Esta simulação não altera o plano nem gera cobranças.</CardDescription></CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="space-y-2"><Label htmlFor="billing-plan">Plano</Label><select id="billing-plan" value={plan} onChange={event => setPlan(event.target.value as CommercialPlan)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="plan_starter">Starter B2B — R$ 899,00/mês</option><option value="plan_profissional">Pro B2B — R$ 1.199,00/mês</option></select></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="billing-numbers">Números de WhatsApp</Label><Input id="billing-numbers" type="number" min="0" max="1000000" step="1" value={numbers} onChange={event => setNumbers(event.target.value)} aria-invalid={!validQuantity(numbers)} /><p className="text-xs text-muted-foreground">R$ 99,00 por número/mês.</p></div>
              <div className="space-y-2"><Label htmlFor="billing-generations">Gerações de IA no mês</Label><Input id="billing-generations" type="number" min="0" max="1000000" step="1" value={generations} onChange={event => setGenerations(event.target.value)} aria-invalid={!validQuantity(generations)} /><p className="text-xs text-muted-foreground">Cada geração entrega 4 fotos.</p></div>
            </div>
            {!estimate && <p role="alert" className="text-sm text-destructive">Informe quantidades inteiras entre 0 e 1.000.000.</p>}
            <p className="text-sm text-muted-foreground">O acompanhamento automático do consumo ainda não está conectado ao faturamento. As quantidades acima são apenas uma previsão.</p>
          </div>
          <div aria-live="polite" aria-atomic="true" className="rounded-xl bg-muted/50 p-5">
            <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Composição da estimativa</p>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-4"><dt>{plan === "plan_starter" ? "Starter B2B" : "Pro B2B"}</dt><dd className="font-medium">{estimate ? formatBRL(estimate.subscription) : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt>WhatsApp {estimate && `(${Number(numbers)} ${Number(numbers) === 1 ? "número" : "números"})`}</dt><dd className="font-medium">{estimate ? formatBRL(estimate.whatsapp) : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt>Estúdio IA {estimate && `(${Number(generations)} ${Number(generations) === 1 ? "geração" : "gerações"})`}</dt><dd className="font-medium">{estimate ? formatBRL(estimate.studio) : "—"}</dd></div>
              <div className="flex items-baseline justify-between gap-4 border-t pt-4"><dt className="font-semibold">Total mensal estimado</dt><dd className="text-2xl font-semibold tracking-tight">{estimate ? formatBRL(estimate.total) : "—"}</dd></div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2"><CardTitle>Histórico de faturas</CardTitle><CardDescription>Consulte os valores e a situação das cobranças registradas.</CardDescription></CardHeader>
        <CardContent>
          {invoices.length === 0 ? <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center"><Receipt className="mb-1 size-7 text-muted-foreground" /><p className="font-medium">Nenhuma fatura disponível</p><p className="max-w-md text-sm text-muted-foreground">As faturas aparecerão aqui quando os dados de cobrança estiverem disponíveis.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="px-2 py-3 font-medium">Descrição</th><th className="px-2 py-3 font-medium">Vencimento</th><th className="px-2 py-3 font-medium">Valor</th><th className="px-2 py-3 font-medium">Situação</th><th className="px-2 py-3"><span className="sr-only">Download</span></th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id} className="border-b last:border-0"><td className="min-w-48 px-2 py-4">{invoice.description}</td><td className="whitespace-nowrap px-2 py-4">{dateLabel(invoice.dueDate)}</td><td className="whitespace-nowrap px-2 py-4 font-medium">{formatBRL(invoice.amount)}</td><td className="px-2 py-4"><Badge variant={invoice.status === "OVERDUE" ? "destructive" : "secondary"}>{(invoiceStatuses[invoice.status] || "Em análise")}</Badge></td><td className="px-2 py-4">{safeDownload(invoice.downloadUrl) && <a href={safeDownload(invoice.downloadUrl)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4" aria-label={`Baixar fatura: ${invoice.description}`}><Download className="size-4" />Baixar</a>}</td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
