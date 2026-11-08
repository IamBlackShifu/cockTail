import { requireStaff } from "@/lib/server/auth";
import { analytics } from "@/lib/server/analytics-store";
import { handle, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) { return handle(async () => { await requireStaff(); return json({ analytics: analytics(new URL(request.url).searchParams.get("period") || "7") }); }); }
