import { cocktails, productTones, type Cocktail, type ManagedProduct } from "../catalog";
import { OrderError } from "../orders";
import { db, transaction } from "./database";

type ProductRow = {
  id: number; name: string; note: string; price_cents: number; category: string;
  image: string; strength: string; tone: string; active: number; version: number;
  featured: number; display_order: number; available: number;
  created_at: string; updated_at: string;
};

function fromRow(row: ProductRow): ManagedProduct {
  return {
    id: Number(row.id), name: row.name, note: row.note, price: Number(row.price_cents) / 100,
    priceCents: Number(row.price_cents), category: row.category, image: row.image,
    strength: row.strength, tone: row.tone, active: Boolean(row.active), available: Boolean(row.available), featured: Boolean(row.featured), displayOrder: Number(row.display_order), version: Number(row.version),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function seedProducts() {
  transaction(() => {
    const count = Number(db().prepare("SELECT COUNT(*) AS count FROM products").get()?.count || 0);
    if (count) return;
    const now = new Date().toISOString();
    const insert = db().prepare(`INSERT INTO products
      (id, name, note, price_cents, category, image, strength, tone, active, available, featured, display_order, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?, 1, ?, ?)`);
    for (const [index, product] of cocktails.entries()) {
      insert.run(product.id, product.name, product.note, Math.round(product.price * 100), product.category, product.image, product.strength, product.tone, index, now, now);
    }
  });
}

function cleanText(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new OrderError(`${label} must contain ${min}–${max} characters.`);
  }
  return value.trim();
}

function validateProduct(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderError("Check the product details.");
  const input = value as Record<string, unknown>;
  const name = cleanText(input.name, "Product name", 2, 80);
  const note = cleanText(input.note, "Description", 2, 180);
  const category = cleanText(input.category, "Category", 2, 40);
  const strength = cleanText(input.strength, "Strength label", 2, 30);
  const image = cleanText(input.image, "Image URL", 8, 500);
  let parsedImage: URL;
  try { parsedImage = new URL(image); } catch { throw new OrderError("Enter a valid HTTPS image URL."); }
  if (parsedImage.protocol !== "https:") throw new OrderError("Product images must use HTTPS.");
  if (typeof input.tone !== "string" || !(productTones as readonly string[]).includes(input.tone)) throw new OrderError("Choose a valid colour tone.");
  const priceCents = Number(input.priceCents);
  if (!Number.isInteger(priceCents) || priceCents < 50 || priceCents > 1_000_000) throw new OrderError("Price must be between $0.50 and $10,000.00.");
  return { name, note, category, strength, image: parsedImage.toString(), tone: input.tone, priceCents, featured: input.featured === true };
}

function syncCategories() {
  const now = new Date().toISOString();
  const names = db().prepare("SELECT DISTINCT category FROM products ORDER BY display_order, category COLLATE NOCASE").all() as { category: string }[];
  const maximum = Number(db().prepare("SELECT COALESCE(MAX(display_order), -1) AS value FROM product_categories").get()?.value ?? -1);
  const insert = db().prepare("INSERT OR IGNORE INTO product_categories (name, display_order, updated_at) VALUES (?, ?, ?)");
  names.forEach((entry, index) => insert.run(entry.category, maximum + index + 1, now));
}

export function categoryOrder() {
  seedProducts(); syncCategories();
  return (db().prepare("SELECT name FROM product_categories ORDER BY display_order, name COLLATE NOCASE").all() as { name: string }[]).map(entry => entry.name);
}

export function listProducts(includeInactive = false) {
  seedProducts();
  syncCategories();
  const rows = db().prepare(`SELECT products.* FROM products LEFT JOIN product_categories ON product_categories.name = products.category ${includeInactive ? "" : "WHERE active = 1"} ORDER BY active DESC, featured DESC, COALESCE(product_categories.display_order, 999999), products.display_order, products.name COLLATE NOCASE`).all() as unknown as ProductRow[];
  return rows.map(fromRow);
}

export function activeCocktails(): Cocktail[] {
  return listProducts(false).filter(product => product.available).map(({ id, name, note, price, category, image, strength, tone, featured, displayOrder }) => ({ id, name, note, price, category, image, strength, tone, featured, displayOrder }));
}

export function createProduct(value: unknown) {
  const product = validateProduct(value);
  seedProducts();
  return transaction(() => {
    const duplicate = db().prepare("SELECT 1 FROM products WHERE name = ? COLLATE NOCASE AND active = 1").get(product.name);
    if (duplicate) throw new OrderError("An active product already uses that name.", 409);
    const now = new Date().toISOString();
    const displayOrder = Number(db().prepare("SELECT COALESCE(MAX(display_order), -1) + 1 AS value FROM products").get()?.value || 0);
    const result = db().prepare(`INSERT INTO products
      (name, note, price_cents, category, image, strength, tone, active, available, featured, display_order, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 1, ?, ?)`).run(product.name, product.note, product.priceCents, product.category, product.image, product.strength, product.tone, product.featured ? 1 : 0, displayOrder, now, now);
    syncCategories();
    const row = db().prepare("SELECT * FROM products WHERE id = ?").get(Number(result.lastInsertRowid)) as unknown as ProductRow;
    return fromRow(row);
  });
}

export function updateProduct(id: number, value: unknown) {
  const product = validateProduct(value);
  const version = Number((value as Record<string, unknown>).version);
  if (!Number.isInteger(version) || version < 1) throw new OrderError("Refresh this product before saving.");
  seedProducts();
  return transaction(() => {
    const current = db().prepare("SELECT * FROM products WHERE id = ?").get(id) as unknown as ProductRow | undefined;
    if (!current) throw new OrderError("Product not found.", 404);
    if (current.version !== version) throw new OrderError("Another staff member changed this product. Refresh and try again.", 409);
    const duplicate = db().prepare("SELECT 1 FROM products WHERE id != ? AND name = ? COLLATE NOCASE AND active = 1").get(id, product.name);
    if (duplicate) throw new OrderError("An active product already uses that name.", 409);
    const now = new Date().toISOString();
    db().prepare(`UPDATE products SET name = ?, note = ?, price_cents = ?, category = ?, image = ?, strength = ?, tone = ?, featured = ?,
      version = version + 1, updated_at = ? WHERE id = ?`).run(product.name, product.note, product.priceCents, product.category, product.image, product.strength, product.tone, product.featured ? 1 : 0, now, id);
    syncCategories();
    return fromRow(db().prepare("SELECT * FROM products WHERE id = ?").get(id) as unknown as ProductRow);
  });
}

export function reorderMenu(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderError("Check the menu order.");
  const input = value as { productIds?: unknown; categories?: unknown };
  if (!Array.isArray(input.productIds) || !Array.isArray(input.categories)) throw new OrderError("Check the menu order.");
  const productIds = input.productIds.map(Number);
  const categories = input.categories.map(item => typeof item === "string" ? item.trim() : "");
  if (new Set(productIds).size !== productIds.length || productIds.some(id => !Number.isInteger(id) || id < 1) || new Set(categories).size !== categories.length || categories.some(name => !name)) throw new OrderError("Menu order contains invalid or duplicate items.");
  seedProducts(); syncCategories();
  const activeIds = (db().prepare("SELECT id FROM products WHERE active = 1").all() as { id: number }[]).map(row => Number(row.id));
  const knownCategories = categoryOrder();
  if (activeIds.length !== productIds.length || activeIds.some(id => !productIds.includes(id)) || knownCategories.length !== categories.length || knownCategories.some(name => !categories.includes(name))) throw new OrderError("Refresh products before saving their order.", 409);
  transaction(() => {
    const now = new Date().toISOString();
    const updateProductOrder = db().prepare("UPDATE products SET display_order = ?, updated_at = ? WHERE id = ?");
    productIds.forEach((id, index) => updateProductOrder.run(index, now, id));
    const updateCategoryOrder = db().prepare("UPDATE product_categories SET display_order = ?, updated_at = ? WHERE name = ?");
    categories.forEach((name, index) => updateCategoryOrder.run(index, now, name));
  });
  return { products: listProducts(true), categories: categoryOrder() };
}

export function setProductActive(id: number, version: number, active: boolean) {
  if (!Number.isInteger(version) || version < 1) throw new OrderError("Refresh this product before changing availability.");
  seedProducts();
  return transaction(() => {
    const current = db().prepare("SELECT * FROM products WHERE id = ?").get(id) as unknown as ProductRow | undefined;
    if (!current) throw new OrderError("Product not found.", 404);
    if (current.version !== version) throw new OrderError("Another staff member changed this product. Refresh and try again.", 409);
    if (Boolean(current.active) === active) return fromRow(current);
    if (active && db().prepare("SELECT 1 FROM products WHERE id != ? AND name = ? COLLATE NOCASE AND active = 1").get(id, current.name)) {
      throw new OrderError("Rename this product before restoring it; an active product has the same name.", 409);
    }
    db().prepare("UPDATE products SET active = ?, version = version + 1, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return fromRow(db().prepare("SELECT * FROM products WHERE id = ?").get(id) as unknown as ProductRow);
  });
}

export function setProductAvailable(id: number, version: number, available: boolean) {
  if (!Number.isInteger(version) || version < 1) throw new OrderError("Refresh this product before changing availability.");
  seedProducts();
  return transaction(() => {
    const current = db().prepare("SELECT * FROM products WHERE id = ?").get(id) as unknown as ProductRow | undefined;
    if (!current || !current.active) throw new OrderError("Product not found.", 404);
    if (current.version !== version) throw new OrderError("Another staff member changed this product. Refresh and try again.", 409);
    if (Boolean(current.available) === available) return fromRow(current);
    db().prepare("UPDATE products SET available = ?, version = version + 1, updated_at = ? WHERE id = ?").run(available ? 1 : 0, new Date().toISOString(), id);
    return fromRow(db().prepare("SELECT * FROM products WHERE id = ?").get(id) as unknown as ProductRow);
  });
}
