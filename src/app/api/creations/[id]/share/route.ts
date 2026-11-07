import { shareCreation } from "@/lib/server/creation-store";
import { checkOrigin, handle, json, rateLimit } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    checkOrigin(request);
    rateLimit(request, "share-creation", 30, 15);
    const { id } = await params;
    return json({ creation: shareCreation(id, request.headers.get("x-creator-key") || "") });
  });
}
