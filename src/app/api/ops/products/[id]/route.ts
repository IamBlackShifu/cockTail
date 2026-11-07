import { requireStaff } from "@/lib/server/auth";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
import { setProductActive, setProductAvailable, updateProduct } from "@/lib/server/product-store";
import { OrderError } from "@/lib/orders";
export const runtime = "nodejs";
function productId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new OrderError("Invalid product.");
  return id;
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => { await requireStaff(); checkOrigin(request); const { id } = await context.params; return json({ product: updateProduct(productId(id), await readJson(request)) }); });
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireStaff(); checkOrigin(request); const { id } = await context.params;
    const body = await readJson(request) as { version?: unknown; active?: unknown };
    return json({ product: setProductActive(productId(id), Number(body.version), body.active === true) });
  });
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireStaff(); checkOrigin(request); const { id } = await context.params;
    const body = await readJson(request) as { version?: unknown; available?: unknown };
    return json({ product: setProductAvailable(productId(id), Number(body.version), body.available === true) });
  });
}
