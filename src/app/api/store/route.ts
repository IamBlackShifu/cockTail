import { handle, json } from "@/lib/server/http";
import { storeSettings } from "@/lib/server/store-settings";
export const runtime = "nodejs";
export async function GET() { return handle(() => json({ settings: storeSettings() })); }
