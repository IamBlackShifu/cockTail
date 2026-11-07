import { submitCreation } from "@/lib/server/creation-store";
import { checkOrigin, handle, json, rateLimit } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => { checkOrigin(request); rateLimit(request, "submit-creation", 20, 15); return json({ creation: submitCreation((await params).id, request.headers.get("x-creator-key") || "") }); });
}
