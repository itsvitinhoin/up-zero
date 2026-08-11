import { Suspense } from 'react'
import AdminOrderDetailPageClient from "@/components/admin/admin-order-detail-page-client";
import { cookies } from "next/headers";
import { getAttributesWithValuesByStore, getStoreIdFromToken } from "@/lib/actions/attributes";
import { getOrderDetailAction, listPaymentLinksAction } from "@/lib/actions/orders";
import { getSiteSettingsAction } from "@/lib/actions/settings";
import type { Customer, Order, OrderItem, OrderInvoice, OrderLabel, StockMode } from "@/lib/types";
import Loading from './loading'

type OrderWithExtras = Order & {
  items: OrderItem[];
  customer?: Customer;
};

type AttributeLabelMaps = {
  color: Record<string, string>
  size: Record<string, string>
  colorHex: Record<string, string>
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminOrderDetailPageContent params={params} />
    </Suspense>
  )
}

async function AdminOrderDetailPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"
  const { id } = await params;

  let initialOrder: OrderWithExtras | null = null;
  let initialCustomer: Customer | null = null;
  let initialInvoice: OrderInvoice | null = null;
  let initialLabel: OrderLabel | null = null;
  let initialPayments: unknown[] = [];
  let initialPaymentLinks: unknown[] = [];
  let initialStockMode: StockMode = "FANTASY";
  let initialStockVariantMaxQty = 999;
  let initialAttributeLabels: AttributeLabelMaps = { color: {}, size: {}, colorHex: {} };
  const numericOrderId = Number(id)

  try {
    const [orderResult, settingsResult, storeId, paymentLinksResult] = await Promise.all([
      getOrderDetailAction(id),
      getSiteSettingsAction(),
      getStoreIdFromToken(),
      Number.isFinite(numericOrderId) && numericOrderId > 0
        ? listPaymentLinksAction({ orderId: Math.trunc(numericOrderId), limit: 50 })
        : Promise.resolve({ success: false } as const),
    ]);

    if (orderResult.success && orderResult.data) {
      initialOrder = orderResult.data as OrderWithExtras;
      initialInvoice = orderResult.data.invoice || null;
      initialLabel = orderResult.data.label || null;
      initialPayments = Array.isArray(orderResult.data.payments) ? orderResult.data.payments : [];
    }

    if (settingsResult.success && settingsResult.data) {
      initialStockMode = settingsResult.data.stockMode || "FANTASY";
      initialStockVariantMaxQty = Math.max(1, Number(settingsResult.data.variantMaxQty || 999));
    }

    if (paymentLinksResult.success && paymentLinksResult.data) {
      initialPaymentLinks = Array.isArray(paymentLinksResult.data.items) ? paymentLinksResult.data.items : []
    }

    const attributesPromise = storeId
      ? getAttributesWithValuesByStore(storeId)
      : Promise.resolve(null)

    const attributesResult = await attributesPromise

    if (initialOrder?.customer) {
      initialCustomer = initialOrder.customer
    }

    if (attributesResult?.success && Array.isArray(attributesResult.data)) {
        const color: Record<string, string> = {}
        const size: Record<string, string> = {}
        const colorHex: Record<string, string> = {}

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

            if (attrCode === 'color') {
              const hex = value?.meta?.rgb || value?.meta?.hex || null
              if (hex && typeof hex === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(hex)) {
                if (valueCode) {
                  colorHex[valueCode] = hex
                  colorHex[valueCode.toUpperCase()] = hex
                  colorHex[valueCode.toLowerCase()] = hex
                }
                colorHex[valueName.toLowerCase()] = hex
              }
            }
          }
        }

      initialAttributeLabels = { color, size, colorHex }
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
      initialInvoice={initialInvoice}
      initialLabel={initialLabel}
      initialPayments={initialPayments}
      initialPaymentLinks={initialPaymentLinks}
      initialStockMode={initialStockMode}
      initialStockVariantMaxQty={initialStockVariantMaxQty}
      initialAttributeLabels={initialAttributeLabels}
    />
  );
}
