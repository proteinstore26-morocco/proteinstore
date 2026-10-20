# PROTEIN STORE® Kénitra — storefront, admin & order backend

Sports-nutrition storefront for Kénitra, Morocco: catalogue, product pages, cart, WhatsApp checkout with
cash on delivery, **real order tracking**, customer accounts, and a role-gated administration dashboard
with orders, customers, invoices, tracking and SEO auditing.

**Live:** https://proteinstore.46.225.2.52.sslip.io
**Target domain:** `proteinestore.pro` (vhost ready in `deploy/Caddyfile.snippet`; add the DNS A record →
`46.225.2.52`, then enable that block).

## How ordering works

1. Customer builds a cart.
2. `/checkout` validates the form and **creates a local order** (SQLite): server-side re-pricing from the
   live catalogue, campaign discounts, shipping, an order number (`PS-YYYY-NNNNN`) and a WhatsApp message.
3. The browser redirects to WhatsApp with the full order prefilled, addressed to `+212 776 566 089`.
4. The shop confirms and delivers; the admin moves the order through
   `pending → confirmed → shipped → delivered` (or `cancelled`). **Every customer-facing action generates a
   WhatsApp message** to the customer's own number, which the admin opens in one click.
5. The customer tracks the order at `/track-order` with the order number and phone.

Orders, customers and invoices live in `data/proteinstore.db` (Node's built-in SQLite). No Supabase write,
no service-role key. The Supabase-compatible backend is only used for catalogue, auth and roles.

## Admin dashboard

`/auth` → sign in as `admin` / `super_admin` → `/admin`. Forgot the password? Use **« Mot de passe oublié ? »**
(see [admin access](docs/09-admin-access.md)).

- **Root only — Users:** invitations, role changes, suspension, account audit (`/admin/users`).
- **Overview:** revenue, orders, customers, average basket, pending queue, recent orders, top products.
- **Orders:** filters/search, full detail, status flow, internal notes, event history, invoice generation.
- **Customers:** aggregated by phone (orders, total spent, last order), order history, free WhatsApp message.
- **Invoices:** sequential `FAC-YYYY-NNNNN`, printable/PDF view, paid/void actions, WhatsApp resend.
- **Tracking:** the public tracking timeline is fed by the same events; the admin can drive it by status.
- **SEO:** global score, product-level issues (title length, description, images, slug, brand, category, price,
  stock), duplicate titles, sitemap/robots/JSON-LD checks, links to live product pages.
- **Catalogue & partners:** `/admin/store` keeps products, partners, categories and staff management.

WhatsApp messages are generated for: order creation, each status change, invoice issue, payment receipt,
invoice void, and free-form customer messages. Every message is logged in `whatsapp_messages`.

## Stack

- React 19 + TypeScript (strict) + TanStack Start/Router 1.170
- Tailwind CSS 4 + shadcn/ui (new-york) + Radix, dark brand theme
- TanStack Query, Zod, localStorage cart
- **Node 22 + `node:sqlite`** for orders/customers/invoices/tracking
- Supabase-compatible managed Postgres + RLS + Auth for catalogue, accounts and roles
- Nitro `node-server` behind Caddy 2.11 (systemd)

## Quick start

```bash
cp .env.example .env      # backend URL + publishable key
chmod 600 .env

npm install --legacy-peer-deps   # npm 10.9 peer-resolution bug on this dependency graph
npm run dev                      # Vite dev server (prints its URL)
```

If your shell exports `NODE_ENV=production`, add `--include=dev` to the install command.

```bash
npm test            # 48 unit tests (store, accounts, pricing, RBAC, WhatsApp, SEO, phones)
npx tsc --noEmit    # strict type-check
npm run build       # → .output/server/index.mjs + public/sitemap.xml (postbuild)
node .output/server/index.mjs   # production server on $PORT
```

## Environment variables

| Variable                                              | Where                     | Purpose                                                                 |
| ----------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `SUPABASE_URL`                                        | server                    | PostgREST/Auth base URL                                                 |
| `SUPABASE_PUBLISHABLE_KEY`                            | server                    | public key for catalogue reads                                          |
| `SUPABASE_SERVICE_ROLE_KEY`                           | server only, **optional** | staff administration only; not used by orders                           |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | build-time                | inlined in the browser bundle                                           |
| `VITE_SITE_URL`                                       | build-time                | canonical URL for JSON-LD/sitemap (default `https://proteinestore.pro`) |
| `ORDER_DB_PATH`                                       | server                    | override the SQLite file (default `data/proteinstore.db`)               |

`.env` is git-ignored; `.env.example` documents the shape. Never prefix a secret with `VITE_`.

## Data & backups

- Local store: `data/proteinstore.db` (WAL mode). Git-ignored, created automatically.
- Backup: `node scripts/backup-orders.mjs` (copies a consistent snapshot to `data/backups/`).
- Restore: stop the service, replace `data/proteinstore.db`, start the service.
- Catalogue/auth remain in the managed backend and are not duplicated locally.

## Deployment

See [`docs/07-runbook.md`](docs/07-runbook.md).

```bash
./deploy/deploy.sh   # install, typecheck, test, build, restart the isolated unit, smoke test
```

- Unit: `deploy/proteinstore.service` → port **5077**, writable `data/` (`ReadWritePaths`)
- Vhost: `deploy/Caddyfile.snippet` → `/etc/caddy/Caddyfile`, then `caddy reload`
- Smoke: `node scripts/smoke.mjs https://proteinstore.46.225.2.52.sslip.io` (21 checks)

## Quality

| Check                          | Result                                             |
| ------------------------------ | -------------------------------------------------- |
| `tsc --noEmit`                 | ✅                                                 |
| `npm test`                     | ✅ 48/48                                           |
| `npm run build` + sitemap      | ✅ 72 URLs                                         |
| Production smoke               | ✅ 21/21                                           |
| Order RPC + tracking + DB rows | ✅ exercised, QA order removed                     |
| Unauthenticated admin API      | ✅ rejected                                        |
| `npm run lint`                 | ❌ pre-existing Prettier debt; touched files clean |
| WCAG 2.2 AA certification      | ❌ not audited with axe                            |
| Browser E2E                    | ❌ not automated                                   |

## Documentation

- [Intake & assumptions](docs/00-intake.md)
- [Requirements, personas, MoSCoW backlog](docs/01-requirements.md)
- [UX flows, design tokens, accessibility](docs/02-ux-ui.md)
- [Architecture, ADRs, CI/CD](docs/03-architecture.md)
- [Data model, RLS, integrity](docs/04-data-model.md)
- [Security review & threat model](docs/05-security.md)
- [QA plan & results](docs/06-qa.md)
- [Runbook, rollback, roadmap](docs/07-runbook.md)
- [Test / staging instance](docs/08-staging.md)
- [Admin access & password reset](docs/09-admin-access.md)
- [Users, roles & root dashboard](docs/10-users-roles.md)

## Known limitations

1. WhatsApp messages are opened by the admin; there is no WhatsApp Business API auto-send.
2. The order/account store is single-host SQLite (no replication); back it up before upgrades.
3. User roles are local; the dashboard cannot create/delete Supabase identities or reset their passwords.
4. No browser E2E and no automated accessibility audit.
5. No admin MFA (account changes are audited locally).
6. French only; no Arabic/RTL.
7. `drizzle/` remains reference DDL for the managed backend.
