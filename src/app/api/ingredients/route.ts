import { activeBuilderOptions } from "@/lib/server/ingredient-store";
import { handle, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() { return handle(() => json({ options: activeBuilderOptions() })); }
