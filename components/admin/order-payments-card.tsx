"use client";

import { useEffect, useState } from "react";
import {
  createOrderPaymentLinkAction,
  cancelOrderPaymentLinkAction,
  getOrderPaymentsAction,
  getPaymentPublicKeyAction,
  listPaymentLinksAction,
  retryOrderPaymentAction,
  updateOrderAction,
} from "@/lib/actions/orders";
import { useAdminStore } from "@/contexts/admin-store-context";
import { GatewayPaymentsCard } from "./order-payments/gateway-payments-card";
import {
  isCardRetryPayment,
  mapInitialPaymentLinks,
  buildPaymentLinkPublicUrl,
} from "./order-payments/helpers";
import { PaymentLinksCard } from "./order-payments/payment-links-card";
import type {
  OrderPaymentsCardProps,
  OrderPaymentResponse,
  PaymentLinkDetailWithUrl,
  RetryPaymentMethod,
} from "./order-payments/types";

async function generatePagBankToken(storeId: number, payment: OrderPaymentResponse | null): Promise<string> {
  const snapshot = payment?.snapshot_json as Record<string, unknown> | null;
  const directToken = String(snapshot?.card_token || snapshot?.token || "").trim();
  if (directToken) return directToken;

  const keyResult = await getPaymentPublicKeyAction(String(storeId));
  if (!keyResult?.success || !keyResult?.data?.public_key) {
    throw new Error("Nao foi possivel obter a chave publica para retentativa de cartao.");
  }

  throw new Error("Retentativa de cartao indisponivel: token de cartao nao encontrado no snapshot.");
}

