TIPSYGO

Cocktails on demand. A mobile-first cocktail ordering experience built with Next.js, TypeScript, and Tailwind CSS.

## Current milestone

The repository currently contains two front-end surfaces:

- `/` customer storefront with catalogue search, mood filters, customization, build-your-own cocktails, bag, checkout, account panel, and order tracking.
- `/ops` operations dashboard with kitchen queue, revenue reporting, preparation metrics, and driver readiness.

Checkout creates real, persistent orders. The staff dashboard requires a password, receives orders, and manages the live product catalogue and prices. Product changes reach open storefronts within 30 seconds or when the window regains focus. Customers receive order status updates every ten seconds and retain their latest tracking receipt across refreshes. Payments are collected on delivery or pickup and recorded by staff. Online payment processing is not integrated.

## Run locally

Requirements: Node.js 24 LTS and npm. This application uses the built-in SQLite module.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the customer app or `http://localhost:3000/ops` for operations.

## Validation

```bash
npm run lint
npm run build
npm run test:orders
npm run start
```

## Architecture direction

The app uses the Next.js App Router. Route handlers validate order details, price items from the shared catalogue, protect staff APIs with revocable HttpOnly sessions, and use SQLite transactions for order writes. Orders and sessions survive restarts through a persistent Docker volume.

Planned domain modules:

- `catalogue`: cocktails, categories, ingredients, customization groups, and extras.
- `orders`: carts, order items, status history, delivery details, and refunds.
- `identity`: customers, staff roles, saved addresses, favourites, and loyalty.
- `payments`: provider-neutral payment intents and payment history.
- `operations`: preparation queue, driver assignment, inventory, and reporting.
- `notifications`: email, SMS, WhatsApp, and push adapters.

Next upgrades: individual staff accounts and roles, integrated payments, product option management, delivery assignment, customer order history, and automated off-server backups.

## Environment

See `.env.example` for local settings. Checkout remains disabled until a staff password hash is configured. For production, the deployment helper securely prompts for a password and writes `/opt/tipsygo/shared/runtime.env`. Secrets stay server-only. API tests generate isolated credentials and a temporary database; they never connect to the production VPS.

## Deployment

For the Ubuntu 24.04 Namecheap VPS at `162.0.238.193` and `tipsygo.pro`, follow [the deployment command list](deploy/README.md). It includes a Windows upload helper and bundled shell scripts for server setup, app deployment, and HTTPS.

Run the included Docker image on the VPS with its persistent `tipsygo_orders` volume. The current SQLite storage needs durable disk; an ephemeral serverless deployment requires a different database integration. See the deployment guide for backup commands.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn more about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - learn Next.js in an interactive tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Browser checks

After `npm run build`, `npm run test:orders` verifies prices, validation, customer tracking, staff access, status transitions and persistence. To also exercise mobile checkout and a separate staff browser in Windows PowerShell:

```powershell
$env:RUN_BROWSER_TESTS = "1"
$env:BROWSER_CHANNEL = "msedge"
npm run test:orders
```

This uses installed Microsoft Edge. Alternatively, install Playwright Chromium with `npx playwright install chromium` and leave `BROWSER_CHANNEL` unset. Screenshots are saved in `.test-artifacts/`.
