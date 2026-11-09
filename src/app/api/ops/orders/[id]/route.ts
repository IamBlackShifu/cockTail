import { requireStaff } from "@/lib/server/auth";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
import { assignHandover, updateOrder } from "@/lib/server/order-store";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireStaff();
    checkOrigin(request);
    const { id } = await context.params;
    const value = await readJson(request);
    if (value && typeof value === "object" && (value as { action?: unknown }).action === "assign-handover") {
      const assigned = assignHandover(id, value);
      return json({ order: assigned.order, driverToken: assigned.token });
    }
    return json({ order: updateOrder(id, value) });
  });
}