export default function OrderPaymentsCard({
  orderId,
  storeId,
  paymentStatus,
  paymentMethodId,
  initialPayments,
  initialPaymentLinks,
  readOnly = false,
  paymentLinkLocked = false,
  paymentLinkLockReason = null,
}: OrderPaymentsCardProps) {
  const { storefrontUrl, store } = useAdminStore();
  const isPrivateStorefront = Boolean(store?.maintenanceMode);
  const hasInitialPayments = Array.isArray(initialPayments);
  const hasInitialPaymentLinks = Array.isArray(initialPaymentLinks);

  const [payments, setPayments] = useState<OrderPaymentResponse[]>(initialPayments || []);
  const [loading, setLoading] = useState(!hasInitialPayments);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkDetailWithUrl[]>(
    mapInitialPaymentLinks(initialPaymentLinks, storefrontUrl, isPrivateStorefront),
  );
  const [creatingLink, setCreatingLink] = useState(false);
  const [cancellingLinkId, setCancellingLinkId] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyFeedbackLinkId, setCopyFeedbackLinkId] = useState<number | null>(null);

  useEffect(() => {
    if (!hasInitialPayments) {
      void loadPayments();
    }
    if (!hasInitialPaymentLinks) {
      void loadPaymentLinks();
    }
  }, [orderId, hasInitialPayments]);

  useEffect(() => {
    if (!hasInitialPaymentLinks) return;
    setPaymentLinks(mapInitialPaymentLinks(initialPaymentLinks, storefrontUrl, isPrivateStorefront));
  }, [initialPaymentLinks, hasInitialPaymentLinks, storefrontUrl, isPrivateStorefront, storeId]);

  async function loadPaymentLinks() {
    const numericOrderId = Number(orderId);
    if (!Number.isFinite(numericOrderId) || numericOrderId <= 0) {
      setPaymentLinks([]);
      return;
    }

    const result = await listPaymentLinksAction({
      orderId: Math.trunc(numericOrderId),
      limit: 50,
    });

    if (!result.success || !result.data || !Array.isArray(result.data.items) || result.data.items.length === 0) {
      setPaymentLinks([]);
      return;
    }

    const mapped = result.data.items.map((entry) => {
      const token = String(entry.token || "").trim();
      return {
        link: {
          id: Number(entry.id),
          token,
          status: String(entry.status || ""),
          amount_cents: Number(entry.amount_cents || 0),
          expires_at: entry.expires_at || null,
          attempt_count: Number(entry.attempt_count || 0),
          open_count: Number(entry.open_count || 0),
        },
        public_url: buildPaymentLinkPublicUrl(storefrontUrl, token, isPrivateStorefront),
      };
    });

    setPaymentLinks(mapped);
  }

  async function loadPayments() {
    setLoading(true);
    setError(null);

    const result = await getOrderPaymentsAction(orderId);
    if (result.success && result.data) {
      setPayments(result.data);
    } else {
      setError(result.error || "Erro ao carregar pagamentos");
      setPayments([]);
    }

    setLoading(false);
  }

  async function handleGeneratePayment(selectedRetryMethod: RetryPaymentMethod) {
    setRetrying(true);
    setError(null);

    const latestPayment = payments.length > 0 ? payments[0] : null;
    const resolvedStoreId =
      storeId ??
      latestPayment?.store_id ??
      payments.find((payment) => typeof payment.store_id === "number")?.store_id ??
      null;

    if (selectedRetryMethod === "CARTAO_EXTERNO" || isCardRetryPayment(latestPayment)) {
      try {
        if (!resolvedStoreId) {
          throw new Error("Store ID ausente para retentativa PagBank.");
        }

        const installments = Number(latestPayment?.installments ?? 0);
        if (!Number.isFinite(installments) || installments <= 0) {
          throw new Error("Retentativa de cartao bloqueada: parcelamento nao identificado no pedido.");
        }

        const cardToken = await generatePagBankToken(resolvedStoreId, latestPayment);
        const result = await retryOrderPaymentAction(orderId, cardToken, installments);
        if (result.success) {
          await loadPayments();
        } else {
          setError(result.error || "Erro ao Gerar Pagamento");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao gerar token do cartao");
      }

      setRetrying(false);
      return;
    }

    const updateMethodResult = await updateOrderAction(orderId, {
      paymentMethod: selectedRetryMethod,
    });

    if (!updateMethodResult.success) {
      setError(updateMethodResult.error || "Erro ao atualizar tipo de pagamento do pedido");
      setRetrying(false);
      return;
    }

    const result = await retryOrderPaymentAction(orderId);
    if (result.success) {
      await loadPayments();
    } else {
      setError(result.error || "Erro ao Gerar Pagamento");
    }

    setRetrying(false);
  }

  async function handleCreatePaymentLink() {
    if (paymentLinkLocked) {
      setError(paymentLinkLockReason || "Finalize o processo de atendimento dos itens antes de gerar link de pagamento.");
      return;
    }

    setCreatingLink(true);
    setError(null);
    setCopyFeedback(null);
    setCopyFeedbackLinkId(null);

    const result = await createOrderPaymentLinkAction(orderId, {
      description: `Pagamento do pedido #${orderId}`,
      expiresInHours: 72,
    });

    if (result.success && result.data) {
      await loadPaymentLinks();
    } else {
      setError(result.error || "Erro ao criar link de pagamento");
    }

    setCreatingLink(false);
  }

  async function handleCancelPaymentLink(paymentLinkId: number) {
    setCancellingLinkId(paymentLinkId);
    setError(null);
    setCopyFeedback(null);
    setCopyFeedbackLinkId(null);

    const result = await cancelOrderPaymentLinkAction(paymentLinkId, "cancelled_from_order_screen");
    if (result.success && result.data) {
      await loadPaymentLinks();
    } else {
      setError(result.error || "Erro ao cancelar link de pagamento");
    }

    setCancellingLinkId(null);
  }

  async function handleCopyPaymentLink(paymentLinkId: number, linkUrl: string) {
    if (!linkUrl) return;

    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopyFeedback("Link copiado");
      setCopyFeedbackLinkId(paymentLinkId);
    } catch {
      setCopyFeedback("Nao foi possivel copiar");
      setCopyFeedbackLinkId(paymentLinkId);
    }
  }

  const latestPayment = payments.length > 0 ? payments[0] : null;
  const canRetry = (!latestPayment || latestPayment.status === "FAILED" || !paymentStatus || paymentStatus === "PENDING") && !readOnly;
  const latestIsCardPayment = isCardRetryPayment(latestPayment);

  void paymentMethodId;

  return (
    <>
      <PaymentLinksCard
        paymentLinks={paymentLinks}
        canRetry={canRetry}
        readOnly={readOnly}
        paymentLinkLocked={paymentLinkLocked}
        paymentLinkLockReason={paymentLinkLockReason}
        creatingLink={creatingLink}
        retrying={retrying}
        cancellingLinkId={cancellingLinkId}
        copyFeedback={copyFeedback}
        copyFeedbackLinkId={copyFeedbackLinkId}
        onCreatePaymentLink={handleCreatePaymentLink}
        onCancelPaymentLink={handleCancelPaymentLink}
        onCopyPaymentLink={handleCopyPaymentLink}
      />

      <GatewayPaymentsCard
        loading={loading}
        error={error}
        payments={payments}
        canRetry={canRetry}
        retrying={retrying}
        creatingLink={creatingLink}
        latestIsCardPayment={latestIsCardPayment}
        onGeneratePayment={handleGeneratePayment}
      />
    </>
  );
}
