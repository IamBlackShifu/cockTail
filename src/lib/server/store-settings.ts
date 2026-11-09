import { OrderError, type StoreSettings } from "../orders";
import { db } from "./database";

const defaults: StoreSettings = { acceptingOrders: true, deliveryEnabled: true, pickupEnabled: true, notice: "", whatsappNumber: "", updatedAt: "" };
export function storeSettings(): StoreSettings {
  const row = db().prepare("SELECT value, updated_at FROM community_settings WHERE key = 'store'").get();
  if (!row) return defaults;
  const value = JSON.parse(String(row.value)) as Omit<StoreSettings, "updatedAt">;
  return { ...defaults, ...value, updatedAt: String(row.updated_at) };
}
export function updateStoreSettings(value: unknown): StoreSettings {
  if (!value || typeof value !== "object") throw new OrderError("Invalid store settings.");
  const raw = value as Partial<StoreSettings>;
  if (typeof raw.acceptingOrders !== "boolean" || typeof raw.deliveryEnabled !== "boolean" || typeof raw.pickupEnabled !== "boolean") throw new OrderError("Invalid store availability settings.");
  if (raw.acceptingOrders && !raw.deliveryEnabled && !raw.pickupEnabled) throw new OrderError("Enable delivery or pickup before accepting orders.");
  const notice = typeof raw.notice === "string" ? raw.notice.trim() : "";
  if (notice.length > 180) throw new OrderError("Customer notice must be at most 180 characters.");
  const whatsappNumber = typeof raw.whatsappNumber === "string" ? raw.whatsappNumber.replace(/\D/g, "") : "";
  if (whatsappNumber && (whatsappNumber.length < 8 || whatsappNumber.length > 15)) throw new OrderError("Enter the WhatsApp number in international format, including country code.");
  const settings = { acceptingOrders: raw.acceptingOrders, deliveryEnabled: raw.deliveryEnabled, pickupEnabled: raw.pickupEnabled, notice, whatsappNumber, updatedAt: new Date().toISOString() };
  db().prepare("INSERT INTO community_settings VALUES ('store', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(JSON.stringify({ acceptingOrders: settings.acceptingOrders, deliveryEnabled: settings.deliveryEnabled, pickupEnabled: settings.pickupEnabled, notice, whatsappNumber }), settings.updatedAt);
  return settings;
}
export function requireFulfillmentAvailable(fulfillment: unknown) {
  const settings = storeSettings();
  if (!settings.acceptingOrders) throw new OrderError(settings.notice || "TipsyGo is not accepting orders right now. Please check back soon.", 409);
  if (fulfillment === "Delivery" && !settings.deliveryEnabled) throw new OrderError("Delivery is currently unavailable. Choose pickup instead.", 409);
  if (fulfillment === "Pickup" && !settings.pickupEnabled) throw new OrderError("Pickup is currently unavailable. Choose delivery instead.", 409);
}
