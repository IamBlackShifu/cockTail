import { requireStaff } from "@/lib/server/auth";
import { moderateCreation, updateCreationPrice } from "@/lib/server/creation-store";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { return handle(async () => { await requireStaff(); checkOrigin(request); const value = await readJson(request); const id = (await params).id; return json({ creation: value && typeof value === "object" && "priceCents" in value ? updateCreationPrice(id, value) : moderateCreation(id, value) }); }); }
