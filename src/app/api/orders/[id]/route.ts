import { handle, json } from "@/lib/server/http";
import { customerOrder } from "@/lib/server/order-store";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params;
    return json({ order: customerOrder(id, request.headers.get("authorization")?.replace(/^Bearer /, "") || "") });
  });
}
