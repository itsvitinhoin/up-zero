import AdminAbandonedCartsPageClient from "@/components/admin/admin-abandoned-carts-page-client";
import { abandonedCartsMock } from "@/lib/admin-abandoned-carts-mock-data";

export default function AdminAbandonedCartsPage() {
  return <AdminAbandonedCartsPageClient initialCarts={abandonedCartsMock} />;
}

