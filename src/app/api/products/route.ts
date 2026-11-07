import { handle, json } from "@/lib/server/http";
import { categoryOrder, listProducts } from "@/lib/server/product-store";
export const runtime = "nodejs";
export async function GET() {
  return handle(() => json({ products: listProducts(false), categories: categoryOrder() }));
}
