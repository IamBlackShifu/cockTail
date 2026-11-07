import { randomBytes } from "node:crypto";
import { db, transaction } from "./database";
import { hash } from "./http";
import { OrderError, type CreationStatus, type SavedCreation } from "../orders";

type CreationRow = { id: string; name: string; choices: string; unit_cents: number; order_count: number; like_count?: number; liked?: number; created_at: string; share_slug: string | null; moderation_status: CreationStatus; featured: number };

const fields = "id, name, choices, unit_cents, order_count, created_at, share_slug, moderation_status, featured";
const mapped = (row: CreationRow): SavedCreation => ({ id: row.id, name: row.name, choices: JSON.parse(row.choices), unitCents: Number(row.unit_cents), orderCount: Number(row.order_count), likeCount: Number(row.like_count || 0), ...(row.liked !== undefined ? { liked: Boolean(row.liked) } : {}), createdAt: row.created_at, ...(row.share_slug ? { shareSlug: row.share_slug } : {}), moderationStatus: row.moderation_status, featured: Boolean(row.featured) });

export function listCreations(ownerKey: string): SavedCreation[] {
  if (!/^[a-f0-9]{64}$/.test(ownerKey)) throw new OrderError("Your creation library is not available in this browser.", 401);
  const rows = db().prepare(`SELECT ${fields} FROM creations WHERE owner_hash = ? ORDER BY created_at DESC LIMIT 100`).all(hash(ownerKey)) as unknown as CreationRow[];
  return rows.map(mapped);
}

export function shareCreation(id: string, ownerKey: string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(ownerKey)) throw new OrderError("Creation not found.", 404);
  return transaction(() => {
    const row = db().prepare(`SELECT ${fields} FROM creations WHERE id = ? AND owner_hash = ?`).get(id, hash(ownerKey)) as CreationRow | undefined;
    if (!row) throw new OrderError("Creation not found.", 404);
    if (!row.share_slug) {
      row.share_slug = randomBytes(9).toString("base64url");
      db().prepare("UPDATE creations SET share_slug = ? WHERE id = ?").run(row.share_slug, id);
    }
    return mapped(row);
  });
}

export function publicCreation(slug: string): SavedCreation | null {
  if (!/^[A-Za-z0-9_-]{12}$/.test(slug)) return null;
  const row = db().prepare(`SELECT ${fields} FROM creations WHERE share_slug = ?`).get(slug) as CreationRow | undefined;
  return row ? mapped(row) : null;
}

export function submitCreation(id: string, ownerKey: string) {
  return transaction(() => {
    if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(ownerKey)) throw new OrderError("Creation not found.", 404);
    const row = db().prepare(`SELECT ${fields} FROM creations WHERE id = ? AND owner_hash = ?`).get(id, hash(ownerKey)) as CreationRow | undefined;
    if (!row) throw new OrderError("Creation not found.", 404);
    if (!["private", "rejected", "hidden"].includes(row.moderation_status)) throw new OrderError("This mix has already been submitted.", 409);
    row.share_slug ||= randomBytes(9).toString("base64url"); row.moderation_status = "submitted"; row.featured = 0;
    db().prepare("UPDATE creations SET moderation_status = 'submitted', featured = 0, share_slug = ? WHERE id = ?").run(row.share_slug, id);
    return mapped(row);
  });
}

export function listModeratedCreations(status = "all") {
  if (!['all', 'submitted', 'published', 'rejected', 'hidden'].includes(status)) throw new OrderError("Invalid community view.");
  const rows = db().prepare(`SELECT ${fields} FROM creations WHERE ? = 'all' OR moderation_status = ? ORDER BY CASE WHEN moderation_status = 'submitted' THEN 0 ELSE 1 END, featured DESC, created_at DESC LIMIT 200`).all(status, status) as unknown as CreationRow[];
  return rows.map(mapped);
}

export function moderateCreation(id: string, value: unknown) {
  if (!value || typeof value !== "object") throw new OrderError("Invalid moderation update.");
  const { action } = value as { action?: unknown };
  const status: CreationStatus | null = action === "approve" ? "published" : action === "reject" ? "rejected" : action === "hide" ? "hidden" : null;
  return transaction(() => {
    const row = db().prepare(`SELECT ${fields} FROM creations WHERE id = ?`).get(id) as CreationRow | undefined;
    if (!row) throw new OrderError("Creation not found.", 404);
    if (action === "feature") {
      if (row.moderation_status !== "published") throw new OrderError("Only published mixes can be featured.", 409);
      db().prepare("UPDATE creations SET featured = ? WHERE id = ?").run(row.featured ? 0 : 1, id);
      row.featured = row.featured ? 0 : 1;
    } else if (status) {
      db().prepare("UPDATE creations SET moderation_status = ?, featured = 0 WHERE id = ?").run(status, id);
      row.moderation_status = status; row.featured = 0;
    } else throw new OrderError("Invalid moderation action.");
    return mapped(row);
  });
}

export function updateCreationPrice(id: string, value: unknown) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !value || typeof value !== "object") throw new OrderError("Invalid price update.");
  const priceCents = Number((value as { priceCents?: unknown }).priceCents);
  if (!Number.isInteger(priceCents) || priceCents < 50 || priceCents > 1_000_000) throw new OrderError("Price must be between $0.50 and $10,000.00.");
  return transaction(() => {
    const row = db().prepare(`SELECT ${fields} FROM creations WHERE id = ?`).get(id) as CreationRow | undefined;
    if (!row) throw new OrderError("Creation not found.", 404);
    db().prepare("UPDATE creations SET unit_cents = ? WHERE id = ?").run(priceCents, id);
    row.unit_cents = priceCents;
    return mapped(row);
  });
}

export function communityCreations(viewerKey = "") {
  const viewerHash = /^[a-f0-9]{64}$/.test(viewerKey) ? hash(viewerKey) : "";
  const rows = db().prepare(`SELECT ${fields}, (SELECT COUNT(*) FROM creation_likes WHERE creation_id = creations.id) AS like_count, EXISTS(SELECT 1 FROM creation_likes WHERE creation_id = creations.id AND voter_hash = ?) AS liked FROM creations WHERE moderation_status = 'published' ORDER BY featured DESC, like_count DESC, order_count DESC, created_at DESC LIMIT 60`).all(viewerHash) as unknown as CreationRow[];
  return rows.map(mapped);
}

export function toggleCreationLike(id: string, viewerKey: string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(viewerKey)) throw new OrderError("Unable to save this like.");
  return transaction(() => {
    const creation = db().prepare("SELECT id FROM creations WHERE id = ? AND moderation_status = 'published'").get(id);
    if (!creation) throw new OrderError("Community mix not found.", 404);
    const voterHash = hash(viewerKey);
    const existing = db().prepare("SELECT 1 FROM creation_likes WHERE creation_id = ? AND voter_hash = ?").get(id, voterHash);
    if (existing) db().prepare("DELETE FROM creation_likes WHERE creation_id = ? AND voter_hash = ?").run(id, voterHash);
    else db().prepare("INSERT INTO creation_likes VALUES (?, ?, ?)").run(id, voterHash, new Date().toISOString());
    const count = db().prepare("SELECT COUNT(*) AS count FROM creation_likes WHERE creation_id = ?").get(id);
    return { liked: !existing, likeCount: Number(count?.count || 0) };
  });
}
