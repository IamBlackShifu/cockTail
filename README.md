TIPSYGO

Cocktails on demand. A mobile-first cocktail ordering experience built with Next.js, TypeScript, and Tailwind CSS.

## Current milestone

The repository currently contains two front-end surfaces:

- `/` customer storefront with catalogue search, mood filters, customization, build-your-own cocktails, bag, checkout, account panel, and order tracking.
- `/ops` operations dashboard with kitchen queue, revenue reporting, preparation metrics, and driver readiness.

The data is intentionally local demo state for this milestone. The UI boundaries are ready to connect to authenticated API modules, PostgreSQL, payments, and real-time updates.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the customer app or `http://localhost:3000/ops` for operations.

## Validation

```bash
npm run lint
npm run build
npm run start
```

## Architecture direction

The app uses the Next.js App Router. Customer and operations experiences are separate routes so staff workflows can later receive independent authentication and permissions.

Planned domain modules:

- `catalogue`: cocktails, categories, ingredients, customization groups, and extras.
- `orders`: carts, order items, status history, delivery details, and refunds.
- `identity`: customers, staff roles, saved addresses, favourites, and loyalty.
- `payments`: provider-neutral payment intents and payment history.
- `operations`: preparation queue, driver assignment, inventory, and reporting.
- `notifications`: email, SMS, WhatsApp, and push adapters.

Recommended next backend slice:

1. Add Prisma with PostgreSQL and seed the catalogue entities.
2. Replace local cart state with server actions or route handlers.
3. Add secure session authentication and role checks for `/ops`.
4. Add WebSocket events for order status and driver assignment.

## Environment

Copy `.env.example` to `.env.local` when backend services are introduced. Secrets must remain server-only and must never be exposed in client components.

## Deployment

The app can be deployed to Vercel or run in the included Docker image. Configure environment variables in the deployment platform, run the production build, and place managed PostgreSQL, Redis, object storage, and payment services behind the domain adapters described above.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn more about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - learn Next.js in an interactive tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [the Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

```bash

