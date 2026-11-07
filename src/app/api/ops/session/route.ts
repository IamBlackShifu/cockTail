import { login, logout, requireStaff } from "@/lib/server/auth";
import { checkOrigin, handle, json, rateLimit, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() { return handle(async () => { await requireStaff(); return json({ authenticated: true }); }); }
export async function POST(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    rateLimit(request, "login", 10, 15);
    const body = await readJson(request) as { password?: unknown } | null;
    await login(body?.password);
    return json({ authenticated: true });
  });
}
export async function DELETE(request: Request) {
  return handle(async () => { checkOrigin(request); await logout(); return json({ authenticated: false }); });
}
