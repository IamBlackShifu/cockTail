"use client";

import { useCallback, useEffect, useState } from "react";
import { money, statusLabels, type Order, type Receipt } from "@/lib/orders";
import { pendingKey, receiptKey, sendOrder, type PendingOrder } from "@/lib/client-orders";

export function OrderTracker() {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState("");
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setPending(Boolean(sessionStorage.getItem(pendingKey)));
      const receipt = JSON.parse(localStorage.getItem(receiptKey) || "null") as Receipt | null;
      if (!receipt?.id || !receipt?.token) { setOrder(null); return; }
      const response = await fetch(`/api/orders/${encodeURIComponent(receipt.id)}`, { headers: { Authorization: `Bearer ${receipt.token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update this order.");
      if (JSON.parse(localStorage.getItem(receiptKey) || "null")?.id !== receipt.id) return;
      setOrder(result.order); setError(""); setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch { setError("Order updates are unavailable. We will try again shortly."); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    const listener = () => { void refresh(); };
    window.addEventListener("tipsygo-order", listener);
    window.addEventListener("tipsygo-pending", listener);
    window.addEventListener("storage", listener);
    window.addEventListener("focus", listener);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener("tipsygo-order", listener); window.removeEventListener("tipsygo-pending", listener); window.removeEventListener("storage", listener); window.removeEventListener("focus", listener); };
  }, [refresh]);
  async function retry() {
    setRetrying(true);
    try {
      const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "null") as PendingOrder | null;
      if (saved) await sendOrder(saved);
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please retry shortly."); }
    finally { setRetrying(false); setPending(Boolean(sessionStorage.getItem(pendingKey))); }
  }
  if (!order && !pending) return null;
  return <section className="order-status connected-tracker" id="order-status" aria-label="Your latest order">
    {pending && <div className="payment-notice"><strong>Your last checkout needs confirmation</strong><p>Retrying will confirm the same order without placing it twice.</p><button className="dark-button" disabled={retrying} onClick={retry}>{retrying ? "Checking…" : "Retry confirmation"}</button></div>}
    {order && <>
      <div className="status-topline"><div><p className="eyebrow">{order.fulfillment} order</p><h2>{statusLabels[order.status]}</h2><p>{order.status === "new" ? "Your order is saved. The team will review it shortly." : order.status === "cancelled" ? "The team cancelled this order. Any collected payment needs to be settled directly with the team." : "Status updates come directly from the team."}</p></div>
        <div className="order-code"><span>Order number</span><strong>{order.number}</strong><small>{money(order.totalCents)} · {order.payment === "paid" ? "Payment collected" : `Pay on ${order.fulfillment.toLowerCase()}`}</small></div></div>
      <ul className="receipt-items">{order.items.map((item, index) => <li key={index}><span>{item.quantity} × {item.name}<small>{item.customization}</small></span><strong>{money(item.unitCents * item.quantity)}</strong></li>)}</ul>
      <ol className="receipt-history">{order.history.map((event, index) => <li key={index}><span>{event.label}</span><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
      <p className="flow-hint">Keep this browser to track your latest order. {updated && `Last checked ${updated}.`}</p>
      <button className="outline-button tracker-refresh" disabled={refreshing} onClick={() => void refresh()}>
        <span>{refreshing ? "Checking…" : "Refresh status"}</span><span aria-hidden="true">{refreshing ? "•••" : "↗"}</span>
      </button>
    </>}
    {error && <p className="flow-error" role="status">{error}</p>}
  </section>;
}
