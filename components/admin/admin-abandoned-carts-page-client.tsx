"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  MessageCircle,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  FilterX,
  Loader2,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Package,
  Link2,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { dispatchCartMessageAction } from "@/lib/actions/messaging";
import { generateAbandonedCartRecoveryLinkAction } from "@/lib/actions/abandoned-carts";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import { useAdminStore } from "@/contexts/admin-store-context";
import { buildStorefrontUrl } from "@/lib/storefront-url";

interface CartRow {
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

const RECOVERY_STATUS_LABELS: Record<
  string,
  { label: string; chipClassName: string }
> = {
  NOT_SENT: {
    label: "Não disparado",
    chipClassName: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  },
  SENT_WHATSAPP: {
    label: "Mensagem Enviada (WhatsApp)",
    chipClassName: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
  },
  SENT_EMAIL: {
    label: "Mensagem Enviada (E-mail)",
    chipClassName: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50",
  },
  RECOVERED: {
    label: "Recuperado",
    chipClassName: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  },
};

const ABANDONED_CART_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function parseAbandonedCartPageLimit(value?: string | number | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return ABANDONED_CART_PAGE_SIZE_OPTIONS.includes(parsed as (typeof ABANDONED_CART_PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : 20;
}

interface AdminAbandonedCartsPageClientProps {
  initialCarts: CartRow[];
  summary: {
    total_count: number;
    in_recovery_count: number;
    recovered_count: number;
    potential_revenue_cents: number;
  };
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  initialSearch: string;
  initialRecoveryStatus: string;
}

interface CartItemPreview {
  product_variant_id: number;
  product_name?: string;
  image_url?: string | null;
  variant_sku?: string | null;
  quantity: number;
}

export default function AdminAbandonedCartsPageClient({
  initialCarts,
  summary,
  currentPage,
  pageSize,
  totalCount,
  totalPages,
  initialSearch,
  initialRecoveryStatus,
}: AdminAbandonedCartsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, storefrontUrl } = useAdminStore();
  const canSendMessages = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || "").trim().toLowerCase()).includes("messaging.send")
    : true;
  const normalizeRecoveryFilter = (value: string) => {
    const normalized = String(value || "all").trim().toLowerCase();
    return normalized.length > 0 ? normalized : "all";
  };

  const [search, setSearch] = useState(initialSearch);
  const [recoveryFilter, setRecoveryFilter] = useState(normalizeRecoveryFilter(initialRecoveryStatus));
  const [selectedLimit, setSelectedLimit] = useState<number>(parseAbandonedCartPageLimit(pageSize));
  const [carts, setCarts] = useState<CartRow[]>(initialCarts);
  const [dispatchingCartId, setDispatchingCartId] = useState<string | null>(null);
  const [generatingLinkCartId, setGeneratingLinkCartId] = useState<string | null>(null);

  const detailsBasePath = pathname.startsWith("/admin/")
    ? "/admin/carrinhos-abandonados"
    : "/carrinhos-abandonados";

