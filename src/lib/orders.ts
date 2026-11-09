import { cocktails, customizationGroups, options, type BuilderOptions } from "./catalog";

export type OrderItemInput = { cocktailId: number; quantity: number; choices: Record<string, string>; creationName?: string; creatorKey?: string; creationId?: string; sourceCreationId?: string };
export type OrderItem = { name: string; quantity: number; customization: string; unitCents: number };
export type Fulfillment = "Delivery" | "Pickup";
export const statuses = ["new", "preparing", "ready", "dispatched", "completed", "cancelled"] as const;
export type OrderStatus = (typeof statuses)[number];
export const statusLabels: Record<OrderStatus, string> = {
  new: "Received", preparing: "Preparing", ready: "Ready", dispatched: "On the way", completed: "Completed", cancelled: "Cancelled",
};
export type Totals = { subtotalCents: number; discountCents: number; deliveryCents: number; serviceCents: number; totalCents: number };
export type Order = Totals & {
  id: string; number: string; createdAt: string; updatedAt: string; version: number;
  customer: { name: string; phone: string }; fulfillment: Fulfillment; address: string; instructions: string;
  items: OrderItem[]; status: OrderStatus; payment: "unpaid" | "paid";
  history: { at: string; label: string }[];
  customerUpdates?: { at: string; message: string; estimatedAt?: string }[];
};
export type Receipt = { id: string; token: string };
export type CreationStatus = "private" | "submitted" | "published" | "rejected" | "hidden";
export type SavedCreation = { id: string; name: string; choices: Record<string, string>; unitCents: number; orderCount: number; likeCount: number; weeklyLikes?: number; weeklyOrders?: number; trendingRank?: number; challengeBadge?: string; rewardCode?: string; liked?: boolean; available?: boolean; creatorName?: string; creatorSlug?: string; createdAt: string; shareSlug?: string; moderationStatus: CreationStatus; featured: boolean };
export type CommunityChallenge = { title: string; description: string; active: boolean; updatedAt: string };
export type StoreSettings = { acceptingOrders: boolean; deliveryEnabled: boolean; pickupEnabled: boolean; notice: string; whatsappNumber: string; updatedAt: string };
export type OrderInput = { customer: { name: string; phone: string }; fulfillment: Fulfillment; address: string; instructions: string; promoCode?: string; items: OrderItemInput[] };
export class OrderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export function totals(subtotalCents: number, fulfillment: Fulfillment, discountCents = 0): Totals {
  const deliveryCents = fulfillment === "Delivery" && subtotalCents < 4000 ? 400 : 0;
  const discountedSubtotal = Math.max(0, subtotalCents - discountCents);
  const serviceCents = Math.round(discountedSubtotal * 0.05);
  return { subtotalCents, discountCents, deliveryCents, serviceCents, totalCents: discountedSubtotal + deliveryCents + serviceCents };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderError("Please check your order details.");
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new OrderError(`${label} must be ${min ? `${min}–` : "at most "}${max} characters.`);
  }
  return value.trim();
}
export function validateOrder(value: unknown, availableCocktails = cocktails, availableBuilderOptions: BuilderOptions = options) {
  const input = object(value);
  const customer = object(input.customer);
  const name = text(customer.name, "Name", 2, 80);
  const phone = text(customer.phone, "Phone number", 7, 24);
  if (!/^[+\d() .-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7) throw new OrderError("Enter a valid contact phone number.");
  if (input.fulfillment !== "Delivery" && input.fulfillment !== "Pickup") throw new OrderError("Choose delivery or pickup.");
  const fulfillment: Fulfillment = input.fulfillment;
  const address = fulfillment === "Delivery" ? text(input.address, "Delivery address", 8, 300) : "";
  const instructions = text(input.instructions ?? "", "Instructions", 0, 500);
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 40) throw new OrderError("Add between 1 and 40 drinks to your bag.");
  const items: OrderItem[] = input.items.map((raw) => {
    const item = object(raw);
    if (!Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20) throw new OrderError("Each drink quantity must be between 1 and 20.");
    const choices = object(item.choices);
    const drink = availableCocktails.find((entry) => entry.id === item.cocktailId);
    if (!drink && item.cocktailId !== -1) throw new OrderError("One of your drinks is no longer available. Please refresh the menu.");
    let unitCents = drink ? Math.round(drink.price * 100) : 1400;
    const groups = drink ? customizationGroups : Object.entries(availableBuilderOptions).map(([key, values]) => ({ key, options: values }));
    if (Object.keys(choices).length !== groups.length) throw new OrderError("Please choose all drink options again.");
    const labels = groups.map((group) => {
      const option = group.options.find((entry) => entry.label === choices[group.key]);
      if (!option) throw new OrderError("A drink option is invalid. Please customize the drink again.");
      unitCents += Math.round(option.price * 100);
      return option.label;
    });
    return { name: drink?.name ?? "Your Custom Creation", quantity: Number(item.quantity), customization: labels.join(" · "), unitCents };
  });
  if (items.reduce((sum, item) => sum + item.quantity, 0) > 40) throw new OrderError("Please limit an order to 40 drinks.");
  const subtotal = items.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
  return { customer: { name, phone }, fulfillment, address, instructions, items, ...totals(subtotal, fulfillment) };
}
export function nextStatus(order: Pick<Order, "status" | "fulfillment">): OrderStatus | null {
  if (order.status === "new") return "preparing";
  if (order.status === "preparing") return "ready";
  if (order.status === "ready") return order.fulfillment === "Delivery" ? "dispatched" : "completed";
  if (order.status === "dispatched") return "completed";
  return null;
}
