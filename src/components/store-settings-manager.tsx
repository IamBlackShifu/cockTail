"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoreSettings } from "@/lib/orders";

const defaults: StoreSettings = { acceptingOrders: true, deliveryEnabled: true, pickupEnabled: true, notice: "", whatsappNumber: "", updatedAt: "" };

export function StoreSettingsManager() {
  const [settings, setSettings] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/ops/store", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSettings(result.settings);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Store controls could not be loaded."); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const save = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/ops/store", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSettings(result.settings); setNotice("Customer ordering settings updated immediately.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Store settings could not be saved."); }
    finally { setBusy(false); }
  };
  return <section className="store-settings-manager">
    <header className="catalog-header"><div><p className="ops-kicker">Store operations</p><h1>Open, paused,<br />or in between.</h1><p>Control whether customers can order and which fulfilment methods are available.</p></div></header>
    {error && <p className="ops-error">{error}</p>}{notice && <p className="ops-notice">{notice}</p>}
    <div className="store-control-grid">
      <label className={settings.acceptingOrders ? "store-control active" : "store-control paused"}><input type="checkbox" checked={settings.acceptingOrders} onChange={event => setSettings(current => ({ ...current, acceptingOrders: event.target.checked }))} /><span><strong>{settings.acceptingOrders ? "Accepting orders" : "Ordering paused"}</strong>Master control for new customer checkouts.</span></label>
      <label className="store-control"><input type="checkbox" checked={settings.deliveryEnabled} onChange={event => setSettings(current => ({ ...current, deliveryEnabled: event.target.checked }))} /><span><strong>Delivery</strong>Allow customers to request delivery.</span></label>
      <label className="store-control"><input type="checkbox" checked={settings.pickupEnabled} onChange={event => setSettings(current => ({ ...current, pickupEnabled: event.target.checked }))} /><span><strong>Pickup</strong>Allow customers to collect their order.</span></label>
    </div>
    <label className="store-notice">Customer notice<textarea rows={3} maxLength={180} value={settings.notice} onChange={event => setSettings(current => ({ ...current, notice: event.target.value }))} placeholder="e.g. Fully booked until 7 PM. Orders reopen shortly." /><small>{settings.notice.length}/180</small></label>
    <label className="store-notice">Business WhatsApp number<input inputMode="tel" value={settings.whatsappNumber} onChange={event => setSettings(current => ({ ...current, whatsappNumber: event.target.value }))} placeholder="263771234567" /><small>International format, without +. Leave blank to hide customer contact.</small></label>
    <button className="ops-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save store settings"}</button>
  </section>;
}
