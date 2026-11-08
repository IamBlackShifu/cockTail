import { OrderError, type Order } from "../orders";
import { db } from "./database";

type Ranked = { name: string; value: number; secondary?: number };
export type Analytics = { period: number; summary: { orders: number; drinks: number; revenueCents: number; discountsCents: number; averageCents: number; cancelled: number }; daily: { label: string; orders: number; revenueCents: number }[]; products: Ranked[]; mixes: Ranked[]; creators: Ranked[]; ingredients: Ranked[]; rewards: { issued: number; redemptions: number } };
export function analytics(periodValue: string): Analytics {
  const period = Number(periodValue);
  if (![7, 30, 0].includes(period)) throw new OrderError("Invalid analytics period.");
  const since = period ? new Date(Date.now() - period * 86400000).toISOString() : "0000-01-01T00:00:00.000Z";
  const rows = db().prepare("SELECT data FROM orders WHERE created_at >= ? ORDER BY created_at").all(since);
  const orders = rows.map(row => JSON.parse(String(row.data)) as Order);
  const completed = orders.filter(order => order.status !== "cancelled");
  const productMap = new Map<string, { quantity: number; cents: number }>(), dailyMap = new Map<string, { orders: number; revenueCents: number }>();
  completed.forEach(order => {
    const key = order.createdAt.slice(0, 10), day = dailyMap.get(key) || { orders: 0, revenueCents: 0 }; day.orders += 1; day.revenueCents += order.totalCents; dailyMap.set(key, day);
    order.items.forEach(item => { const current = productMap.get(item.name) || { quantity: 0, cents: 0 }; current.quantity += item.quantity; current.cents += item.unitCents * item.quantity; productMap.set(item.name, current); });
  });
  const eventRows = db().prepare(`SELECT e.quantity, c.name, c.choices, COALESCE(p.display_name, 'Anonymous creator') AS creator FROM creation_order_events e JOIN creations c ON c.id = e.creation_id LEFT JOIN creator_profiles p ON p.owner_hash = c.owner_hash WHERE e.created_at >= ?`).all(since);
  const mixMap = new Map<string, number>(), creatorMap = new Map<string, number>(), ingredientMap = new Map<string, number>();
  eventRows.forEach(row => { const quantity = Number(row.quantity); mixMap.set(String(row.name), (mixMap.get(String(row.name)) || 0) + quantity); creatorMap.set(String(row.creator), (creatorMap.get(String(row.creator)) || 0) + quantity); Object.values(JSON.parse(String(row.choices)) as Record<string, string>).forEach(label => ingredientMap.set(label, (ingredientMap.get(label) || 0) + quantity)); });
  const ranked = (map: Map<string, number>) => [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const reward = db().prepare("SELECT COUNT(*) AS issued, COALESCE(SUM(uses), 0) AS redemptions FROM reward_codes WHERE created_at >= ?").get(since);
  const revenueCents = completed.reduce((sum, order) => sum + order.totalCents, 0), discountsCents = completed.reduce((sum, order) => sum + (order.discountCents || 0), 0);
  return { period, summary: { orders: completed.length, drinks: completed.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.quantity, 0), 0), revenueCents, discountsCents, averageCents: completed.length ? Math.round(revenueCents / completed.length) : 0, cancelled: orders.length - completed.length }, daily: [...dailyMap].map(([label, value]) => ({ label, ...value })).slice(-30), products: [...productMap].map(([name, value]) => ({ name, value: value.quantity, secondary: value.cents })).sort((a, b) => b.value - a.value).slice(0, 8), mixes: ranked(mixMap), creators: ranked(creatorMap), ingredients: ranked(ingredientMap), rewards: { issued: Number(reward?.issued || 0), redemptions: Number(reward?.redemptions || 0) } };
}
