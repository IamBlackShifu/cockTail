import { listCreations } from "@/lib/server/creation-store";
import { handle, json, rateLimit } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handle(() => {
    rateLimit(request, "creations", 60, 15);
    return json({ creations: listCreations(request.headers.get("x-creator-key") || "") });
  });
}
