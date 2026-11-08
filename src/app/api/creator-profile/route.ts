import { ownCreatorProfile, saveCreatorProfile } from "@/lib/server/creator-store";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) { return handle(() => json({ profile: ownCreatorProfile(request.headers.get("x-creator-key") || "") })); }
export async function PATCH(request: Request) { return handle(async () => { checkOrigin(request); return json({ profile: saveCreatorProfile(request.headers.get("x-creator-key") || "", await readJson(request)) }); }); }
