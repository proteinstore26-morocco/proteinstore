# PROTEIN STORE® Kénitra — storefront & administration

Sports-nutrition storefront for Kénitra, Morocco: catalogue, product pages, cart, **cash-on-delivery
checkout**, order tracking, partner gyms, customer accounts and a role-gated back office.

**Live:** https://proteinstore.46.225.2.52.sslip.io

> **Checkout status:** the storefront is live. COD order creation is **temporarily disabled**
> because the server-only `SUPABASE_SERVICE_ROLE_KEY` has not been supplied. The UI falls back to
> WhatsApp with an explicit message. See [Known limitations](#known-limitations).

## Stack

- React 19 + TypeScript (strict) + TanStack Start/Router 1.170
- Tailwind CSS 4 + shadcn/ui (new-york) + Radix, dark brand theme
- Zod validation, TanStack Query, localStorage cart
- Lovable Cloud (Supabase-compatible Postgres + RLS + Auth) as the backend
- Node 22 + Nitro `node-server` behind Caddy 2.11 (systemd)

## Quick start

```bash
cp .env.example .env      # fill in the Supabase values; add the service-role key for checkout
chmod 600 .env

npm install --legacy-peer-deps   # npm 10.9 peer-resolution bug on this dependency graph
npm run dev                      # Vite dev server (prints its URL)
```

If your shell exports `NODE_ENV=production`, add `--include=dev` to the install command.

```bash
npm test            # 14 unit tests (pricing, RBAC, rate limiting, routing)
npx tsc --noEmit    # strict type-check
npm run build       # → .output/server/index.mjs
node .output/server/index.mjs   # production server on $PORT (default 3000)
```

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | server | PostgREST/Auth base URL |
| `SUPABASE_PUBLISHABLE_KEY` | server | public key for catalogue reads |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | RLS-bypassing key: COD order creation, staff admin |
| `VITE_SUPABASE_URL` | build-time | same URL inlined in the browser bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build-time | public key inlined in the browser bundle |

`VITE_*` values are baked in at build time. Never prefix the service-role key with `VITE_`.
`.env` is git-ignored; `.env.example` documents the shape.

## Back office

`/auth` → sign in with an admin account → `/admin`.

- **Orders:** status (`pending → confirmed → shipped → delivered / cancelled`) + internal notes.
- **Products:** price, sale price, stock, low-stock threshold, publication, flavours.
- **Partners:** gyms, discount codes, links, display order.
- **Staff (Super Admin only):** list, grant and revoke admin access; self- and Super-Admin accounts
  are protected.

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
| `npm test` | ✅ 14/14 |
| `npm run build` | ✅ |
| Production smoke (15 checks) | ✅ 15/15 |
| `npm run lint` | ❌ 964 **pre-existing** Prettier violations; files touched by this delivery are clean |
| WCAG 2.2 AA certification | ❌ not audited with axe |
| COD order E2E | ⛔ blocked on the service-role key |

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

1. **COD checkout disabled** until `SUPABASE_SERVICE_ROLE_KEY` is set (RLS has no INSERT policy on
   `orders`; this is intentional).
2. No browser E2E and no automated accessibility audit.
3. In-memory rate limiting (single process, resets on restart).
4. No admin audit log, no MFA, no idempotency key.
5. French only; no Arabic/RTL.
6. `drizzle/` is reference DDL, not applied at runtime.

## Built with Lovable

This project was built with [Lovable](https://lovable.dev) and remains connected to
[the editor](https://lovable.dev/projects/e1681b59-920c-4e0e-ba7c-09f81ac5c1d2). Avoid rewriting
published history; keep the connected branch working. The original live app was
https://proteinstore.lovable.app.
