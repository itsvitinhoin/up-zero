"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  MessageCircle,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
  XCircle,
} from "lucide-react";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import {
  AdminHero,
  AdminPage,
  AdminPanel,
  AdminStatCard,
  AdminStatGrid,
  AdminToolbar,
  DesktopOnly,
  MobileCardList,
} from "@/components/admin/admin-mobile-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import type {
  AbandonedCart,
  AbandonedCartRecoveryStatus,
} from "@/lib/admin-abandoned-carts-mock-data";

type StatusOption = {
  label: string
  shortLabel: string
  badge: "slate" | "blue" | "violet" | "emerald" | "rose" | "amber"
  dot: string
}

const RECOVERY_STATUS: Record<AbandonedCartRecoveryStatus, StatusOption> = {
  NOT_SENT: { label: "Não disparado", shortLabel: "Não disparado", badge: "amber", dot: "bg-amber-300" },
  SENT: { label: "Mensagem Enviada", shortLabel: "Enviada", badge: "blue", dot: "bg-blue-300" },
  RECOVERED: { label: "Recuperado", shortLabel: "Recuperado", badge: "emerald", dot: "bg-emerald-300" },
}

type AdminAbandonedCartsPageClientProps = {
  initialCarts: AbandonedCart[]
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  if (digits.length !== 11) return phone
  return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
}

