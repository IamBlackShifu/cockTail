import { randomUUID } from "node:crypto";
import { db, transaction } from "./database";
import { hash } from "./http";
import { nextStatus, OrderError, statuses, statusLabels, totals, validateOrder, type Order, type OrderStatus } from "../orders";
import { activeCocktails } from "./product-store";
import { activeBuilderOptions } from "./ingredient-store";
import { requireFulfillmentAvailable } from "./store-settings";

type Row = { data: string; request_hash: string; token_hash: string };
export function createOrder(value: unknown, key: string, token: string) {
  if (!/^[a-f0-9-]{36}$/.test(key) || !/^[a-f0-9]{64}$/.test(token)) throw new OrderError("Please refresh checkout before submitting.");
  requireFulfillmentAvailable(value && typeof value === "object" ? (value as { fulfillment?: unknown }).fulfillment : undefined);
  const validated = validateOrder(value, activeCocktails(), activeBuilderOptions());
  const rawItems = (value as { items?: unknown[] }).items || [];
  const rawPromoCode = (value as { promoCode?: unknown }).promoCode;
  const promoCode = typeof rawPromoCode === "string" ? rawPromoCode.trim().toUpperCase() : "";
  if (promoCode && !/^MIX-[A-F0-9]{8}$/.test(promoCode)) throw new OrderError("That reward code is invalid.");
  const creationInputs = rawItems.map(raw => {
    if (!raw || typeof raw !== "object" || (raw as { cocktailId?: unknown }).cocktailId !== -1) return null;
    const { creationName, creatorKey, creationId, sourceCreationId, choices } = raw as { creationName?: unknown; creatorKey?: unknown; creationId?: unknown; sourceCreationId?: unknown; choices?: unknown };
    if (typeof creationName !== "string" || creationName.trim().length < 2 || creationName.trim().length > 60 || typeof creatorKey !== "string" || !/^[a-f0-9]{64}$/.test(creatorKey) || !choices || typeof choices !== "object" || Array.isArray(choices)) throw new OrderError("Name your custom creation before ordering.");
    if (creationId !== undefined && (typeof creationId !== "string" || !/^[a-f0-9-]{36}$/.test(creationId))) throw new OrderError("That saved creation is invalid.");
    if (sourceCreationId !== undefined && (typeof sourceCreationId !== "string" || !/^[a-f0-9-]{36}$/.test(sourceCreationId))) throw new OrderError("That shared creation is invalid.");
    if (creationId && sourceCreationId) throw new OrderError("That creation source is invalid.");
    return { name: creationName.trim(), creatorKey, creationId, sourceCreationId, choices };
  });
  creationInputs.forEach((creation, index) => {
    if (!creation?.sourceCreationId) return;
    const source = db().prepare("SELECT name, choices, unit_cents FROM creations WHERE id = ? AND (share_slug IS NOT NULL OR moderation_status = 'published')").get(creation.sourceCreationId) as { name: string; choices: string; unit_cents: number } | undefined;
    if (!source) throw new OrderError("That shared creation is no longer available.");
    if (source.name !== creation.name || source.choices !== JSON.stringify(creation.choices)) throw new OrderError("That shared recipe has changed. Open it again.");
    validated.items[index].name = source.name;
    validated.items[index].unitCents = Number(source.unit_cents);
  });
  const subtotalCents = validated.items.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
  const reward = promoCode ? db().prepare("SELECT percent_off FROM reward_codes WHERE code = ? AND active = 1 AND uses < max_uses AND expires_at > ?").get(promoCode, new Date().toISOString()) : undefined;
  if (promoCode && !reward) throw new OrderError("That reward code is expired or has reached its use limit.");
  const discountCents = reward ? Math.round(subtotalCents * Number(reward.percent_off) / 100) : 0;
  Object.assign(validated, totals(subtotalCents, validated.fulfillment, discountCents));
  const requestHash = hash(JSON.stringify({ validated, creationInputs }));
  return transaction(() => {
    const previous = db().prepare("SELECT data, request_hash, token_hash FROM orders WHERE request_key = ?").get(key) as Row | undefined;
    if (previous) {
      if (previous.request_hash !== requestHash || previous.token_hash !== hash(token)) throw new OrderError("This checkout was already submitted with different details. Refresh and try again.", 409);
      return { order: JSON.parse(previous.data) as Order, created: false };
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const order: Order = { ...validated, id, number: `TG-${id.replaceAll("-", "").slice(0, 10).toUpperCase()}`, createdAt: now, updatedAt: now, version: 1, status: "new", payment: "unpaid", history: [{ at: now, label: "Order received" }] };
    db().prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, key, requestHash, hash(token), now, 1, JSON.stringify(order));
    if (promoCode) {
      const redeemed = db().prepare("UPDATE reward_codes SET uses = uses + 1 WHERE code = ? AND active = 1 AND uses < max_uses AND expires_at > ?").run(promoCode, now);
      if (!redeemed.changes) throw new OrderError("That reward code is no longer available.", 409);
    }
    creationInputs.forEach((creation, index) => {
      if (!creation) return;
      if (creation.creationId) {
        const updated = db().prepare("UPDATE creations SET order_count = order_count + 1 WHERE id = ? AND owner_hash = ?").run(creation.creationId, hash(creation.creatorKey));
        if (!updated.changes) throw new OrderError("That saved creation is no longer available.");
        return;
      }
      if (creation.sourceCreationId) {
        const source = db().prepare("SELECT owner_hash, name, choices FROM creations WHERE id = ? AND (share_slug IS NOT NULL OR moderation_status = 'published')").get(creation.sourceCreationId) as { owner_hash: string; name: string; choices: string } | undefined;
        if (!source) throw new OrderError("That shared creation is no longer available.");
        if (source.name !== creation.name || source.choices !== JSON.stringify(creation.choices)) throw new OrderError("That shared recipe has changed. Open its link again.");
        db().prepare("UPDATE creations SET order_count = order_count + 1 WHERE id = ?").run(creation.sourceCreationId);
        db().prepare("INSERT INTO creation_order_events (creation_id, quantity, created_at) VALUES (?, ?, ?)").run(creation.sourceCreationId, validated.items[index].quantity, now);
        if (source.owner_hash === hash(creation.creatorKey)) return;
      }
      db().prepare("INSERT INTO creations (id, owner_hash, name, choices, unit_cents, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), hash(creation.creatorKey), creation.name, JSON.stringify(creation.choices), validated.items[index].unitCents, id, now);
    });
    return { order, created: true };
  });
}
export function customerOrder(id: string, token: string) {
  const row = db().prepare("SELECT data FROM orders WHERE id = ? AND token_hash = ?").get(id, hash(token));
  if (!row) throw new OrderError("Order not found. Use the browser where you placed it.", 404);
  return JSON.parse(String(row.data)) as Order;
}
export function listOrders(page: number, view = "all") {
  const limit = 50;
  if (!["all", "active", ...statuses].includes(view)) throw new OrderError("Invalid order view.");
  const rows = db().prepare(`SELECT data FROM orders
    WHERE ? = 'all' OR (? = 'active' AND json_extract(data, '$.status') NOT IN ('completed', 'cancelled')) OR json_extract(data, '$.status') = ?
    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).all(view, view, view, limit + 1, page * limit);
  const counts = db().prepare("SELECT json_extract(data, '$.status') AS status, COUNT(*) AS count FROM orders GROUP BY status").all();
  const unpaid = db().prepare("SELECT COALESCE(SUM(json_extract(data, '$.totalCents')), 0) AS amount FROM orders WHERE json_extract(data, '$.payment') = 'unpaid' AND json_extract(data, '$.status') != 'cancelled'").get();
  const summary = { counts: Object.fromEntries(counts.map(row => [String(row.status), Number(row.count)])), unpaidCents: Number(unpaid?.amount || 0) };
  return { orders: rows.slice(0, limit).map((row) => JSON.parse(String(row.data)) as Order), hasMore: rows.length > limit, summary };
}
export function updateOrder(id: string, value: unknown) {
  if (!value || typeof value !== "object") throw new OrderError("Invalid update.");
  const { version, action } = value as { version: unknown; action: unknown };
  return transaction(() => {
    const row = db().prepare("SELECT data FROM orders WHERE id = ?").get(id);
    if (!row) throw new OrderError("Order not found.", 404);
    const order = JSON.parse(String(row.data)) as Order;
    if (order.version !== version) throw new OrderError("Another staff member updated this order. Refresh and try again.", 409);
    let label: string;
    if (action === "customer-update") {
      const raw = value as { message?: unknown; etaMinutes?: unknown };
      if (typeof raw.message !== "string" || raw.message.trim().length < 2 || raw.message.trim().length > 180) throw new OrderError("Customer update must be between 2 and 180 characters.");
      if (raw.etaMinutes !== undefined && (!Number.isInteger(raw.etaMinutes) || Number(raw.etaMinutes) < 1 || Number(raw.etaMinutes) > 240)) throw new OrderError("ETA must be between 1 and 240 minutes.");
      const at = new Date();
      const update = { at: at.toISOString(), message: raw.message.trim(), ...(raw.etaMinutes === undefined ? {} : { estimatedAt: new Date(at.getTime() + Number(raw.etaMinutes) * 60000).toISOString() }) };
      order.customerUpdates = [...(order.customerUpdates || []), update];
      label = `Team update: ${update.message}`;
    } else if (action === "mark-paid") {
      if (order.payment === "paid" || order.status === "cancelled") throw new OrderError("This order cannot be marked paid.", 409);
      order.payment = "paid";
      label = "Payment collected";
    } else {
      const canCancel = action === "cancelled" && ["new", "preparing", "ready"].includes(order.status);
      if (!canCancel && action !== nextStatus(order)) throw new OrderError("That status change is not available.", 409);
      if (typeof action !== "string") throw new OrderError("Invalid status.");
      order.status = action as OrderStatus;
      label = statusLabels[order.status];
    }
    order.version += 1;
    order.updatedAt = new Date().toISOString();
    order.history.push({ at: order.updatedAt, label });
    db().prepare("UPDATE orders SET version = ?, data = ? WHERE id = ?").run(order.version, JSON.stringify(order), id);
    return order;
  });
}
