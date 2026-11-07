"use client";

import { useRef, useState, type FormEvent } from "react";
import { money, totals, type Fulfillment, type OrderItemInput } from "@/lib/orders";
import { pendingKey, prepareOrder, receiptKey, sendOrder, type PendingOrder } from "@/lib/client-orders";

export function Checkout({ items, subtotalCents, onClose, onPlaced }: {
  items: OrderItemInput[]; subtotalCents: number; onClose: () => void; onPlaced: () => void;
}) {
  const [fulfillment, setFulfillment] = useState<Fulfillment>("Delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<PendingOrder | null>(null);
  const amount = totals(subtotalCents, fulfillment);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      // Verify receipt storage is available before submitting a real order.
      const priorReceipt = localStorage.getItem(receiptKey);
      localStorage.setItem(receiptKey, priorReceipt || "null");
      if (!attempt.current && sessionStorage.getItem(pendingKey)) {
        throw new Error("An earlier order needs confirmation. Close checkout and use Retry confirmation in your order tracker.");
      }
      attempt.current ??= prepareOrder({ customer: { name, phone }, fulfillment, address, instructions, items });
      await sendOrder(attempt.current);
      onPlaced();
    } catch (failure) {
      const pending = sessionStorage.getItem(pendingKey);
      setUncertain(Boolean(pending && attempt.current));
      if (!pending) attempt.current = null;
      setError(failure instanceof Error ? failure.message : "Unable to send your order. Please try again.");
    } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
    <form className="checkout-modal connected-checkout" onSubmit={submit}>
      <button type="button" className="modal-close" disabled={busy} onClick={onClose} aria-label="Close checkout">×</button>
      <div className="checkout-heading"><p className="eyebrow">One last thing</p><h2 id="checkout-title">Your order.<br /><em>Made yours.</em></h2></div>
      <fieldset disabled={busy || uncertain}>
        <legend className="sr-only">Order details</legend>
        <div className="checkout-section"><p className="checkout-label">How should we get it to you?</p>
          <div className="segmented-control">{(["Delivery", "Pickup"] as const).map((mode) => <button type="button" key={mode} aria-pressed={fulfillment === mode} className={fulfillment === mode ? "selected" : ""} onClick={() => setFulfillment(mode)}>{mode}<span>{mode === "Pickup" || subtotalCents >= 4000 ? "Free" : "$4"}</span></button>)}</div>
        </div>
        <div className="checkout-fields">
          <label>Your name<input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Who is the order for?" /></label>
          <label>Phone number<input type="tel" autoComplete="tel" required minLength={7} maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="A number we can reach you on" /></label>
          {fulfillment === "Delivery" && <label>Delivery address<textarea autoComplete="street-address" required minLength={8} maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, area and city" rows={2} /></label>}
          <label>Order notes <span>Optional</span><textarea maxLength={500} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder={fulfillment === "Delivery" ? "Landmark, gate code or preparation notes" : "Anything the team should know?"} rows={2} /></label>
        </div>
      </fieldset>
      <div className="payment-notice"><strong>Pay on {fulfillment === "Delivery" ? "delivery" : "pickup"}</strong><p>No online charge. The team will confirm your order and arrange handover with you.</p></div>
      <div className="checkout-summary">
        <div><span>{items.length} drink{items.length === 1 ? "" : "s"}</span><span>{money(amount.subtotalCents)}</span></div>
        <div><span>{fulfillment}</span><span>{amount.deliveryCents ? money(amount.deliveryCents) : "Free"}</span></div>
        <div><span>Service fee (5%)</span><span>{money(amount.serviceCents)}</span></div>
        <div className="checkout-total"><strong>Total due</strong><strong>{money(amount.totalCents)}</strong></div>
      </div>
      {error && <p className="flow-error" role="alert">{error}</p>}
      {uncertain && <p className="flow-hint">We haven&apos;t confirmed the result yet. Retry the same order to avoid duplicates.</p>}
      <button className="primary-button place-order" type="submit" disabled={busy || !items.length}>{busy ? "Sending your order…" : uncertain ? "Retry confirmation" : `Place order · ${money(amount.totalCents)}`}</button>
    </form>
  </div>;
}
