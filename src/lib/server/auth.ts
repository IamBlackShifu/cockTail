import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "./database";
import { hash, origin } from "./http";
import { OrderError } from "../orders";

const derive = promisify(scrypt);
const cookieName = "tipsygo_ops";
export function requireConfigured() {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.OPS_PASSWORD_HASH || "")) {
    throw new OrderError("Ordering is not open yet. Please try again later.", 503);
  }
}
export async function login(password: unknown) {
  requireConfigured();
  if (typeof password !== "string" || password.length > 200) throw new OrderError("Incorrect staff password.", 401);
  const [salt, expected] = process.env.OPS_PASSWORD_HASH!.split(":");
  const actual = await derive(password, salt, 64) as Buffer;
  if (!timingSafeEqual(actual, Buffer.from(expected, "hex"))) throw new OrderError("Incorrect staff password.", 401);
  const token = randomBytes(32).toString("hex");
  db().prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
  db().prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(hash(token), Date.now() + 12 * 3600000, hash(process.env.OPS_PASSWORD_HASH!));
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: origin().startsWith("https:"), sameSite: "strict", path: "/api/ops", maxAge: 12 * 3600 });
}
export async function requireStaff() {
  requireConfigured();
  const token = (await cookies()).get(cookieName)?.value || "";
  const session = db().prepare("SELECT expires, credential_hash FROM sessions WHERE token_hash = ?").get(hash(token));
  if (!session || Number(session.expires) <= Date.now() || session.credential_hash !== hash(process.env.OPS_PASSWORD_HASH!)) {
    throw new OrderError("Sign in to view orders.", 401);
  }
}
export async function logout() {
  const store = await cookies();
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash(store.get(cookieName)?.value || ""));
  store.set(cookieName, "", { path: "/api/ops", maxAge: 0, httpOnly: true, sameSite: "strict", secure: origin().startsWith("https:") });
}
