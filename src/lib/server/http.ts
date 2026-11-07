import { createHash } from "node:crypto";
import { OrderError } from "../orders";
import { db } from "./database";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const origin = () => new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin;
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== origin()) throw new OrderError("Please use the store's own website to make this request.", 403);
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new OrderError("Expected JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new OrderError("Request body is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 24576) { await reader.cancel(); throw new OrderError("This order is too large.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new OrderError("Invalid JSON."); }
}
export function rateLimit(request: Request, scope: string, limit: number, minutes: number) {
  // Nginx overwrites X-Real-IP; the application port is bound to loopback.
  const key = `${scope}:${hash(request.headers.get("x-real-ip") || "local")}`;
  const now = Date.now();
  db().prepare("DELETE FROM rate_limits WHERE expires < ?").run(now);
  const row = db().prepare(`INSERT INTO rate_limits (key, count, expires) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`).get(key, now + minutes * 60000);
  if (Number(row?.count) > limit) throw new OrderError("Too many attempts. Please wait a few minutes before trying again.", 429);
}
export async function handle(operation: () => Promise<Response> | Response) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof OrderError) return json({ error: error.message }, error.status);
    console.error("Order API failure", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "We couldn't complete that request. Please try again." }, 500);
  }
}
