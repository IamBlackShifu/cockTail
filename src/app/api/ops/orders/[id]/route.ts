import { requireStaff } from "@/lib/server/auth";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
import { updateOrder } from "@/lib/server/order-store";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireStaff();
    checkOrigin(request);
    const { id } = await context.params;
    return json({ order: updateOrder(id, await readJson(request)) });
  });
}
