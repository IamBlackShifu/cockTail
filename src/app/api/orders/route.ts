import { requireConfigured } from "@/lib/server/auth";
import { checkOrigin, handle, json, rateLimit, readJson } from "@/lib/server/http";
import { createOrder } from "@/lib/server/order-store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    requireConfigured();
    checkOrigin(request);
    rateLimit(request, "checkout", 20, 15);
    const result = createOrder(await readJson(request), request.headers.get("idempotency-key") || "", request.headers.get("x-order-token") || "");
    return json({ order: result.order }, result.created ? 201 : 200);
  });
}
