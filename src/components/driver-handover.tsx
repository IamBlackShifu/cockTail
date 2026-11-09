"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { HandoverState, Order } from "@/lib/orders";

const next: Record<HandoverState, { action: HandoverState; label: string } | null> = {
  assigned: { action: "collected", label: "I collected this order" },
  collected: { action: "on-the-way", label: "Start delivery" },
  "on-the-way": { action: "delivered", label: "Confirm delivery" },
  delivered: null,
};
const labels: Record<HandoverState, string> = { assigned: "Awaiting collection", collected: "Order collected", "on-the-way": "On the way", delivered: "Delivered" };

export function DriverHandover({ token }: { token: string }) {
  const [order, setOrder] = useState<Order | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => { try { const response = await fetch(`/api/driver/${encodeURIComponent(token)}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setOrder(result.order); setError(""); } catch (failure) { setError(failure instanceof Error ? failure.message : "This delivery could not be loaded."); } }, [token]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function advance(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); if (!order?.handover) return;
    const step = next[order.handover.state]; if (!step) return;
    const form = event ? new FormData(event.currentTarget) : null;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/driver/${encodeURIComponent(token)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: step.action, ...(form ? { recipientName: String(form.get("recipientName") || ""), note: String(form.get("note") || "") } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error); setOrder(result.order);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The handover update failed."); }
    finally { setBusy(false); }
  }
  if (!order) return <main className="driver-shell"><section className="driver-card"><p className="driver-brand">TIPSYGO · HANDOVER</p>{error ? <p className="driver-error">{error}</p> : <p>Loading assigned order…</p>}</section></main>;
  const handover = order.handover!; const step = next[handover.state]; const waitingForReady = handover.state === "assigned" && order.status !== "ready";
  return <main className="driver-shell"><section className="driver-card"><p className="driver-brand">TIPSYGO · HANDOVER</p><p className="driver-order-code">{order.number}</p><h1>{labels[handover.state]}</h1><span className="driver-state">Assigned to {handover.assigneeName}</span>
    <div className="driver-customer"><h2>{order.customer.name}</h2><p>{order.address}</p>{order.instructions && <p><strong>Notes:</strong> {order.instructions}</p>}<div className="driver-links"><a href={`tel:${order.customer.phone.replace(/[^+\d]/g, "")}`}>Call customer</a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`} target="_blank" rel="noreferrer">Open directions</a></div></div>
    <ul className="driver-items">{order.items.map((item, index) => <li key={index}><strong>{item.quantity} × {item.name}</strong><small>{item.customization}</small></li>)}</ul>
    {waitingForReady ? <p className="driver-complete"><strong>Waiting for the bar.</strong><br />Refresh when staff confirm the order is ready.</p> : step?.action === "delivered" ? <form className="delivery-proof" onSubmit={advance}><label>Received by<input name="recipientName" required minLength={2} maxLength={80} placeholder="Recipient name" /></label><label>Handover note <span>Optional</span><textarea name="note" maxLength={180} placeholder="e.g. Handed over at reception" /></label><button className="driver-action" disabled={busy}>{busy ? "Saving…" : step.label}</button></form> : step ? <button className="driver-action" disabled={busy} onClick={() => void advance()}>{busy ? "Updating…" : step.label}</button> : <p className="driver-complete"><strong>Handover complete.</strong><br />Delivered to {handover.recipientName}.</p>}
    {error && <p className="driver-error" role="alert">{error}</p>}<button className="driver-refresh" onClick={() => void load()}>Refresh order</button>
  </section></main>;
}
