import type { Order, OrderInput, Receipt } from "./orders";
export const receiptKey = "tipsygo.receipt.v1";
export const pendingKey = "tipsygo.pending-order.v1";
export type PendingOrder = { key: string; token: string; body: OrderInput };
export function prepareOrder(body: OrderInput): PendingOrder {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const pending = { key: crypto.randomUUID(), token: Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(""), body };
  // Persist before making a request so an interrupted checkout can be retried safely.
  sessionStorage.setItem(pendingKey, JSON.stringify(pending));
  window.dispatchEvent(new Event("tipsygo-pending"));
  return pending;
}
export async function sendOrder(pending: PendingOrder): Promise<Order> {
  const response = await fetch("/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key, "X-Order-Token": pending.token },
    body: JSON.stringify(pending.body), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok) {
    // 4xx responses are definitive rejections. Keep uncertain server/network failures for retry.
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      sessionStorage.removeItem(pendingKey);
      window.dispatchEvent(new Event("tipsygo-pending"));
    }
    throw new Error(result.error || "Your order could not be submitted.");
  }
  const receipt: Receipt = { id: result.order.id, token: pending.token };
  localStorage.setItem(receiptKey, JSON.stringify(receipt));
  sessionStorage.removeItem(pendingKey);
  window.dispatchEvent(new Event("tipsygo-order"));
  return result.order;
}
