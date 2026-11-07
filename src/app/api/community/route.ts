import { communityCreations } from "@/lib/server/creation-store";
import { handle, json, rateLimit } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) { return handle(() => { rateLimit(request, "community", 120, 15); return json({ creations: communityCreations(request.headers.get("x-creator-key") || "") }); }); }
