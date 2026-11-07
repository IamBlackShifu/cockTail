import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";

let database: DatabaseSync | undefined;
export function db() {
  if (database) return database;
  // Runtime storage must never be traced into the production image.
  const filename = resolve(/* turbopackIgnore: true */ process.env.ORDER_DB_PATH || ".data/orders.sqlite");
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  database = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
      token_hash TEXT NOT NULL, created_at TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL, credential_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, note TEXT NOT NULL,
      price_cents INTEGER NOT NULL, category TEXT NOT NULL, image TEXT NOT NULL,
      strength TEXT NOT NULL, tone TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS products_active_name ON products(active, name COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS product_categories (
      name TEXT PRIMARY KEY, display_order INTEGER NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS creations (
      id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, name TEXT NOT NULL,
      choices TEXT NOT NULL, unit_cents INTEGER NOT NULL, order_id TEXT NOT NULL,
      created_at TEXT NOT NULL, order_count INTEGER NOT NULL DEFAULT 1, share_slug TEXT UNIQUE,
      moderation_status TEXT NOT NULL DEFAULT 'private', featured INTEGER NOT NULL DEFAULT 0,
      UNIQUE(owner_hash, order_id, name)
    );
    CREATE INDEX IF NOT EXISTS creations_owner_created ON creations(owner_hash, created_at DESC);
    CREATE TABLE IF NOT EXISTS creation_likes (
      creation_id TEXT NOT NULL, voter_hash TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY (creation_id, voter_hash), FOREIGN KEY (creation_id) REFERENCES creations(id) ON DELETE CASCADE
    );
  `);
  const columns = new Set((database.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map(column => column.name));
  if (!columns.has("featured")) database.exec("ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0");
  if (!columns.has("display_order")) database.exec("ALTER TABLE products ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0");
  if (!columns.has("available")) database.exec("ALTER TABLE products ADD COLUMN available INTEGER NOT NULL DEFAULT 1");
  const creationColumns = new Set((database.prepare("PRAGMA table_info(creations)").all() as { name: string }[]).map(column => column.name));
  if (!creationColumns.has("order_count")) database.exec("ALTER TABLE creations ADD COLUMN order_count INTEGER NOT NULL DEFAULT 1");
  if (!creationColumns.has("share_slug")) database.exec("ALTER TABLE creations ADD COLUMN share_slug TEXT");
  if (!creationColumns.has("moderation_status")) database.exec("ALTER TABLE creations ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'private'");
  if (!creationColumns.has("featured")) database.exec("ALTER TABLE creations ADD COLUMN featured INTEGER NOT NULL DEFAULT 0");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS creations_share_slug ON creations(share_slug) WHERE share_slug IS NOT NULL");
  database.exec("CREATE INDEX IF NOT EXISTS products_menu_order ON products(active, featured DESC, display_order)");
  return database;
}
export function transaction<T>(operation: () => T): T {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try { const result = operation(); database.exec("COMMIT"); return result; }
  catch (error) { database.exec("ROLLBACK"); throw error; }
}
