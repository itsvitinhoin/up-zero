import { notFound } from "next/navigation";
import AdminAbandonedCartDetailPageClient from "@/components/admin/admin-abandoned-cart-detail-page-client";
import { getAbandonedCartById } from "@/lib/admin-abandoned-carts-mock-data";

export default async function AdminAbandonedCartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cart = getAbandonedCartById(id);

  if (!cart) {
    notFound();
  }

  return <AdminAbandonedCartDetailPageClient cart={cart} />;
}

