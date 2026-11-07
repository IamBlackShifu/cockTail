import { requireStaff } from "@/lib/server/auth";
import { listModeratedCreations } from "@/lib/server/creation-store";
import { handle, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) { return handle(async () => { await requireStaff(); return json({ creations: listModeratedCreations(new URL(request.url).searchParams.get("status") || "all") }); }); }
