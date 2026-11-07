"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { money } from "@/lib/orders";
import { productTones, type ManagedProduct } from "@/lib/catalog";

type ProductDraft = { name: string; note: string; price: string; category: string; image: string; strength: string; tone: string; featured: boolean };
const emptyDraft: ProductDraft = { name: "", note: "", price: "", category: "Signature", image: "", strength: "Medium", tone: "sunset", featured: false };

export function ProductManager() {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [draggedProduct, setDraggedProduct] = useState<number | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editing, setEditing] = useState<ManagedProduct | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [changingId, setChangingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ops/products", { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load products.");
      setProducts(result.products); setCategories(result.categories || []); setOrderDirty(false); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load products."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const visible = useMemo(() => products.filter(product => (showInactive || product.active) && `${product.name} ${product.category} ${product.note}`.toLowerCase().includes(query.toLowerCase())), [products, query, showInactive]);
  function edit(product: ManagedProduct) {
    setEditing(product);
    setDraft({ name: product.name, note: product.note, price: (product.priceCents / 100).toFixed(2), category: product.category, image: product.image, strength: product.strength, tone: product.tone, featured: product.featured });
    setError(""); setNotice("");
    setTimeout(() => document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  function reset() { setEditing(null); setDraft(emptyDraft); setError(""); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const numericPrice = Number(draft.price);
    if (!Number.isFinite(numericPrice) || !/^\d+(\.\d{1,2})?$/.test(draft.price.trim())) {
      setError("Enter a price with no more than two decimal places."); setBusy(false); return;
    }
    const body = { ...draft, priceCents: Math.round(numericPrice * 100), ...(editing ? { version: editing.version } : {}) };
    try {
      const response = await fetch(editing ? `/api/ops/products/${editing.id}` : "/api/ops/products", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the product.");
      setProducts(current => editing ? current.map(product => product.id === result.product.id ? result.product : product) : [...current, result.product].sort((a, b) => a.name.localeCompare(b.name)));
      setNotice(editing ? `${result.product.name} updated on the live menu.` : `${result.product.name} added to the live menu.`);
      setEditing(null); setDraft(emptyDraft);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save the product."); }
    finally { setBusy(false); }
  }
  async function changeAvailability(product: ManagedProduct, active: boolean) {
    if (!active && !window.confirm(`Remove ${product.name} from the customer menu? Existing orders will keep their original details.`)) return;
    setBusy(true); setChangingId(product.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/ops/products/${product.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: product.version, active }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not change product availability.");
      setProducts(current => current.map(entry => entry.id === product.id ? result.product : entry));
      setNotice(active ? `${product.name} restored to the live menu.` : `${product.name} removed from the live menu.`);
      if (editing?.id === product.id) reset();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not change product availability."); }
    finally { setBusy(false); setChangingId(null); }
  }
  async function changeStock(product: ManagedProduct, available: boolean) {
    setBusy(true); setChangingId(product.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/ops/products/${product.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: product.version, available }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update product availability.");
      setProducts(current => current.map(entry => entry.id === product.id ? result.product : entry));
      setNotice(available ? `${product.name} is available again.` : `${product.name} is now sold out.`);
      if (editing?.id === product.id) setEditing(result.product);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update product availability."); }
    finally { setBusy(false); setChangingId(null); }
  }
  function dropProduct(targetId: number) {
    if (draggedProduct === null || draggedProduct === targetId || query) return;
    setProducts(current => {
      const active = current.filter(product => product.active);
      const removed = current.filter(product => !product.active);
      const source = active.findIndex(product => product.id === draggedProduct);
      const target = active.findIndex(product => product.id === targetId);
      if (source < 0 || target < 0) return current;
      const next = [...active]; const [moved] = next.splice(source, 1); next.splice(target, 0, moved);
      return [...next, ...removed];
    });
    setOrderDirty(true); setDraggedProduct(null);
  }
  function dropCategory(target: string) {
    if (!draggedCategory || draggedCategory === target) return;
    setCategories(current => { const next = [...current]; const source = next.indexOf(draggedCategory); const destination = next.indexOf(target); if (source < 0 || destination < 0) return current; const [moved] = next.splice(source, 1); next.splice(destination, 0, moved); return next; });
    setOrderDirty(true); setDraggedCategory(null);
  }
  async function saveOrder() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/ops/products", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: products.filter(product => product.active).map(product => product.id), categories }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the customer menu order.");
      setProducts(result.products); setCategories(result.categories); setOrderDirty(false); setNotice("Customer menu order updated.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save the customer menu order."); }
    finally { setBusy(false); }
  }

  return <section className="catalog-manager">
    <header className="catalog-header"><div><p className="ops-kicker">Live menu controls</p><h1>Products &amp;<br />pricing.</h1><p>Add drinks, change prices, update details, or hide products without deploying the app.</p></div><button className="ops-primary" onClick={() => { reset(); document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth" }); }}>+ Add product</button></header>
    {error && <p className="ops-error" role="alert">{error}</p>}{notice && <p className="ops-notice" role="status">{notice}</p>}
    <section className="merchandising-panel"><div><p className="ops-kicker">Customer menu order</p><h2>Arrange the storefront</h2><p>Drag categories and live products into position. Featured products are promoted ahead of standard products.</p></div><div className="category-order" aria-label="Menu section arrangement">{categories.map(name => <button type="button" draggable onDragStart={() => setDraggedCategory(name)} onDragOver={event => event.preventDefault()} onDrop={() => dropCategory(name)} key={name}><span aria-hidden="true">⋮⋮</span>{name}</button>)}</div><button className="ops-primary" disabled={!orderDirty || busy} onClick={() => void saveOrder()}>{busy && orderDirty ? "Saving order…" : "Save menu order"}</button></section>
    <div className="catalog-layout">
      <section className="catalog-list-panel"><div className="catalog-tools"><input aria-label="Search products" placeholder="Search products or categories" value={query} onChange={event => setQuery(event.target.value)} /><label><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} /> Show removed</label><button className="outline-ops-button" disabled={loading} onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh"}</button></div>
        <p className="page-context">{products.filter(product => product.active).length} live · {products.filter(product => !product.active).length} removed</p>
        {loading ? <p className="queue-empty">Loading products…</p> : <div className="managed-products">{visible.map(product => <article className={product.active ? "managed-product" : "managed-product inactive"} draggable={product.active && !query} onDragStart={() => setDraggedProduct(product.id)} onDragOver={event => { if (product.active && !query) event.preventDefault(); }} onDrop={() => dropProduct(product.id)} key={product.id}>
          <div className={`managed-product-image ${product.tone}`} style={{ backgroundImage: `url(${product.image})` }} />
          <div><span className="catalog-state">{product.active ? product.available ? "Available" : "Sold out" : "Removed"}</span>{product.featured && <span className="catalog-featured">Featured</span>}<h3>{product.name}</h3><p>{product.note}</p><small>{product.category} · {product.strength}</small></div>
          <strong>{money(product.priceCents)}</strong>
          <div className="managed-actions"><button disabled={busy} onClick={() => edit(product)}>Edit</button>{product.active && <button disabled={busy} onClick={() => changeStock(product, !product.available)}>{changingId === product.id ? "Updating…" : product.available ? "Mark sold out" : "Mark available"}</button>}{product.active ? <button className="remove-product" disabled={busy} onClick={() => changeAvailability(product, false)}>{changingId === product.id ? "Removing…" : "Remove"}</button> : <button disabled={busy} onClick={() => changeAvailability(product, true)}>{changingId === product.id ? "Restoring…" : "Restore"}</button>}</div>
        </article>)}</div>}
        {!loading && !visible.length && <div className="queue-empty"><h3>No matching products</h3><p>Try another search or include removed products.</p></div>}
      </section>
      <form className="product-editor" id="product-editor" onSubmit={save}>
        <div><p className="ops-kicker">{editing ? "Editing live product" : "New menu item"}</p><h2>{editing ? editing.name : "Add a product"}</h2></div>
        <label>Product name<input required minLength={2} maxLength={80} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
        <label>Description<textarea required minLength={2} maxLength={180} rows={3} value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} /></label>
        <div className="product-editor-grid"><label>Price (USD)<input required inputMode="decimal" placeholder="13.00" value={draft.price} onChange={event => setDraft(current => ({ ...current, price: event.target.value }))} /></label><label>Category<input required minLength={2} maxLength={40} placeholder="Signature" value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))} /></label></div>
        <div className="product-editor-grid"><label>Strength label<input required minLength={2} maxLength={30} placeholder="Medium" value={draft.strength} onChange={event => setDraft(current => ({ ...current, strength: event.target.value }))} /></label><label>Colour tone<select value={draft.tone} onChange={event => setDraft(current => ({ ...current, tone: event.target.value }))}>{productTones.map(tone => <option key={tone} value={tone}>{tone}</option>)}</select></label></div>
        <label className="featured-control"><input type="checkbox" checked={draft.featured} onChange={event => setDraft(current => ({ ...current, featured: event.target.checked }))} /><span><strong>Feature this product</strong>Promote it ahead of standard products on the customer menu.</span></label>
        <label>Image URL<input type="url" required maxLength={500} placeholder="https://…" value={draft.image} onChange={event => setDraft(current => ({ ...current, image: event.target.value }))} /></label>
        {draft.image && <div className={`product-preview ${draft.tone}`} style={{ backgroundImage: `url(${draft.image})` }}><span>Preview</span></div>}
        <div className="editor-actions"><button className="ops-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add to menu"}</button>{editing && <button type="button" className="outline-ops-button" onClick={reset}>Cancel</button>}</div>
        <p className="form-footnote">Changes take effect immediately. Customers who already added an item must refresh their bag if it becomes unavailable.</p>
      </form>
    </div>
  </section>;
}
