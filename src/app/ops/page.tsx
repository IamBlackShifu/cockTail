"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { money, nextStatus, statuses, statusLabels, type Order } from "@/lib/orders";
import { ProductManager } from "@/components/product-manager";
import { CommunityManager } from "@/components/community-manager";
import { IngredientManager } from "@/components/ingredient-manager";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { StoreSettingsManager } from "@/components/store-settings-manager";
import "./ops.css";
import "./orders.css";

const actionLabels = { preparing: "Start preparing", ready: "Mark ready", dispatched: "Send for delivery", completed: "Complete order" };
function whatsappNumber(phone: string) { const digits = phone.replace(/\D/g, ""); return digits.startsWith("0") ? `263${digits.slice(1)}` : digits; }
export default function OperationsPage() {
  const [auth, setAuth] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [section, setSection] = useState<"orders" | "products" | "ingredients" | "community" | "analytics" | "store">("orders");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [summary, setSummary] = useState<{ counts: Record<string, number>; unpaidCents: number }>({ counts: {}, unpaidCents: 0 });
  const [queue, setQueue] = useState("Active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState("");
  const [online, setOnline] = useState(false);
  const requestId = useRef(0);
  const selected = orders.find((order) => order.id === selectedId);
  const load = useCallback(async () => {
    const sequence = ++requestId.current;
    try {
      const response = await fetch(`/api/ops/orders?page=${page}&view=${queue.toLowerCase()}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (sequence !== requestId.current) return;
      if (response.status === 401 || response.status === 503) {
        setAuth("signed-out"); setOrders([]); setOnline(false);
        if (response.status === 503) setError("Staff access has not been configured on the server yet.");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Unable to load orders.");
      setOrders(current => (result.orders as Order[]).map(incoming => {
        const existing = current.find(order => order.id === incoming.id);
        return existing && existing.version > incoming.version ? existing : incoming;
      }));
      setHasMore(result.hasMore); setSummary(result.summary); setAuth("signed-in"); setOnline(true);
      setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      if (sequence !== requestId.current) return;
      setOnline(false); setError("Could not refresh orders. Check your connection and try again.");
      setAuth(current => current === "checking" ? "signed-out" : current);
    }
  }, [page, queue]);
  useEffect(() => {
    const initial = setTimeout(() => { void load(); }, 0);
    const counter = requestId;
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 5000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => { ++counter.current; clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/ops/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPassword(""); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/ops/session", { method: "DELETE", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Sign-out failed. Please try again.");
      ++requestId.current; setAuth("signed-out"); setOrders([]); setSelectedId(null); setError(""); setOnline(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Sign-out failed."); }
    finally { setBusy(false); }
  }
  async function update(order: Order, action: string) {
    if (action === "cancelled" && !window.confirm(`Cancel ${order.number}? ${order.payment === "paid" ? "Payment was collected; arrange any refund separately." : "The customer will see this cancellation."}`)) return;
    if (action === "mark-paid" && !window.confirm(`Confirm ${money(order.totalCents)} has actually been collected for ${order.number}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/ops/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, version: order.version }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Update failed.");
      ++requestId.current;
      setOrders(current => current.map(entry => entry.id === order.id ? result.order : entry));
      setNotice(`${order.number} updated.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The update could not be confirmed. Refresh before trying again.");
      await load();
    } finally { setBusy(false); }
  }
  async function sendCustomerUpdate(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get("message") || "").trim();
    const eta = String(form.get("eta") || "").trim();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/ops/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "customer-update", version: order.version, message, ...(eta ? { etaMinutes: Number(eta) } : {}) }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Customer update failed.");
      ++requestId.current; setOrders(current => current.map(entry => entry.id === order.id ? result.order : entry));
      event.currentTarget.reset(); setNotice(`${order.number} customer update published.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The customer update could not be saved."); await load(); }
    finally { setBusy(false); }
  }
  const visible = useMemo(() => orders.filter(order => {
    const inQueue = queue === "All" || (queue === "Active" ? !["completed", "cancelled"].includes(order.status) : order.status === queue);
    return inQueue && `${order.number} ${order.customer.name} ${order.customer.phone}`.toLowerCase().includes(search.toLowerCase());
  }), [orders, queue, search]);
  if (auth !== "signed-in") return <main className="ops-login-shell"><form className="ops-login" onSubmit={signIn}>
    <Link className="ops-brand ops-logo" href="/"><Image src="/tipsygo-logo-v2.png" alt="TIPSYGO" width={2048} height={768} priority /></Link><p className="ops-kicker">Staff access</p><h1>The next round<br />starts here.</h1><p>Sign in to see customer orders and keep the kitchen moving.</p>
    <label htmlFor="staff-password">Staff password</label><input id="staff-password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={event => setPassword(event.target.value)} />
    {error && <p className="ops-error" role="alert">{error}</p>}<button className="ops-primary" disabled={busy || auth === "checking"}>{busy ? "Signing in…" : auth === "checking" ? "Checking session…" : "Open operations →"}</button>
    <Link href="/">Back to the store</Link>
  </form></main>;
  return <main className="ops-shell real-ops">
    <aside className="ops-sidebar"><Link className="ops-brand ops-logo" href="/"><Image src="/tipsygo-logo-v2.png" alt="TIPSYGO" width={2048} height={768} priority /></Link><div className="location-chip">Order management</div>
      <nav className="ops-nav" aria-label="Operations views"><button className={section === "orders" && queue === "Active" ? "active" : ""} onClick={() => { setSection("orders"); setQueue("Active"); setPage(0); }}>Orders in motion</button><button className={section === "orders" && queue === "All" ? "active" : ""} onClick={() => { setSection("orders"); setQueue("All"); setPage(0); }}>Order history</button><button className={section === "store" ? "active" : ""} onClick={() => setSection("store")}>Store controls</button><button className={section === "analytics" ? "active" : ""} onClick={() => setSection("analytics")}>Analytics</button><button className={section === "products" ? "active" : ""} onClick={() => setSection("products")}>Products &amp; prices</button><button className={section === "ingredients" ? "active" : ""} onClick={() => setSection("ingredients")}>Ingredients</button><button className={section === "community" ? "active" : ""} onClick={() => setSection("community")}>Community mixes</button></nav>
      <div className="sidebar-footer"><span>Staff session</span><button onClick={signOut} disabled={busy}>Sign out</button></div>
    </aside>
    <section className="ops-content">{section === "store" ? <StoreSettingsManager /> : section === "analytics" ? <AnalyticsDashboard /> : section === "products" ? <ProductManager /> : section === "ingredients" ? <IngredientManager /> : section === "community" ? <CommunityManager /> : <><header className="ops-header"><div><p className="ops-kicker">The kitchen queue</p><h1>Every order.<br />One place.</h1></div><div className="ops-header-actions"><span className={online ? "sync-state" : "sync-state stale"}>{online ? `Updated ${updated}` : "Updates interrupted"}</span><button className="outline-ops-button" onClick={() => { setError(""); void load(); }}>Refresh</button></div></header>
      <div className="metric-grid"><article><p>Received</p><strong>{summary.counts.new || 0}</strong><small>Waiting for the team</small></article><article><p>Preparing</p><strong>{summary.counts.preparing || 0}</strong><small>At the bar</small></article><article><p>Ready / on the way</p><strong>{(summary.counts.ready || 0) + (summary.counts.dispatched || 0)}</strong><small>Handover and delivery</small></article><article className="accent-metric"><p>Awaiting payment</p><strong>{money(summary.unpaidCents)}</strong><small>Across all saved orders</small></article></div>
      {error && <p className="ops-error" role="alert">{error}</p>}{notice && <p className="ops-notice" role="status">{notice}</p>}
      <section className="queue-panel"><div className="panel-heading"><div><p className="ops-kicker">Customer orders</p><h2>Orders in motion</h2></div><input className="order-search" aria-label="Search orders on this page" placeholder="Order, customer or phone" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="queue-tabs">{["Active", "All", ...statuses].map(status => <button key={status} className={queue === status ? "active" : ""} onClick={() => { setQueue(status); setPage(0); }}>{status in statusLabels ? statusLabels[status as keyof typeof statusLabels] : status}</button>)}</div>
        <p className="page-context">Page {page + 1} · {orders.length} orders in this view. Search applies to this page.</p>
        <div className="live-order-list">{visible.map(order => <button key={order.id} className="live-order-row" onClick={() => setSelectedId(order.id)}>
          <div><span className={`order-status-pill ${order.status}`}>{statusLabels[order.status]}</span><strong>{order.number}</strong><small>{new Date(order.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></div>
          <div><strong>{order.customer.name}</strong><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} drinks · {order.fulfillment}</span><small>{order.items.map(item => `${item.quantity} × ${item.name}`).join(", ")}</small></div>
          <div className="order-row-total"><strong>{money(order.totalCents)}</strong><span>{order.payment === "paid" ? "Collected" : "Payment due"}</span><small>View order →</small></div>
        </button>)}</div>
        {!visible.length && <div className="queue-empty"><h3>{orders.length ? "No matching orders" : "Ready for the first round"}</h3><p>{orders.length ? "Try another status or search on this page." : "Customer orders will appear here automatically."}</p></div>}
        <div className="order-pagination"><button className="outline-ops-button" disabled={page === 0} onClick={() => { setSelectedId(null); setPage(current => current - 1); }}>← Newer</button><span>Page {page + 1}</span><button className="outline-ops-button" disabled={!hasMore} onClick={() => { setSelectedId(null); setPage(current => current + 1); }}>Older →</button></div>
      </section>
    </>}</section>
    {selected && <div className="order-detail-backdrop" role="dialog" aria-modal="true" aria-labelledby="order-detail-title"><section className="live-order-detail">
      <button className="detail-close" aria-label="Close order details" onClick={() => setSelectedId(null)}>×</button><p className="ops-kicker">{selected.fulfillment} · {statusLabels[selected.status]}</p><h2 id="order-detail-title">{selected.number}</h2>
      <p className="detail-time">Placed {new Date(selected.createdAt).toLocaleString()}</p>
      <div className="detail-customer"><h3>{selected.customer.name}</h3><div className="customer-contact-actions"><a href={`tel:${selected.customer.phone.replace(/[^+\d]/g, "")}`}>Call {selected.customer.phone}</a><a href={`https://wa.me/${whatsappNumber(selected.customer.phone)}?text=${encodeURIComponent(`Hi ${selected.customer.name}, this is TipsyGo about your order ${selected.number}.`)}`} target="_blank" rel="noreferrer">Open WhatsApp</a></div>{selected.fulfillment === "Delivery" && <p>{selected.address}</p>}{selected.instructions && <p className="detail-notes"><strong>Customer notes</strong>{selected.instructions}</p>}</div>
      <ul className="detail-items">{selected.items.map((item, index) => <li key={index}><div><strong>{item.quantity} × {item.name}</strong><p>{item.customization}</p></div><b>{money(item.unitCents * item.quantity)}</b></li>)}</ul>
      <dl className="detail-totals"><div><dt>Drinks</dt><dd>{money(selected.subtotalCents)}</dd></div><div><dt>{selected.fulfillment}</dt><dd>{money(selected.deliveryCents)}</dd></div><div><dt>Service fee</dt><dd>{money(selected.serviceCents)}</dd></div><div><dt>Total</dt><dd>{money(selected.totalCents)}</dd></div></dl>
      <div className="detail-payment"><strong>{selected.payment === "paid" ? "Payment collected" : `Payment due on ${selected.fulfillment.toLowerCase()}`}</strong>{selected.payment === "unpaid" && selected.status !== "cancelled" && <button className="outline-ops-button" disabled={busy} onClick={() => update(selected, "mark-paid")}>Mark payment collected</button>}</div>
      <form className="customer-update-form" onSubmit={event => void sendCustomerUpdate(event, selected)}><div><p className="ops-kicker">Customer communication</p><h3>Publish a tracking update</h3></div><label>Message<textarea name="message" required minLength={2} maxLength={180} placeholder="e.g. Your drinks are packed; the driver leaves in 5 minutes." /></label><label>ETA in minutes <span>Optional</span><input name="eta" type="number" min={1} max={240} placeholder="30" /></label><button className="ops-primary" disabled={busy}>{busy ? "Publishing…" : "Publish update"}</button></form>
      {selected.customerUpdates?.length ? <div className="customer-update-log"><h3>Customer updates</h3>{selected.customerUpdates.toReversed().map((entry, index) => <article key={`${entry.at}-${index}`}><strong>{entry.message}</strong><small>{new Date(entry.at).toLocaleString()}{entry.estimatedAt ? ` · ETA ${new Date(entry.estimatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</small></article>)}</div> : null}
      <div className="detail-actions">{nextStatus(selected) && <button className="ops-primary" disabled={busy} onClick={() => update(selected, nextStatus(selected)!)}>{busy ? "Updating…" : actionLabels[nextStatus(selected) as keyof typeof actionLabels]}</button>}{["new", "preparing", "ready"].includes(selected.status) && <button className="cancel-order" disabled={busy} onClick={() => update(selected, "cancelled")}>Cancel order</button>}</div>
      {error && <p className="ops-error" role="alert">{error}</p>}
      <h3 className="history-heading">Order history</h3><ol className="detail-history">{selected.history.map((entry, index) => <li key={index}><span>{entry.label}</span><time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
    </section></div>}
  </main>;
}
