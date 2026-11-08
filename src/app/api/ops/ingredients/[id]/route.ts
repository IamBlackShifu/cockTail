import { requireStaff } from "@/lib/server/auth";
import { setIngredientActive, setIngredientAvailable, updateIngredient } from "@/lib/server/ingredient-store";
import { OrderError } from "@/lib/orders";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
function ingredientId(value: string) { const id = Number(value); if (!Number.isInteger(id) || id < 1) throw new OrderError("Invalid ingredient."); return id; }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return handle(async () => { await requireStaff(); checkOrigin(request); const { id } = await context.params; return json({ ingredient: updateIngredient(ingredientId(id), await readJson(request)) }); }); }
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) { return handle(async () => { await requireStaff(); checkOrigin(request); const { id } = await context.params; const body = await readJson(request) as { version?: unknown; available?: unknown }; return json({ ingredient: setIngredientAvailable(ingredientId(id), Number(body.version), body.available === true) }); }); }
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return handle(async () => { await requireStaff(); checkOrigin(request); const { id } = await context.params; const body = await readJson(request) as { version?: unknown; active?: unknown }; return json({ ingredient: setIngredientActive(ingredientId(id), Number(body.version), body.active === true) }); }); }