function buildWhatsAppUrl(cart: AbandonedCart) {
  const digits = cart.phone.replace(/\D/g, "")
  const phone = digits.startsWith("55") ? digits : `55${digits}`
  const message = [
    `Olá, ${cart.customerName}! Tudo bem?`,
    `Vi que você deixou alguns produtos no carrinho da ${cart.companyName}.`,
    `Posso te ajudar a fechar esse pedido de ${formatCurrency(cart.subtotal - cart.discountTotal + cart.shippingEstimate)}?`,
  ].join("\n\n")

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export default function AdminAbandonedCartsPageClient({
  initialCarts,
}: AdminAbandonedCartsPageClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AbandonedCartRecoveryStatus | "all">("all")
  const [currentPage, setCurrentPage] = useState(1)

  const filteredCarts = useMemo(() => {
    const q = search.trim().toLowerCase()

    return initialCarts.filter((cart) => {
      const matchesSearch = !q ||
        cart.id.toLowerCase().includes(q) ||
        cart.customerName.toLowerCase().includes(q) ||
        cart.companyName.toLowerCase().includes(q) ||
        cart.email.toLowerCase().includes(q) ||
        cart.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))

      const matchesStatus = statusFilter === "all" || cart.recoveryStatus === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [initialCarts, search, statusFilter])

  const pageSize = 20
  const {
    totalPages,
    safeCurrentPage,
    pageStart,
    pageEnd,
    paginatedItems: paginatedCarts,
  } = usePaginatedList({
    items: filteredCarts,
    currentPage,
    pageSize,
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const stats = {
    total: initialCarts.length,
    pending: initialCarts.filter((cart) => cart.recoveryStatus === "NOT_SENT").length,
    recovered: initialCarts.filter((cart) => cart.recoveryStatus === "RECOVERED").length,
    totalValue: initialCarts.reduce((acc, cart) => acc + cart.subtotal - cart.discountTotal + cart.shippingEstimate, 0),
  }

  return (
    <AdminPage>
      <AdminHero
        icon={RotateCcw}
        eyebrow="Pedidos"
        title="Carrinhos abandonados"
        description={`${stats.total} carrinhos aguardando acompanhamento • ${formatCurrency(stats.totalValue)} em potencial`}
      />

      <AdminStatGrid>
        <AdminStatCard icon={ShoppingBag} label="Carrinhos" value={stats.total} hint="Com produtos adicionados" />
        <AdminStatCard icon={Clock} label="Aguardando" value={stats.pending} hint="Sem disparo ainda" tone="warning" />
        <AdminStatCard icon={CheckCircle2} label="Recuperados" value={stats.recovered} hint="Convertidos em pedido" tone="success" />
        <AdminStatCard icon={ArrowUpRight} label="Potencial" value={formatCurrency(stats.totalValue)} hint="Valor nos carrinhos" tone="info" />
      </AdminStatGrid>

      <AdminToolbar>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, empresa, telefone ou e-mail..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-12 rounded-2xl pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="flex w-max gap-1.5 md:w-auto md:flex-wrap">
              {[
                { value: "all" as const, label: "Todos", dot: null },
                ...Object.entries(RECOVERY_STATUS).map(([value, config]) => ({
                  value: value as AbandonedCartRecoveryStatus,
                  label: config.shortLabel,
                  dot: config.dot,
                })),
              ].map(({ value, label, dot }) => {
                const count = value === "all"
                  ? filteredCarts.length
                  : initialCarts.filter((cart) => cart.recoveryStatus === value).length
                const isActive = statusFilter === value

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {dot && !isActive ? <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} /> : null}
                    {label}
                    <span className={`text-xs tabular-nums ${isActive ? "opacity-70" : "text-muted-foreground"}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </AdminToolbar>

      <MobileCardList>
        {paginatedCarts.length === 0 ? (
          <AdminPanel>
            <div className="py-8 text-center">
              <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-muted-foreground">Nenhum carrinho encontrado</p>
              <p className="text-sm text-muted-foreground">Tente ajustar a busca ou o status</p>
            </div>
          </AdminPanel>
        ) : (
          paginatedCarts.map((cart) => {
            const status = RECOVERY_STATUS[cart.recoveryStatus]
            const total = cart.subtotal - cart.discountTotal + cart.shippingEstimate
            const itemCount = cart.items.reduce((acc, item) => acc + item.quantity, 0)

            return (
              <AdminPanel key={cart.id} className="overflow-hidden p-0">
                <div
                  className="cursor-pointer space-y-4 p-4 transition-colors hover:bg-muted/30"
                  onClick={() => router.push(`/orders/abandoned-carts/${cart.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-sm font-semibold text-primary">#{cart.id.replace("cart-", "").toUpperCase()}</p>
                      <p className="truncate text-base font-semibold text-foreground">{cart.companyName}</p>
                      <p className="text-sm text-muted-foreground">{cart.customerName} • {formatPhone(cart.phone)}</p>
                    </div>
                    <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${status.dot}`} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
                      <p className="font-semibold text-foreground">{formatCurrency(total)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Produtos</p>
                      <p className="font-semibold text-foreground">{itemCount} pecas • {cart.items.length} SKUs</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={status.badge}>{status.label}</Badge>
                    <Badge variant="outline">{formatDateTime(cart.abandonedAt)}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-t border-border/50">
                  <a
                    href={buildWhatsAppUrl(cart)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="flex h-12 items-center justify-center gap-2 border-r border-border/50 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => router.push(`/orders/abandoned-carts/${cart.id}`)}
                    className="flex h-12 items-center justify-center gap-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    Ver detalhes
                  </button>
                </div>
              </AdminPanel>
            )
          })
        )}
      </MobileCardList>

      <DesktopOnly>
        <div className="overflow-hidden rounded-[24px] border border-border/60 bg-card/95 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20">
                <TableHead className="w-14 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Status</TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Abandono</TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Cliente</TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Contato</TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Valor</TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Produtos</TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Recuperação</TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCarts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                    <p className="font-medium text-muted-foreground">Nenhum carrinho encontrado</p>
                    <p className="text-sm text-muted-foreground">Tente ajustar a busca ou o status</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCarts.map((cart) => {
                  const status = RECOVERY_STATUS[cart.recoveryStatus]
                  const total = cart.subtotal - cart.discountTotal + cart.shippingEstimate
                  const itemCount = cart.items.reduce((acc, item) => acc + item.quantity, 0)

                  return (
                    <TableRow
                      key={cart.id}
                      className="cursor-pointer border-border/20 transition-colors hover:bg-muted/40"
                      onClick={() => router.push(`/orders/abandoned-carts/${cart.id}`)}
                    >
                      <TableCell>
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${status.dot}`} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(cart.abandonedAt)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cart.companyName}</p>
                          <p className="text-sm text-muted-foreground">{cart.customerName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatPhone(cart.phone)}</p>
                          <p className="text-muted-foreground">{cart.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{itemCount}</span>
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {cart.items.length} SKUs
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.badge} className="justify-center">
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={(event) => {
                              event.stopPropagation()
                              window.open(buildWhatsAppUrl(cart), "_blank", "noopener,noreferrer")
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DesktopOnly>

      {filteredCarts.length > 0 ? (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          showing={{
            start: pageStart,
            end: pageEnd,
            total: filteredCarts.length,
          }}
        />
      ) : null}
    </AdminPage>
  )
}
