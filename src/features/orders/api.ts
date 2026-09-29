import type { CreateOrderInput, TrackedOrder, DeliveryStatusCode, ApiCampaignOrder } from "../../../shared/contracts";
import { request, staffRequest } from "../../lib/http";

export async function createOrderInApi(input: CreateOrderInput) {
  const payload = await request<{ order: { number: string; totalCents: number; paymentStatus: string } }>("/orders", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      campaignCode: input.campaignCode,
      customer: input.customer,
      items: input.items,
      couponCode: input.couponCode || undefined,
    }),
  });
  return payload.order;
}

export async function createInfinitePayCheckout(orderNumber: string, whatsapp: string) {
  const payload = await request<{ checkout: { url: string; reused: boolean } }>(
    `/orders/${encodeURIComponent(orderNumber)}/checkout`,
    { method: "POST", body: JSON.stringify({ whatsapp }) },
    15000,
  );
  return payload.checkout;
}

export async function requestInfinitePayReconciliation(input: {
  orderNsu: string;
  transactionNsu: string;
  invoiceSlug: string;
  receiptUrl?: string;
  captureMethod?: string;
}) {
  return request<{ accepted: boolean; duplicate: boolean }>("/payments/infinitepay/reconcile", {
    method: "POST",
    body: JSON.stringify({
      order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu,
      slug: input.invoiceSlug,
      receipt_url: input.receiptUrl,
      capture_method: input.captureMethod,
    }),
  });
}

export async function trackOrderInApi(orderNumber: string, whatsapp: string) {
  const query = new URLSearchParams({ whatsapp });
  const payload = await request<{ order: TrackedOrder }>(
    `/orders/${encodeURIComponent(orderNumber)}?${query.toString()}`,
  );
  return payload.order;
}

export async function fetchCampaignOrders(code: string) {
  const payload = await staffRequest<{ orders: ApiCampaignOrder[] }>(
    `/admin/campaigns/${encodeURIComponent(code)}/orders`,
  );
  return payload.orders;
}

export async function cancelOrderInApi(orderNumber: string, reason: string) {
  const payload = await staffRequest<{ order: { number: string; status: string } }>(
    `/admin/orders/${encodeURIComponent(orderNumber)}/cancel`,
    { method: "PATCH", body: JSON.stringify({ reason }) },
  );
  return payload.order;
}

export async function registerOrderRefundInApi(input: {
  orderNumber: string;
  amountCents: number;
  providerRefundId: string;
  reason: string;
  receiptUrl?: string;
}) {
  const payload = await staffRequest<{
    refund: { number: string; status: string; paymentStatus: "refunded"; amountCents: number };
  }>(`/admin/orders/${encodeURIComponent(input.orderNumber)}/refund`, {
    method: "POST",
    body: JSON.stringify({
      amountCents: input.amountCents,
      providerRefundId: input.providerRefundId,
      reason: input.reason,
      receiptUrl: input.receiptUrl || undefined,
    }),
  });
  return payload.refund;
}

export async function changeOrderDeliveryInApi(orderNumber: string, status: "ready" | "delivered" | "issue", note?: string) {
  const payload = await staffRequest<{ order: { deliveryStatus: DeliveryStatusCode } }>(
    `/admin/orders/${encodeURIComponent(orderNumber)}/delivery`,
    { method: "PATCH", body: JSON.stringify({ status, note }) },
  );
  return payload.order;
}
