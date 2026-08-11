import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AdminRouteSkeleton } from "@/components/admin/admin-route-skeleton";
import AdminAbandonedCartDetailPage, { type AbandonedCartRow } from "@/components/admin/admin-abandoned-cart-detail-page";
import { buildAdminCookieHeader } from "@/lib/actions/auth";

function resolveBackendBaseUrl(): string {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? "").trim();
  if (!base) {
    throw new Error("NEXT_PUBLIC_RUST_URL not configured");
  }
  return base.replace(/\/$/, "");
}

export const metadata = {
  title: "Detalhes do Carrinho Abandonado | Admin",
  description: "Visualização completa de um carrinho abandonado",
};

export const instant = false;

export default function AbandonedCartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AbandonedCartDetailPageContent params={params} />
    </Suspense>
  );
}

async function AbandonedCartDetailPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const baseUrl = resolveBackendBaseUrl();
  const cookieHeader = await buildAdminCookieHeader();

  try {
    const url = new URL(`${baseUrl}/admin/carts/abandoned`);
    url.searchParams.set("q", id);
    url.searchParams.set("limit", "100");
    url.searchParams.set("recovery_status", "all");

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
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return notFound();
      }
      console.warn("Abandoned cart detail endpoint unavailable", {
        status: response.status,
        cartId: id,
      });
      return notFound();
    }

    const payload = (await response.json()) as { carts?: AbandonedCartRow[] };
    const carts = Array.isArray(payload.carts) ? payload.carts : [];
    const cart = carts.find((candidate) => String(candidate.id) === String(id));

    if (!cart) {
      return notFound();
    }

    return <AdminAbandonedCartDetailPage cart={cart} basePath="/carrinhos-abandonados" />;
  } catch (error) {
    console.error("Failed to fetch abandoned cart detail:", error);
    return notFound();
  }
}
