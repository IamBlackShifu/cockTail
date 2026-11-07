import { requireStaff } from "@/lib/server/auth";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
import { categoryOrder, createProduct, listProducts, reorderMenu } from "@/lib/server/product-store";
export const runtime = "nodejs";
export async function GET() { return handle(async () => { await requireStaff(); return json({ products: listProducts(true), categories: categoryOrder() }); }); }
export async function POST(request: Request) {
  return handle(async () => { await requireStaff(); checkOrigin(request); return json({ product: createProduct(await readJson(request)) }, 201); });
}
export async function PUT(request: Request) {
  return handle(async () => { await requireStaff(); checkOrigin(request); return json(reorderMenu(await readJson(request))); });
}
