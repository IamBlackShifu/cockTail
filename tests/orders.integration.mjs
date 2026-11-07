// Run after npm run build. Uses a temporary database and a loopback-only server.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import { createServer } from "node:net";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

test("real orders: authorization, prices, retries, transitions and persistence", { timeout: 180000 }, async t => {
  const temporary = mkdtempSync(join(tmpdir(), "tipsygo-orders-test-"));
  // Next discovers static files on startup, so copy them before starting the server.
  if (process.env.RUN_BROWSER_TESTS) {
    cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
    cpSync("public", ".next/standalone/public", { recursive: true });
  }
  const listener = createServer();
  await new Promise(done => listener.listen(0, "127.0.0.1", done));
  const port = listener.address().port;
  await new Promise(done => listener.close(done));
  const base = `http://127.0.0.1:${port}`;
  const password = randomBytes(24).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const credential = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  let server;
  let output = "";
  let cookie = "";
  async function start(configured = true) {
    output = "";
    server = spawn(process.execPath, ["server.js"], {
      cwd: resolve(".next/standalone"), windowsHide: true,
      env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port), APP_ORIGIN: base, OPS_PASSWORD_HASH: configured ? credential : "", ORDER_DB_PATH: join(temporary, "orders.sqlite") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", chunk => { output += chunk; });
    server.stderr.on("data", chunk => { output += chunk; });
    for (let index = 0; index < 40; index++) {
      if (server.exitCode !== null) throw new Error(output);
      try { if ((await fetch(base, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
      await new Promise(done => setTimeout(done, 250));
    }
    throw new Error("Server startup timed out: " + output);
  }
  async function stop() {
    if (server && server.exitCode === null) { const closed = once(server, "close"); server.kill(); await closed; }
  }
  async function request(path, { method = "GET", body, headers = {}, auth = false } = {}) {
    return fetch(base + path, {
      method, headers: { ...(method !== "GET" ? { Origin: base, "Content-Type": "application/json" } : {}), ...(auth ? { Cookie: cookie } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
    });
  }
  const input = {
    customer: { name: "Integration Customer", phone: "+263771234567" }, fulfillment: "Delivery", address: "10 Test Street, Harare", instructions: "Ring the bell",
    items: [{ cocktailId: 1, quantity: 1, choices: { size: "Classic", sweetness: "Normal", strength: "Standard", ice: "Normal ice", garnish: "Lime & mint", extra: "Nothing extra" } }],
  };
  const key = randomUUID();
  const token = randomBytes(32).toString("hex");
  const customCreatorKey = randomBytes(32).toString("hex");
  const submitHeaders = { "Idempotency-Key": key, "X-Order-Token": token };
  let order;
  try {
    await start();
    await t.test("staff data and cross-origin mutations are protected", async () => {
      assert.equal((await request("/api/ops/orders")).status, 401);
      assert.equal((await request("/api/orders", { method: "POST", body: input, headers: { ...submitHeaders, Origin: "https://evil.example" } })).status, 403);
      assert.equal((await request("/api/ops/session", { method: "POST", body: { password: "wrong" } })).status, 401);
    });
    await t.test("server prices override supplied prices; repeat submissions create one order", async () => {
      const response = await request("/api/orders", { method: "POST", body: { ...input, totalCents: 1 }, headers: submitHeaders });
      assert.equal(response.status, 201);
      order = (await response.json()).order;
      assert.equal(order.totalCents, 1765);
      assert.equal(order.payment, "unpaid");
      assert.equal(order.status, "new");
      const duplicate = await request("/api/orders", { method: "POST", body: input, headers: submitHeaders });
      assert.equal(duplicate.status, 200);
      assert.equal((await duplicate.json()).order.id, order.id);
      const simultaneous = await Promise.all([1, 2].map(() => request("/api/orders", { method: "POST", body: input, headers: submitHeaders })));
      for (const response of simultaneous) {
        assert.equal(response.status, 200);
        assert.equal((await response.json()).order.id, order.id);
      }
      const conflict = await request("/api/orders", { method: "POST", body: { ...input, instructions: "different" }, headers: submitHeaders });
      assert.equal(conflict.status, 409);
    });
    await t.test("validation rejects missing details, unknown options, oversized bodies and invalid quantities", async () => {
      for (const invalid of [{ ...input, address: "" }, { ...input, items: [] }, { ...input, items: [{ ...input.items[0], quantity: -1 }] }, { ...input, items: [{ ...input.items[0], choices: { ...input.items[0].choices, size: "Free giant cup" } }] }]) {
        assert.equal((await request("/api/orders", { method: "POST", body: invalid, headers: { ...submitHeaders, "Idempotency-Key": randomUUID() } })).status, 400);
      }
      assert.equal((await request("/api/orders", { method: "POST", body: { ...input, instructions: "a".repeat(30000) }, headers: submitHeaders })).status, 413);
    });
    await t.test("tracking requires the customer's secret and staff login creates a secure session", async () => {
      assert.equal((await request(`/api/orders/${order.id}`)).status, 404);
      assert.equal((await request(`/api/orders/${order.id}`, { headers: { Authorization: "Bearer wrong" } })).status, 404);
      const tracked = await request(`/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(tracked.status, 200);
      assert.match(tracked.headers.get("cache-control"), /no-store/);
      const signedIn = await request("/api/ops/session", { method: "POST", body: { password } });
      assert.equal(signedIn.status, 200);
      const setCookie = signedIn.headers.get("set-cookie");
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=strict/i);
      cookie = setCookie.split(";")[0];
      const queue = await request("/api/ops/orders", { auth: true });
      const payload = await queue.json();
      assert.equal(queue.status, 200);
      assert.equal(payload.orders.length, 1);
      assert.equal(payload.orders[0].id, order.id);
    });
    await t.test("only staff can advance orders; stale and skipped transitions are rejected", async () => {
      const path = `/api/ops/orders/${order.id}`;
      assert.equal((await request(path, { method: "PATCH", body: { action: "preparing", version: 1 } })).status, 401);
      assert.equal((await request(path, { method: "PATCH", auth: true, body: { action: "completed", version: 1 } })).status, 409);
      const next = await request(path, { method: "PATCH", auth: true, body: { action: "preparing", version: 1 } });
      assert.equal(next.status, 200);
      order = (await next.json()).order;
      assert.equal(order.status, "preparing");
      assert.equal((await request(path, { method: "PATCH", auth: true, body: { action: "ready", version: 1 } })).status, 409);
      for (const action of ["ready", "dispatched", "completed", "mark-paid"]) {
        const response = await request(path, { method: "PATCH", auth: true, body: { action, version: order.version } });
        assert.equal(response.status, 200);
        order = (await response.json()).order;
      }
      assert.equal(order.payment, "paid");
      assert.equal(order.history.length, 6);
      assert.equal((await request(path, { method: "PATCH", auth: true, body: { action: "cancelled", version: order.version } })).status, 409);
    });
    await t.test("pickup custom creations have correct options, prices and handover", async () => {
      const response = await request("/api/orders", { method: "POST", body: { ...input, fulfillment: "Pickup", address: "", items: [{ cocktailId: -1, quantity: 2, creationName: "Harare Sunset", creatorKey: customCreatorKey, choices: { spirit: "Gin", mixer: "Passionfruit", finish: "Berry crown" } }] }, headers: { ...submitHeaders, "Idempotency-Key": randomUUID() } });
      assert.equal(response.status, 201);
      let pickup = (await response.json()).order;
      assert.equal(pickup.totalCents, 3780);
      assert.equal(pickup.deliveryCents, 0);
      assert.match(pickup.items[0].customization, /Berry crown/);
      assert.equal((await request("/api/creations")).status, 401);
      const libraryResponse = await request("/api/creations", { headers: { "X-Creator-Key": customCreatorKey } });
      assert.equal(libraryResponse.status, 200);
      const library = (await libraryResponse.json()).creations;
      assert.equal(library.length, 1);
      assert.equal(library[0].name, "Harare Sunset");
      assert.equal(library[0].choices.finish, "Berry crown");
      const shareResponse = await request(`/api/creations/${library[0].id}/share`, { method: "POST", headers: { "X-Creator-Key": customCreatorKey } });
      assert.equal(shareResponse.status, 200);
      const shared = (await shareResponse.json()).creation;
      assert.match(shared.shareSlug, /^[A-Za-z0-9_-]{12}$/);
      const sharedPage = await request(`/mix/${shared.shareSlug}`);
      assert.equal(sharedPage.status, 200);
      assert.match(await sharedPage.text(), /Harare Sunset/);
      const friendKey = randomBytes(32).toString("hex");
      const sharedOrder = await request("/api/orders", { method: "POST", body: { ...input, fulfillment: "Pickup", address: "", items: [{ cocktailId: -1, quantity: 1, creationName: "Harare Sunset", creatorKey: friendKey, sourceCreationId: shared.id, choices: shared.choices }] }, headers: { "Idempotency-Key": randomUUID(), "X-Order-Token": randomBytes(32).toString("hex") } });
      assert.equal(sharedOrder.status, 201);
      const ownerLibrary = await request("/api/creations", { headers: { "X-Creator-Key": customCreatorKey } });
      assert.equal((await ownerLibrary.json()).creations[0].orderCount, 2);
      const friendLibrary = await request("/api/creations", { headers: { "X-Creator-Key": friendKey } });
      assert.equal((await friendLibrary.json()).creations[0].name, "Harare Sunset");
      const submittedResponse = await request(`/api/creations/${shared.id}/submit`, { method: "POST", headers: { "X-Creator-Key": customCreatorKey } });
      assert.equal(submittedResponse.status, 200);
      assert.equal((await submittedResponse.json()).creation.moderationStatus, "submitted");
      assert.equal((await request("/api/ops/creations?status=submitted")).status, 401);
      const reviewQueue = await request("/api/ops/creations?status=submitted", { auth: true });
      assert.equal((await reviewQueue.json()).creations[0].name, "Harare Sunset");
      const approved = await request(`/api/ops/creations/${shared.id}`, { method: "PATCH", auth: true, body: { action: "approve" } });
      assert.equal(approved.status, 200);
      assert.equal((await approved.json()).creation.moderationStatus, "published");
      const featured = await request(`/api/ops/creations/${shared.id}`, { method: "PATCH", auth: true, body: { action: "feature" } });
      assert.equal((await featured.json()).creation.featured, true);
      const repriced = await request(`/api/ops/creations/${shared.id}`, { method: "PATCH", auth: true, body: { priceCents: 2250 } });
      assert.equal(repriced.status, 200);
      assert.equal((await repriced.json()).creation.unitCents, 2250);
      const community = await request("/api/community");
      assert.equal((await community.json()).creations[0].unitCents, 2250);
      const communityOrder = await request("/api/orders", { method: "POST", body: { ...input, fulfillment: "Pickup", address: "", items: [{ cocktailId: -1, quantity: 1, creationName: "Harare Sunset", creatorKey: friendKey, sourceCreationId: shared.id, choices: shared.choices }] }, headers: { "Idempotency-Key": randomUUID(), "X-Order-Token": randomBytes(32).toString("hex") } });
      assert.equal(communityOrder.status, 201);
      assert.equal((await communityOrder.json()).order.items[0].unitCents, 2250);
      const likeResponse = await request(`/api/community/${shared.id}/like`, { method: "POST", headers: { "X-Creator-Key": friendKey } });
      assert.equal(likeResponse.status, 200);
      assert.deepEqual(await likeResponse.json(), { liked: true, likeCount: 1 });
      const likedCommunity = await request("/api/community", { headers: { "X-Creator-Key": friendKey } });
      assert.equal((await likedCommunity.json()).creations[0].liked, true);
      for (const action of ["preparing", "ready", "completed"]) {
        const next = await request(`/api/ops/orders/${pickup.id}`, { method: "PATCH", auth: true, body: { action, version: pickup.version } });
        assert.equal(next.status, 200);
        pickup = (await next.json()).order;
      }
    });
    await t.test("staff manage live products while historical order prices remain unchanged", async () => {
      const publicBefore = await request("/api/products");
      assert.equal(publicBefore.status, 200);
      assert.equal((await publicBefore.json()).products.length, 6);
      assert.equal((await request("/api/ops/products")).status, 401);
      const draft = { name: "Test Citrus Cloud", note: "Orange · vanilla · soda", priceCents: 1725, category: "Mocktails", image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=85", strength: "Zero proof", tone: "lime", featured: true };
      const createdResponse = await request("/api/ops/products", { method: "POST", auth: true, body: draft });
      assert.equal(createdResponse.status, 201);
      let product = (await createdResponse.json()).product;
      assert.equal(product.priceCents, 1725);
      assert.equal((await request("/api/ops/products", { method: "POST", auth: true, body: draft })).status, 409);
      const editedResponse = await request(`/api/ops/products/${product.id}`, { method: "PATCH", auth: true, body: { ...draft, name: "Citrus Cloud", priceCents: 1950, version: product.version } });
      assert.equal(editedResponse.status, 200);
      product = (await editedResponse.json()).product;
      assert.equal(product.priceCents, 1950);
      assert.equal(product.featured, true);
      const staffMenu = await request("/api/ops/products", { auth: true });
      const menu = await staffMenu.json();
      const reordered = await request("/api/ops/products", { method: "PUT", auth: true, body: { productIds: [product.id, ...menu.products.filter(entry => entry.active && entry.id !== product.id).map(entry => entry.id)], categories: ["Mocktails", ...menu.categories.filter(name => name !== "Mocktails")] } });
      assert.equal(reordered.status, 200);
      const publicMerchandising = await request("/api/products");
      const merchandised = await publicMerchandising.json();
      assert.equal(merchandised.products[0].id, product.id);
      assert.equal(merchandised.categories[0], "Mocktails");
      const soldOutResponse = await request(`/api/ops/products/${product.id}`, { method: "PUT", auth: true, body: { version: product.version, available: false } });
      assert.equal(soldOutResponse.status, 200);
      product = (await soldOutResponse.json()).product;
      assert.equal(product.available, false);
      const soldOutPublic = await request("/api/products");
      assert.equal((await soldOutPublic.json()).products.find(entry => entry.id === product.id).available, false);
      assert.equal((await request("/api/orders", { method: "POST", body: { ...input, items: [{ cocktailId: product.id, quantity: 1, choices: input.items[0].choices }] }, headers: { "Idempotency-Key": randomUUID(), "X-Order-Token": randomBytes(32).toString("hex") } })).status, 400);
      const availableResponse = await request(`/api/ops/products/${product.id}`, { method: "PUT", auth: true, body: { version: product.version, available: true } });
      assert.equal(availableResponse.status, 200);
      product = (await availableResponse.json()).product;
      assert.equal((await request(`/api/ops/products/${product.id}`, { method: "PATCH", auth: true, body: { ...draft, version: 1 } })).status, 409);
      const productToken = randomBytes(32).toString("hex");
      const productOrderResponse = await request("/api/orders", { method: "POST", body: { ...input, fulfillment: "Pickup", address: "", items: [{ cocktailId: product.id, quantity: 1, choices: input.items[0].choices }] }, headers: { "Idempotency-Key": randomUUID(), "X-Order-Token": productToken } });
      assert.equal(productOrderResponse.status, 201);
      const productOrder = (await productOrderResponse.json()).order;
      assert.equal(productOrder.items[0].unitCents, 1950);
      const removedResponse = await request(`/api/ops/products/${product.id}`, { method: "DELETE", auth: true, body: { version: product.version, active: false } });
      assert.equal(removedResponse.status, 200);
      product = (await removedResponse.json()).product;
      assert.equal(product.active, false);
      const publicAfter = await request("/api/products");
      assert.equal((await publicAfter.json()).products.some(entry => entry.id === product.id), false);
      assert.equal((await request("/api/orders", { method: "POST", body: { ...input, items: [{ cocktailId: product.id, quantity: 1, choices: input.items[0].choices }] }, headers: { "Idempotency-Key": randomUUID(), "X-Order-Token": randomBytes(32).toString("hex") } })).status, 400);
      const trackedHistorical = await request(`/api/orders/${productOrder.id}`, { headers: { Authorization: `Bearer ${productToken}` } });
      assert.equal((await trackedHistorical.json()).order.items[0].unitCents, 1950);
      const restored = await request(`/api/ops/products/${product.id}`, { method: "DELETE", auth: true, body: { version: product.version, active: true } });
      assert.equal(restored.status, 200);
      assert.equal((await restored.json()).product.active, true);
    });
    await t.test("order and staff session survive process restart; logout revokes access", async () => {
      await stop(); await start();
      const tracked = await request(`/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(tracked.status, 200);
      assert.equal((await tracked.json()).order.payment, "paid");
      assert.equal((await request("/api/ops/orders", { auth: true })).status, 200);
      assert.equal((await request("/api/ops/session", { method: "DELETE", auth: true })).status, 200);
      assert.equal((await request("/api/ops/orders", { auth: true })).status, 401);
    });
    await t.test("mobile checkout reaches a separate staff browser and receives status updates", { skip: !process.env.RUN_BROWSER_TESTS }, async () => {
      const { chromium, expect } = await import("@playwright/test");
      mkdirSync(".test-artifacts", { recursive: true });
      const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
      try {
        const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
        await customerContext.addInitScript(key => localStorage.setItem("tipsygo-creator-key-v1", key), customCreatorKey);
        const staffContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const customer = await customerContext.newPage();
        const staff = await staffContext.newPage();
        const browserErrors = [];
        customer.on("pageerror", error => browserErrors.push(error.message));
        staff.on("pageerror", error => browserErrors.push(error.message));
        await customer.goto(base);
        await expect(customer.locator("#community").getByRole("heading", { name: "Harare Sunset" })).toBeVisible();
        await customer.getByRole("button", { name: /Build your own/ }).click();
        await customer.getByRole("button", { name: /Next step/ }).click();
        await customer.getByRole("button", { name: /Next step/ }).click();
        await customer.getByLabel("Cocktail name").fill("Browser Sunset");
        await customer.getByRole("button", { name: /Name it & add to bag/ }).click();
        await expect(customer.locator("#cart").getByText("Browser Sunset")).toBeVisible();
        await customer.getByRole("button", { name: "Remove Browser Sunset from bag" }).click();
        await customer.getByRole("button", { name: "My mixes" }).click();
        await expect(customer.getByRole("dialog", { name: "My creations" }).getByRole("heading", { name: "Harare Sunset" })).toBeVisible();
        await customer.getByRole("button", { name: "Close creations" }).click();
        await customer.getByRole("button", { name: /Customize & add/ }).first().click();
        await customer.getByRole("button", { name: /Add customized cocktail/ }).click();
        await expect(customer.getByRole("status").filter({ hasText: /added to your bag/i })).toBeVisible();
        await customer.getByRole("button", { name: /Increase .* quantity/ }).click();
        await expect(customer.getByRole("button", { name: "Bag 2" })).toBeVisible();
        await customer.getByRole("button", { name: "Edit options" }).click();
        await customer.getByRole("dialog").getByRole("button", { name: /Large cup/ }).click();
        await customer.getByRole("button", { name: /Save changes/ }).click();
        await expect(customer.locator("#cart").getByText(/Large cup/)).toBeVisible();
        await expect(customer.getByRole("button", { name: "Bag 2" })).toBeVisible();
        await customer.reload();
        await expect(customer.getByRole("button", { name: "Bag 2" })).toBeVisible();
        await expect(customer.locator("#cart").getByText(/Large cup/)).toBeVisible();
        await customer.getByRole("button", { name: /^Checkout/ }).click();
        await customer.getByLabel("Your name").fill("Browser Customer");
        await customer.getByLabel("Phone number").fill("+263771234567");
        await customer.getByLabel("Delivery address").fill("20 Browser Street, Harare");
        await customer.screenshot({ path: ".test-artifacts/checkout-mobile.png" });
        // The server accepts checkout, but the response is lost. Recovery must not duplicate it.
        await customer.route("**/api/orders", async route => {
          await route.fetch();
          await route.abort("failed");
        }, { times: 1 });
        await customer.getByRole("button", { name: /Place order/ }).click();
        await expect(customer.getByRole("dialog").getByRole("button", { name: "Retry confirmation" })).toBeVisible();
        await customer.getByRole("button", { name: "Close checkout" }).click();
        await customer.getByRole("button", { name: "Retry confirmation" }).click();
        await expect(customer.getByRole("heading", { name: "Received", exact: true })).toBeVisible();
        await expect(customer.locator("#cart").getByText("Your next good decision starts here.")).toBeVisible();
        assert.equal(await customer.evaluate(() => localStorage.getItem("tipsygo-cart-v1")), null);
        const number = await customer.locator(".order-code strong").innerText();
        await customer.reload();
        await expect(customer.getByRole("heading", { name: "Received", exact: true })).toBeVisible();
        await staff.goto(base + "/ops");
        await staff.getByLabel("Staff password").fill(password);
        await staff.getByRole("button", { name: "Open operations →" }).click();
        await staff.getByRole("button", { name: "Community mixes" }).click();
        await staff.getByRole("button", { name: "published", exact: true }).click();
        await expect(staff.getByRole("heading", { name: "Harare Sunset" })).toBeVisible();
        await staff.getByRole("button", { name: "Products & prices" }).click();
        await staff.getByLabel("Product name").fill("Browser Berry Fizz");
        await staff.getByLabel("Description").fill("Berry · lime · soda");
        await staff.getByLabel("Price (USD)").fill("12.75");
        await staff.getByLabel("Category").fill("Mocktails");
        await staff.getByLabel("Strength label").fill("Zero proof");
        await staff.getByLabel("Image URL").fill("https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=85");
        await staff.getByRole("button", { name: "Add to menu" }).click();
        const browserProduct = staff.locator(".managed-product").filter({ hasText: "Browser Berry Fizz" });
        await expect(browserProduct).toHaveCount(1);
        await customer.reload();
        await expect(customer.getByRole("heading", { name: "Browser Berry Fizz" })).toBeVisible();
        staff.once("dialog", dialog => dialog.accept());
        await browserProduct.getByRole("button", { name: "Remove" }).click();
        await expect(browserProduct).toHaveCount(0);
        await customer.reload();
        await expect(customer.getByRole("heading", { name: "Browser Berry Fizz" })).toHaveCount(0);
        await staff.getByRole("button", { name: "Orders in motion" }).click();
        await expect(staff.locator(".live-order-row").filter({ hasText: "Browser Customer" })).toHaveCount(1);
        await staff.locator(".live-order-row").filter({ hasText: number }).click();
        await expect(staff.getByRole("heading", { name: "Browser Customer" })).toBeVisible();
        await staff.getByRole("button", { name: "Start preparing", exact: true }).click();
        await expect(staff.getByRole("button", { name: "Mark ready", exact: true })).toBeVisible();
        await customer.getByRole("button", { name: "Refresh status" }).click();
        await expect(customer.getByRole("heading", { name: "Preparing", exact: true })).toBeVisible();
        await staff.screenshot({ path: ".test-artifacts/ops-order-desktop.png" });
        await staff.getByRole("button", { name: "Close order details" }).click();
        await staff.setViewportSize({ width: 390, height: 844 });
        await staff.screenshot({ path: ".test-artifacts/ops-mobile.png" });
        assert.equal(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "staff layout should not overflow a mobile screen");
        assert.equal(await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "customer layout should not overflow a mobile screen");
        assert.deepEqual(browserErrors, []);
      } finally { await browser.close(); }
    });
    await t.test("new orders are disabled until staff credentials are configured", async () => {
      await stop(); await start(false);
      assert.equal((await request("/api/orders", { method: "POST", body: input, headers: submitHeaders })).status, 503);
    });
  } finally {
    await stop();
    assert.ok(basename(temporary).startsWith("tipsygo-orders-test-"));
    rmSync(temporary, { recursive: true, force: true });
  }
});
