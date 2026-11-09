"use client";

import { useCallback, useEffect, useState } from "react";
import { money, statusLabels, type Order, type Receipt, type StoreSettings } from "@/lib/orders";
import { pendingKey, receiptKey, sendOrder, type PendingOrder } from "@/lib/client-orders";

function sharedReceipt(): Receipt | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const id = params.get("order");
  const token = params.get("token");
  if (!id || !/^[a-f0-9-]{36}$/.test(id) || !token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const receipt = { id, token };
  localStorage.setItem(receiptKey, JSON.stringify(receipt));
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#order-status`);
  return receipt;
}

export function OrderTracker() {
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setPending(Boolean(sessionStorage.getItem(pendingKey)));
      const receipt = sharedReceipt() || JSON.parse(localStorage.getItem(receiptKey) || "null") as Receipt | null;
      if (!receipt?.id || !receipt?.token) { setOrder(null); return; }
      const [orderResponse, storeResponse] = await Promise.all([
        fetch(`/api/orders/${encodeURIComponent(receipt.id)}`, { headers: { Authorization: `Bearer ${receipt.token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) }),
        fetch("/api/store", { cache: "no-store", signal: AbortSignal.timeout(10000) }),
      ]);
      const result = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(result.error || "Unable to update this order.");
      if (JSON.parse(localStorage.getItem(receiptKey) || "null")?.id !== receipt.id) return;
      setOrder(result.order); setError(""); setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (storeResponse.ok) setSettings((await storeResponse.json()).settings);
    } catch { setError("Order updates are unavailable. We will try again shortly."); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    const listener = () => { void refresh(); };
    window.addEventListener("tipsygo-order", listener); window.addEventListener("tipsygo-pending", listener); window.addEventListener("storage", listener); window.addEventListener("focus", listener);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener("tipsygo-order", listener); window.removeEventListener("tipsygo-pending", listener); window.removeEventListener("storage", listener); window.removeEventListener("focus", listener); };
  }, [refresh]);
  async function retry() {
    setRetrying(true);
    try { const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "null") as PendingOrder | null; if (saved) await sendOrder(saved); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Please retry shortly."); }
    finally { setRetrying(false); setPending(Boolean(sessionStorage.getItem(pendingKey))); }
  }
  async function copyTrackingLink() {
    const receipt = JSON.parse(localStorage.getItem(receiptKey) || "null") as Receipt | null;
    if (!receipt) return;
    const url = `${window.location.origin}/#order=${encodeURIComponent(receipt.id)}&token=${encodeURIComponent(receipt.token)}`;
    try { await navigator.clipboard.writeText(url); setShareNotice("Private tracking link copied. Share it only with someone you trust."); }
    catch { setShareNotice("Copy was blocked by your browser. Keep this browser open to track the order."); }
  }
  if (!order && !pending) return null;
  const latest = order?.customerUpdates?.at(-1);
  const contactText = order ? `Hi TipsyGo, I need help with order ${order.number}.` : "Hi TipsyGo, I need help with my order.";
  return <section className="order-status connected-tracker" id="order-status" aria-label="Your latest order">
    {pending && <div className="payment-notice"><strong>Your last checkout needs confirmation</strong><p>Retrying will confirm the same order without placing it twice.</p><button className="dark-button" disabled={retrying} onClick={retry}>{retrying ? "Checking…" : "Retry confirmation"}</button></div>}
    {order && <>
      <div className="status-topline"><div><p className="eyebrow">{order.fulfillment} order · Live updates</p><h2>{statusLabels[order.status]}</h2><p>{order.status === "new" ? "Your order is saved. The team will review it shortly." : order.status === "cancelled" ? "The team cancelled this order. Any collected payment needs to be settled directly with the team." : "This page checks for team updates automatically every 10 seconds."}</p></div><div className="order-code"><span>Order number</span><strong>{order.number}</strong><small>{money(order.totalCents)} · {order.payment === "paid" ? "Payment collected" : `Pay on ${order.fulfillment.toLowerCase()}`}</small></div></div>
      {latest && <div className="customer-update"><span>Latest update from the team</span><strong>{latest.message}</strong>{latest.estimatedAt && <p>Estimated {order.fulfillment === "Delivery" ? "arrival" : "ready"}: <time dateTime={latest.estimatedAt}>{new Date(latest.estimatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p>}</div>}
      <ul className="receipt-items">{order.items.map((item, index) => <li key={index}><span>{item.quantity} × {item.name}<small>{item.customization}</small></span><strong>{money(item.unitCents * item.quantity)}</strong></li>)}</ul>
      <ol className="receipt-history">{order.history.map((event, index) => <li key={index}><span>{event.label}</span><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
      <p className="flow-hint">Live tracking is active while this page is open. {updated && `Last checked ${updated}.`}</p>
      <div className="tracker-actions"><button className="outline-button tracker-refresh" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? "Checking…" : "Refresh status"}</button><button className="outline-button" onClick={() => void copyTrackingLink()}>Copy tracking link</button>{settings?.whatsappNumber && <a className="outline-button" href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(contactText)}`} target="_blank" rel="noreferrer">Contact us on WhatsApp</a>}</div>
      {shareNotice && <p className="flow-hint" role="status">{shareNotice}</p>}
    </>}
    {error && <p className="flow-error" role="status">{error}</p>}
  </section>;
}
