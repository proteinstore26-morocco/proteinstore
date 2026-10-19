# PROTEIN STORE® Kénitra — storefront & administration

Sports-nutrition storefront for Kénitra, Morocco: catalogue, product pages, cart, **WhatsApp
ordering with cash on delivery**, order follow-up, partner gyms, customer accounts and a
role-gated back office.

**Live:** https://proteinstore.46.225.2.52.sslip.io
**Target domain:** `proteinestore.pro` (vhost ready in `deploy/Caddyfile.snippet`; add the DNS
A record → `46.225.2.52`, then enable that block).

## How ordering works

1. The customer builds a cart.
2. On `/checkout` they enter name, phone, city, address and notes.
3. Submitting **redirects to WhatsApp** (`+212 776 566 089`) with a prefilled message containing
   every line item, quantities, the total and the delivery details.
4. The shop confirms delivery and payment in the chat. **Cash on delivery only.**

No order is written to the database: there is no `orders` INSERT path and no service-role key
required for the storefront. `/track-order` hands the conversation to WhatsApp as well.

## Stack

- React 19 + TypeScript (strict) + TanStack Start/Router 1.170
- Tailwind CSS 4 + shadcn/ui (new-york) + Radix, dark brand theme
- TanStack Query, Zod, localStorage cart
- Managed Supabase-compatible Postgres + RLS + Auth for the catalogue, accounts and admin
- Node 22 + Nitro `node-server` behind Caddy 2.11 (systemd)

## Quick start

```bash
cp .env.example .env      # fill in the backend URL + publishable key
chmod 600 .env

npm install --legacy-peer-deps   # npm 10.9 peer-resolution bug on this dependency graph
npm run dev                      # Vite dev server (prints its URL)
```

If your shell exports `NODE_ENV=production`, add `--include=dev` to the install command.

```bash
npm test            # 15 unit tests (pricing, RBAC, routing, WhatsApp messages)
npx tsc --noEmit    # strict type-check
npm run build       # → .output/server/index.mjs
node .output/server/index.mjs   # production server on $PORT (default 3000)
```

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | server | PostgREST/Auth base URL |
| `SUPABASE_PUBLISHABLE_KEY` | server | public key for catalogue reads |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, **optional** | privileged staff administration; not used by checkout |
| `VITE_SUPABASE_URL` | build-time | same URL inlined in the browser bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build-time | public key inlined in the browser bundle |

`VITE_*` values are baked in at build time. Never prefix the service-role key with `VITE_`.
`.env` is git-ignored; `.env.example` documents the shape.

## Back office

`/auth` → sign in with an admin account → `/admin`.

- **Products:** price, sale price, stock, low-stock threshold, publication, flavours.
- **Partners:** gyms, discount codes, links, display order.
- **Orders:** the queue only shows orders created before the switch to WhatsApp ordering
  (there are none in the live database today). WhatsApp orders live in the chat.
- **Staff (Super Admin only):** requires the optional service-role key.

Authorization is enforced **server-side** on every function by `user_roles` + RLS; the UI guard is
only a convenience.

## Deployment

See [`docs/07-runbook.md`](docs/07-runbook.md) for the full procedure.

```bash
./deploy/deploy.sh   # install, typecheck, test, build, restart the isolated unit, smoke test
```

- Unit: `deploy/proteinstore.service` → `/etc/systemd/system/proteinstore.service` (port 5077)
- Vhost: `deploy/Caddyfile.snippet` → appended to `/etc/caddy/Caddyfile`, then `caddy reload`
- Health/smoke: `node scripts/smoke.mjs https://proteinstore.46.225.2.52.sslip.io`

## Quality

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ |
| `npm test` | ✅ 15/15 |
| `npm run build` | ✅ |
| Production smoke | ✅ |
| `npm run lint` | ❌ 964 **pre-existing** Prettier violations; files touched by this delivery are clean |
| WCAG 2.2 AA certification | ❌ not audited with axe |
| Checkout | ✅ WhatsApp handoff (no DB writes) |

## Documentation

- [Intake & assumptions](docs/00-intake.md)
- [Requirements, personas, MoSCoW backlog](docs/01-requirements.md)
- [UX flows, design tokens, accessibility](docs/02-ux-ui.md)
- [Architecture, ADRs, CI/CD](docs/03-architecture.md)
- [Data model, RLS, integrity](docs/04-data-model.md)
- [Security review & threat model](docs/05-security.md)
- [QA plan & results](docs/06-qa.md)
- [Runbook, rollback, roadmap](docs/07-runbook.md)

## Known limitations

1. Orders are not stored in the database; there is no admin order queue or analytics for them.
2. No browser E2E and no automated accessibility audit.
3. `/track-order` is a WhatsApp handoff, not a live status lookup.
4. No admin audit log, no MFA.
5. French only; no Arabic/RTL.
6. `drizzle/` is reference DDL, not applied at runtime.
