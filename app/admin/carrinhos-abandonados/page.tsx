import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminRouteSkeleton } from "@/components/admin/admin-route-skeleton";
import AdminAbandonedCartsPageClient from "@/components/admin/admin-abandoned-carts-page-client";
import { buildAdminCookieHeader } from "@/lib/actions/auth";

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

interface AbandonedCartsSummary {
  total_count: number;
  in_recovery_count: number;
  recovered_count: number;
  potential_revenue_cents: number;
}

function resolveBackendBaseUrl(): string {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? "").trim();
  if (!base) {
    throw new Error("NEXT_PUBLIC_RUST_URL not configured");
  }
  return base.replace(/\/$/, "");
}

export const metadata = {
  title: "Carrinhos Abandonados | Admin",
  description: "Gerenciar e recuperar carrinhos abandonados",
};

export const instant = false;

const ABANDONED_CART_PAGE_SIZE_OPTIONS = new Set([20, 50, 100]);

function parseAbandonedCartPageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return ABANDONED_CART_PAGE_SIZE_OPTIONS.has(parsed) ? parsed : 20;
}

interface AdminAbandonedCartsPageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    recovery_status?: string;
  }>;
}

export default function AdminAbandonedCartsPage({ searchParams }: AdminAbandonedCartsPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminAbandonedCartsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAbandonedCartsPageContent({ searchParams }: AdminAbandonedCartsPageProps) {
  await connection();

  const baseUrl = resolveBackendBaseUrl();
  const cookieHeader = await buildAdminCookieHeader();
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedPage = Number.parseInt(resolvedSearchParams.page ?? "1", 10);
  const q = (resolvedSearchParams.q ?? "").trim();
  const recoveryStatus = (resolvedSearchParams.recovery_status ?? "all").trim().toLowerCase();

  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = parseAbandonedCartPageLimit(resolvedSearchParams.limit);

  let carts: CartRow[] = [];
  let summary: AbandonedCartsSummary = {
    total_count: 0,
    in_recovery_count: 0,
    recovered_count: 0,
    potential_revenue_cents: 0,
  };
  let totalPages = 0;
  let currentPage = page;

  try {
    const url = new URL(`${baseUrl}/admin/carts/abandoned`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    if (q.length > 0) url.searchParams.set("q", q);
    if (recoveryStatus.length > 0) url.searchParams.set("recovery_status", recoveryStatus);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "content-type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return notFound();
      }
      console.warn("Abandoned carts endpoint unavailable", {
        status: response.status,
      });
      carts = [];
    } else {
      const data = await response.json();
      carts = Array.isArray(data.carts) ? data.carts : [];
      summary = data.summary ?? summary;
      totalPages = Number.isFinite(data.total_pages) ? Number(data.total_pages) : 0;
      currentPage = Number.isFinite(data.page) ? Number(data.page) : page;
    }
  } catch (error) {
    console.error("Failed to fetch abandoned carts:", error);
    carts = [];
  }

  return (
    <AdminAbandonedCartsPageClient
      initialCarts={carts}
      summary={summary}
      currentPage={currentPage}
      pageSize={limit}
      totalCount={summary.total_count}
      totalPages={totalPages}
      initialSearch={q}
      initialRecoveryStatus={recoveryStatus || "all"}
    />
  );
}
