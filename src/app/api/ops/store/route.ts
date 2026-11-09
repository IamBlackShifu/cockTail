import { requireStaff } from "@/lib/server/auth";
import { checkOrigin, handle, json, readJson } from "@/lib/server/http";
import { storeSettings, updateStoreSettings } from "@/lib/server/store-settings";
export const runtime = "nodejs";
export async function GET() { return handle(async () => { await requireStaff(); return json({ settings: storeSettings() }); }); }
export async function PUT(request: Request) { return handle(async () => { await requireStaff(); checkOrigin(request); return json({ settings: updateStoreSettings(await readJson(request)) }); }); }
