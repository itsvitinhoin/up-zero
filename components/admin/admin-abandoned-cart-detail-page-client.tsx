"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Mail,
  MessageCircle,
  Package,
  Phone,
  RotateCcw,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import {
  AdminHero,
  AdminPage,
  AdminPanel,
  AdminStatCard,
  AdminStatGrid,
  DesktopOnly,
  MobileCardList,
} from "@/components/admin/admin-mobile-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AbandonedCart,
  AbandonedCartRecoveryStatus,
} from "@/lib/admin-abandoned-carts-mock-data";

type StatusConfig = {
  label: string
  badge: "slate" | "blue" | "violet" | "emerald" | "rose" | "amber"
  dot: string
  description: string
}

const RECOVERY_STATUS: Record<AbandonedCartRecoveryStatus, StatusConfig> = {
  NOT_SENT: {
    label: "Não disparado",
    badge: "amber",
    dot: "bg-amber-300",
    description: "A vendedora ainda não iniciou a recuperação deste carrinho.",
  },
  SENT: {
    label: "Mensagem enviada",
    badge: "blue",
    dot: "bg-blue-300",
    description: "Mensagem de recuperação já foi enviada para o cliente.",
  },
  RESPONDED: {
    label: "Cliente respondeu",
    badge: "violet",
    dot: "bg-violet-300",
    description: "Cliente respondeu e precisa de acompanhamento comercial.",
  },
  RECOVERED: {
    label: "Carrinho recuperado",
    badge: "emerald",
    dot: "bg-emerald-300",
    description: "Carrinho já foi recuperado pela equipe.",
  },
  FAILED: {
    label: "Sem resposta",
    badge: "rose",
    dot: "bg-rose-300",
    description: "As tentativas anteriores não tiveram retorno do cliente.",
  },
}

type AdminAbandonedCartDetailPageClientProps = {
  cart: AbandonedCart
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  if (digits.length !== 11) return phone
  return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
}

function getCartTotal(cart: AbandonedCart) {
  return cart.subtotal - cart.discountTotal + cart.shippingEstimate
}

function getWhatsAppMessage(cart: AbandonedCart) {
  const itemSummary = cart.items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.productName} ${item.color}/${item.size}`)
    .join(", ")

  return [
    `Olá, ${cart.customerName}! Tudo bem?`,
    `Vi que você deixou estes produtos no carrinho: ${itemSummary}.`,
    `O total ficou em ${formatCurrency(getCartTotal(cart))}. Posso te ajudar a finalizar o pedido ou tirar alguma dúvida?`,
  ].join("\n\n")
}

function buildWhatsAppUrl(cart: AbandonedCart) {
  const digits = cart.phone.replace(/\D/g, "")
  const phone = digits.startsWith("55") ? digits : `55${digits}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(getWhatsAppMessage(cart))}`
}

export default function AdminAbandonedCartDetailPageClient({
  cart,
}: AdminAbandonedCartDetailPageClientProps) {
  const status = RECOVERY_STATUS[cart.recoveryStatus]
  const total = getCartTotal(cart)
  const itemCount = cart.items.reduce((acc, item) => acc + item.quantity, 0)

  return (
    <AdminPage>
      <div>
        <Button variant="ghost" asChild className="mb-2 min-h-11 rounded-2xl px-3">
          <Link href="/orders/abandoned-carts">
            <ArrowLeft className="h-4 w-4" />
            Voltar para carrinhos
          </Link>
        </Button>
      </div>

      <AdminHero
        icon={RotateCcw}
        eyebrow="Carrinho abandonado"
        title={cart.companyName}
        description={`Carrinho #${cart.id.replace("cart-", "").toUpperCase()} abandonado em ${formatDateTime(cart.abandonedAt)}`}
        actions={
          <Button asChild className="min-h-12 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700">
            <a href={buildWhatsAppUrl(cart)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Enviar WhatsApp
            </a>
          </Button>
        }
      />

      <AdminPanel>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Cliente
                </p>
                <h2 className="text-xl font-semibold tracking-tight">{cart.customerName}</h2>
                <p className="text-sm text-muted-foreground">{cart.companyName}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {formatPhone(cart.phone)}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{cart.email}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/60 bg-background/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recuperação
                </p>
                <Badge variant={status.badge} className="gap-2">
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                  {status.label}
                </Badge>
              </div>
              <div className="rounded-2xl bg-muted px-3 py-2 text-right">
                <p className="text-[11px] text-muted-foreground">Tentativas</p>
                <p className="font-semibold">{cart.recoveryAttempts}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{status.description}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Vendedora: <span className="font-medium text-foreground">{cart.sellerName}</span>
            </p>
          </div>
        </div>
      </AdminPanel>

      <AdminStatGrid>
        <AdminStatCard icon={ShoppingBag} label="Produtos" value={itemCount} hint={`${cart.items.length} SKUs no carrinho`} />
        <AdminStatCard icon={Package} label="Subtotal" value={formatCurrency(cart.subtotal)} hint="Antes de descontos" />
        <AdminStatCard icon={CalendarClock} label="Ultima atividade" value={formatDateTime(cart.lastActivityAt)} hint="Momento do abandono" tone="warning" />
        <AdminStatCard icon={RotateCcw} label="Total" value={formatCurrency(total)} hint="Carrinho completo" tone="info" />
      </AdminStatGrid>

      <AdminPanel title="Produtos adicionados" description="Itens que o cliente deixou no carrinho.">
        <MobileCardList className="lg:hidden">
          {cart.items.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-border/60 bg-background/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold leading-5">{item.productName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                </div>
                <div className="rounded-2xl bg-primary/10 px-3 py-2 text-center text-primary">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Qtd</p>
                  <p className="text-lg font-semibold">{item.quantity}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Cor</p>
                  <p className="font-medium">{item.color}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tam.</p>
                  <p className="font-medium">{item.size}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Valor</p>
                  <p className="font-medium">{formatCurrency(item.unitPrice)}</p>
                </div>
              </div>
            </div>
          ))}
        </MobileCardList>

        <DesktopOnly>
          <div className="overflow-hidden rounded-[20px] border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">Produto</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">SKU</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">Cor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">Tamanho</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground/90">Qtd</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground/90">Unitário</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground/90">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{item.sku}</TableCell>
                    <TableCell>{item.color}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DesktopOnly>
      </AdminPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <AdminPanel title="Mensagem sugerida" description="Texto pronto para a vendedora enviar pelo WhatsApp.">
          <Textarea
            readOnly
            value={getWhatsAppMessage(cart)}
            className="min-h-40 resize-none rounded-2xl text-sm leading-6"
          />
          <Button asChild className="mt-4 min-h-12 w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700">
            <a href={buildWhatsAppUrl(cart)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Enviar mensagem no WhatsApp
            </a>
          </Button>
        </AdminPanel>

        <AdminPanel title="Resumo financeiro" description="Valores do carrinho abandonado.">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(cart.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Descontos</span>
              <span className="font-medium">{formatCurrency(cart.discountTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Frete estimado</span>
              <span className="font-medium">{formatCurrency(cart.shippingEstimate)}</span>
            </div>
            <div className="border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-semibold">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
            {cart.notes}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  )
}

