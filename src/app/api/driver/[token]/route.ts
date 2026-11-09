import { checkOrigin, handle, json, rateLimit, readJson } from "@/lib/server/http";
import { driverOrder, updateDriverOrder } from "@/lib/server/order-store";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(async () => { rateLimit(request, "driver-read", 120, 10); const { token } = await context.params; return json({ order: driverOrder(token) }); });
}
export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(async () => { rateLimit(request, "driver-write", 40, 10); checkOrigin(request); const { token } = await context.params; return json({ order: updateDriverOrder(token, await readJson(request)) }); });
}
