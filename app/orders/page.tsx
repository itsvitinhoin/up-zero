import AdminOrdersPageClient from "@/components/admin/admin-orders-page-client";
import { getOrdersAction } from "@/lib/actions/orders";
import { getCustomersAction } from "@/lib/actions/customers";
import { withAdminMockCustomers, withAdminMockOrders } from "@/lib/admin-mock-data";

export default async function AdminOrdersPage() {
  const [ordersResult, customersResult] = await Promise.all([
    getOrdersAction(),
    getCustomersAction(),
  ]);

  const initialOrders = withAdminMockOrders(
    ordersResult.success && ordersResult.data ? ordersResult.data : [],
  );
  const initialCustomers = withAdminMockCustomers(
    customersResult.success && customersResult.data ? customersResult.data : [],
  );

  return (
    <AdminOrdersPageClient
      initialOrders={initialOrders}
      initialCustomers={initialCustomers}
    />
  );
}
