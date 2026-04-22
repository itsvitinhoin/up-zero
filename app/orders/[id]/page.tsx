import AdminOrderDetailPageClient from "@/components/admin/admin-order-detail-page-client";
import { cookies } from "next/headers";
import { getAttributesWithValuesByStore, getStoreIdFromToken } from "@/lib/actions/attributes";
import { getOrderDetailAction } from "@/lib/actions/orders";
import { getCustomerDetailAction } from "@/lib/actions/customers";
import { getProductsAction } from "@/lib/actions/products";
import type { Customer, Order, OrderItem, Product } from "@/lib/types";

type OrderWithExtras = Order & {
  items: OrderItem[];
  customer?: Customer;
};

type AttributeLabelMaps = {
  color: Record<string, string>
  size: Record<string, string>
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"
  const { id } = await params;

  let initialOrder: OrderWithExtras | null = null;
  let initialCustomer: Customer | null = null;
  let initialProducts: Product[] = [];
  let initialAttributeLabels: AttributeLabelMaps = { color: {}, size: {} };

  try {
    const [orderResult, productsResult] = await Promise.all([
      getOrderDetailAction(id),
      getProductsAction(),
    ]);

    if (orderResult.success && orderResult.data) {
      initialOrder = orderResult.data as OrderWithExtras;

      if (initialOrder.customer) {
        initialCustomer = initialOrder.customer;
      } else {
        const customerResult = await getCustomerDetailAction(initialOrder.customerId);
        if (customerResult.success && customerResult.data) {
          initialCustomer = customerResult.data;
        }
      }
    }

    if (productsResult.success && productsResult.data) {
      initialProducts = productsResult.data;
    }

    const storeId = await getStoreIdFromToken()
    if (storeId) {
      const attributesResult = await getAttributesWithValuesByStore(storeId)
      if (attributesResult.success && Array.isArray(attributesResult.data)) {
        const color: Record<string, string> = {}
        const size: Record<string, string> = {}

        for (const attr of attributesResult.data) {
          const attrCode = String(attr?.code || '').trim().toLowerCase()
          const target = attrCode === 'color' ? color : (attrCode === 'size' ? size : null)
          if (!target) continue

          for (const value of attr.values || []) {
            const valueCode = String(value?.code || '').trim()
            const valueName = String(value?.name || '').trim()
            if (!valueName) continue

            if (valueCode) {
              target[valueCode] = valueName
              target[valueCode.toUpperCase()] = valueName
              target[valueCode.toLowerCase()] = valueName
            }
          }
        }

        initialAttributeLabels = { color, size }
      }
    }
  } catch (error) {
    console.error("Erro ao carregar detalhe do pedido admin:", error);
  }

  return (
    <AdminOrderDetailPageClient
      locale={locale}
      orderId={id}
      initialOrder={initialOrder}
      initialCustomer={initialCustomer}
      initialProducts={initialProducts}
      initialAttributeLabels={initialAttributeLabels}
    />
  );
}
