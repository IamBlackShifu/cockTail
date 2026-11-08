import { requireStaff } from "@/lib/server/auth";
import { communityChallenge, listModeratedCreations, updateCommunityChallenge } from "@/lib/server/creation-store";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) { return handle(async () => { await requireStaff(); return json({ creations: listModeratedCreations(new URL(request.url).searchParams.get("status") || "all"), challenge: communityChallenge() }); }); }
export async function PUT(request: Request) { return handle(async () => { await requireStaff(); checkOrigin(request); return json({ challenge: updateCommunityChallenge(await readJson(request)) }); }); }
