import { requireStaff } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { listOrders } from "@/lib/server/order-store";
import { OrderError } from "@/lib/orders";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(async () => {
    await requireStaff();
    const page = Number(new URL(request.url).searchParams.get("page") || 0);
    if (!Number.isInteger(page) || page < 0 || page > 100000) throw new OrderError("Invalid page.");
    return json(listOrders(page, new URL(request.url).searchParams.get("view") || "all"));
  });
}
