import type { ReactNode } from "react";

export type OrderPaymentEventResponse = {
  id: number;
  event_type: string;
  event_source: string | null;
  payload_json: Record<string, unknown> | null;
  occurred_at: string | null;
  created_at: string;
};

export type OrderPaymentResponse = {
  id: number;
  order_id: number;
  store_id: number | null;
  provider: string | null;
  status: string;
  amount_cents: number;
  installments?: number | null;
  gateway_transaction_id: string | null;
  gateway_reference: string | null;
  payment_code: string | null;
  payment_label: string | null;
  gateway_cause_code?: string | null;
  gateway_cause_message?: string | null;
  snapshot_json?: Record<string, unknown> | null;
  authorized_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  events: OrderPaymentEventResponse[];
};

export type PaymentLinkResponse = {
  id: number;
  token: string;
  status: string;
  amount_cents: number;
  expires_at: string | null;
  attempt_count: number;
  open_count: number;
};

export type PaymentLinkDetailWithUrl = {
  link: PaymentLinkResponse;
  public_url: string;
};

export type RetryPaymentMethod = "PIX" | "BOLETO" | "CARTAO_EXTERNO";

export interface OrderPaymentsCardProps {
  orderId: string;
  storeId?: number | null;
  paymentStatus?: string | null;
  paymentMethodId?: number | null;
  initialPayments?: OrderPaymentResponse[];
  initialPaymentLinks?: unknown[];
  readOnly?: boolean;
  paymentLinkLocked?: boolean;
  paymentLinkLockReason?: string | null;
}

export type GatewayGroup = {
  key: string;
  label: string;
  subtitle: string;
  icon: ReactNode;
  tone: string;
  badgeClass: string;
  payments: OrderPaymentResponse[];
  latestPayment: OrderPaymentResponse | null;
  isGetnet: boolean;
};
