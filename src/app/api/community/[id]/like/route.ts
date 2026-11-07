import { toggleCreationLike } from "@/lib/server/creation-store";
import { checkOrigin, handle, json, rateLimit } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { return handle(async () => { checkOrigin(request); rateLimit(request, "like-community", 60, 15); return json(toggleCreationLike((await params).id, request.headers.get("x-creator-key") || "")); }); }
