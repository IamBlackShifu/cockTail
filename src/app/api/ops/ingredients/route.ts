import { requireStaff } from "@/lib/server/auth";
import { createIngredient, listIngredients } from "@/lib/server/ingredient-store";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() { return handle(async () => { await requireStaff(); return json({ ingredients: listIngredients(true) }); }); }
export async function POST(request: Request) { return handle(async () => { await requireStaff(); checkOrigin(request); return json({ ingredient: createIngredient(await readJson(request)) }, 201); }); }