  const openCartDetails = (cartId: string) => {
    router.push(`${detailsBasePath}/${encodeURIComponent(cartId)}`);
  };

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setRecoveryFilter(normalizeRecoveryFilter(initialRecoveryStatus));
  }, [initialRecoveryStatus]);

  useEffect(() => {
    setCarts(initialCarts);
  }, [initialCarts]);

  useEffect(() => {
    setSelectedLimit(parseAbandonedCartPageLimit(pageSize));
  }, [pageSize]);

  const formatBRL = (cents: number) => {
    const reais = Math.floor(cents / 100);
    const centavos = cents % 100;
    return `R$ ${reais.toLocaleString("pt-BR")},${centavos.toString().padStart(2, "0")}`;
  };

  const formatDateTime = (value: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  const parseCartItems = (cart: CartRow): CartItemPreview[] => {
    try {
      const parsed = JSON.parse(cart.items_json);
      return Array.isArray(parsed) ? (parsed as CartItemPreview[]) : [];
    } catch {
      return [];
    }
  };

  function getSkuCount(cart: CartRow): number {
    return parseCartItems(cart).length;
  }

  function getRecoveryStatus(cart: CartRow): string {
    const normalizedStatus = String(cart.status || "").trim().toLowerCase();
    if (normalizedStatus === "converted") return "RECOVERED";

    if (cart.recovery_method === "email" && cart.recovery_sent_at) return "SENT_EMAIL";
    if (cart.recovery_method === "whatsapp" && cart.recovery_sent_at) return "SENT_WHATSAPP";
    return "NOT_SENT";
  }

  const handleDispatchWhatsApp = async (cart: CartRow) => {
    if (!canSendMessages) {
      toast.error("Sem permissão", {
        description: "Você não tem permissão para enviar mensagens",
      });
      return;
    }

    if (!cart.customer_phone) {
      toast.error("Telefone não cadastrado", {
        description: "Este cliente não tem telefone válido para WhatsApp",
      });
      return;
    }

    try {
      setDispatchingCartId(cart.id);

      const result = await dispatchCartMessageAction({
        cartId: cart.id,
        trigger: "CART_ABANDONED",
        channel: "WHATSAPP",
      });

      if (result.success && result.data?.whatsappUrl) {
        setCarts((prev) =>
          prev.map((c) =>
            c.id === cart.id
              ? {
                  ...c,
                  recovery_sent_at: new Date().toISOString(),
                  recovery_method: "whatsapp",
                }
              : c
          )
        );

        toast.success("Abrindo WhatsApp...", {
          description: "Clique para enviar a mensagem",
        });

        window.open(result.data.whatsappUrl, "_blank", "noopener,noreferrer");
        router.refresh();
      } else {
        toast.error("Erro ao gerar link", {
          description: result.error || "Não foi possível gerar o link do WhatsApp",
        });
      }
    } catch (error) {
      toast.error("Erro", {
        description:
          error instanceof Error ? error.message : "Erro ao disparar mensagem",
      });
    } finally {
      setDispatchingCartId(null);
    }
  };

  const handleGenerateRecoveryLink = async (cart: CartRow) => {
    const recoveryStatus = getRecoveryStatus(cart);
    if (recoveryStatus === "RECOVERED") {
      toast.error("Carrinho já recuperado", {
        description: "Não é possível gerar link para carrinho já convertido em pedido.",
      });
      return;
    }

    const customerId = Number(cart.client_id || 0);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      toast.error("Cliente sem vínculo", {
        description: "Este carrinho não possui cliente para geração de link.",
      });
      return;
    }

    try {
      setGeneratingLinkCartId(cart.id);

      // Reuse the same storefront base used by "Ver Vitrine".
      const candidateBase = buildStorefrontUrl(storefrontUrl || "/", "");
      const absoluteStorefrontBase = /^https?:\/\//i.test(candidateBase)
        ? candidateBase
        : undefined;

      const result = await generateAbandonedCartRecoveryLinkAction({
        cartId: cart.id,
        customerId,
        storefrontBaseUrl: absoluteStorefrontBase,
      });

      if (!result.success) {
        toast.error("Erro ao gerar link", {
          description: result.error,
        });
        return;
      }

      const recoveryUrl = result.data.recoveryUrl;

      try {
        await navigator.clipboard.writeText(recoveryUrl);
        toast.success("Link gerado e copiado", {
          description: result.data.hadValidToken
            ? `Havia ${result.data.revokedTokensCount} link(s) válido(s), um novo foi gerado.`
            : "Novo link de recuperação gerado com sucesso.",
        });
      } catch {
        toast.success("Link gerado", {
          description: recoveryUrl,
        });
      }
    } finally {
      setGeneratingLinkCartId(null);
    }
  };

  const stats = {
    visible: summary.total_count,
    inRecovery: summary.in_recovery_count,
    potentialRevenue: summary.potential_revenue_cents,
    recovered: summary.recovered_count,
  };

  function navigateWithParams(
    nextPage: number,
    nextSearch: string,
    nextRecovery: string,
    nextLimit?: number,
  ) {
    const limit = parseAbandonedCartPageLimit(nextLimit ?? selectedLimit);
    const params = new URLSearchParams();
    if (nextPage > 1) params.set("page", String(nextPage));
    if (limit !== 20) params.set("limit", String(limit));
    if (nextSearch.trim().length > 0) params.set("q", nextSearch.trim());
    if (nextRecovery !== "all") params.set("recovery_status", nextRecovery);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    router.refresh();
  }

  function applyPageLimit(nextLimit: number) {
    setSelectedLimit(nextLimit);
    navigateWithParams(1, search, recoveryFilter, nextLimit);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateWithParams(1, search, recoveryFilter);
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              Recuperação de carrinhos
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Carrinhos Abandonados
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Clientes que iniciaram a compra, mas nao finalizaram o pedido.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Carrinhos</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.visible}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-amber-300 to-amber-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Em recuperação</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.inRecovery}</p>
            </div>
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Valor em risco</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{formatBRL(stats.potentialRevenue)}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Recuperados</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.recovered}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-sky-500" />
        </div>
      </div>

      {/* Filtros */}
      <form className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm" onSubmit={handleSearchSubmit}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, empresa, telefone ou e-mail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
              Buscar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={recoveryFilter}
              onValueChange={(value) => {
                setRecoveryFilter(value)
                navigateWithParams(1, search, value)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="not_sent">Não disparado</SelectItem>
                <SelectItem value="sent_whatsapp">Mensagem Enviada (WhatsApp)</SelectItem>
                <SelectItem value="sent_email">Mensagem Enviada (E-mail)</SelectItem>
                <SelectItem value="recovered">Recuperado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={String(selectedLimit)}
              onValueChange={(value) => {
                const nextLimit = Number.parseInt(value, 10);
                if (!Number.isFinite(nextLimit)) return;
                applyPageLimit(nextLimit);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
                <SelectValue placeholder="Itens/pagina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por pagina</SelectItem>
                <SelectItem value="50">50 por pagina</SelectItem>
                <SelectItem value="100">100 por pagina</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              title="Limpar filtros"
              aria-label="Limpar filtros"
              onClick={() => {
                setSearch("")
                setRecoveryFilter("all")
                navigateWithParams(1, "", "all")
              }}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      {/* Tabela */}
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>Carrinho</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum carrinho abandonado encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              carts.map((cart) => {
                const recoveryStatus = getRecoveryStatus(cart);
                const statusConfig = RECOVERY_STATUS_LABELS[recoveryStatus];
                const canGenerateRecoveryLink = recoveryStatus !== "RECOVERED" && Number(cart.client_id || 0) > 0;

                return (
                  <TableRow
                    key={cart.id}
                    className="hover:bg-muted/40 align-top cursor-pointer"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button,a,[role='menuitem']")) return;
                      openCartDetails(cart.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        const target = event.target as HTMLElement;
                        if (target.closest("button,a,[role='menuitem']")) return;
                        event.preventDefault();
                        openCartDetails(cart.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Abrir carrinho ${cart.id}`}
                  >
                    <TableCell className="font-mono text-sm">
                      #{cart.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{cart.customer_name || "N/A"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {cart.customer_email && (
                        <p className="truncate">{cart.customer_email}</p>
                      )}
                      {cart.customer_phone && (
                        <p className="text-muted-foreground text-xs">
                          {cart.customer_phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold leading-none text-foreground">
                          {cart.total_items}
                        </div>
                        <div className="inline-flex items-center rounded-full border border-border/40 bg-muted/60 px-2.5 py-1 text-sm font-medium leading-none text-muted-foreground">
                          {getSkuCount(cart)} SKUs
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatBRL(cart.total_cents)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(cart.updated_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`rounded-full px-2.5 py-1 font-medium ${statusConfig.chipClassName}`}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            aria-label="Ações do carrinho"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => openCartDetails(cart.id)}
                            className="gap-2 cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (canGenerateRecoveryLink && !generatingLinkCartId) {
                                void handleGenerateRecoveryLink(cart)
                              }
                            }}
                            disabled={!!generatingLinkCartId || !canGenerateRecoveryLink}
                            className="gap-2"
                          >
                            {generatingLinkCartId === cart.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Link2 className="h-4 w-4 text-sky-600" />
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              </>
                            )}
                            Gerar link
                          </DropdownMenuItem>
                          {canSendMessages ? (
                            <DropdownMenuItem
                              onClick={() => {
                                if (!dispatchingCartId) {
                                  void handleDispatchWhatsApp(cart)
                                }
                              }}
                              disabled={!!dispatchingCartId}
                              className="gap-2"
                            >
                              {dispatchingCartId === cart.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MessageCircle className="h-4 w-4 text-green-600" />
                              )}
                              WhatsApp
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 ? (
        <AdminPaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => navigateWithParams(page, search, recoveryFilter)}
          showing={{
            start: totalCount === 0 ? 0 : (currentPage - 1) * selectedLimit + 1,
            end: Math.min(totalCount, (currentPage - 1) * selectedLimit + carts.length),
            total: totalCount,
          }}
        />
      ) : null}

    </div>
  );
}
