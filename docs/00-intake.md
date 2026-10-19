# Phase 0 — Intake (BA)

**Source of truth:** `github.com/proteinstore26-morocco/proteinstore` @ `5bf63b6` (single commit,
"Added WhatsApp confirm link"), plus its `README.md` and `roadmap.md`. No other specification was
provided; the repository itself is the contract.

## 10-line summary of the documentation

1. **Business:** PROTEIN STORE®, a sports-nutrition shop in Kénitra, Morocco, selling authentic
   whey, creatine, gainers, pre-workout, amino acids, fat burners and health products.
2. **Channels:** consumer storefront (`/`), catalogue (`/shop`), product pages, partners page,
   about, contact, order tracking, account, and a role-gated administration area.
3. **Commerce model:** cash on delivery only (`Paiement à la livraison`), no card gateway,
   no Stripe — confirmed in the README's four answered questions.
4. **Pricing:** whole dirhams (MAD); 30 MAD shipping, free from 500 MAD; active campaigns can
   discount categories, products or the whole catalogue, applied on top of sale prices.
5. **Language:** French-only copy, RTL-safe layout, no language switcher; the brand and city
   stay in Latin script.
6. **Backend:** a Supabase-compatible backend (Lovable Cloud) with 10 tables, RLS on every table,
   and server functions for catalogue, orders, tracking and administration.
7. **Auth:** Supabase email/password, `user_roles` with `customer` / `admin` / `super_admin`,
   admin-only store management and Super-Admin-only staff management.
8. **Seed content:** live backend currently holds **58 products, 8 categories, 9 partners,
   1 active campaign, 5 reviews** (read-only count, 19/10/2026).
9. **Known state:** the README reports a previously paused backend; at intake the backend answers
   (`/rest/v1` → 200) and serves real data. `orders` is empty to anon (RLS), as designed.
10. **Ambiguity:** the repo commits `.env` with public keys, and the checkout requires a
    server-only `SUPABASE_SERVICE_ROLE_KEY` that is absent from the repository.

## Assumptions (explicit, per vibe-coding rule 1)

| # | Assumption | Impact if wrong |
|---|---|---|
| A1 | The GitHub repository is the complete specification; no separate BRD exists. | Low — requirements derive from code and live copy. |
| A2 | French-only UI is intentional for v1; no Arabic/French switcher. | Medium — i18n is out of scope. |
| A3 | COD is the only payment method for v1. | Low — checkout is built around it. |
| A4 | The live Lovable Cloud backend is the production data store and stays in place. | High — self-hosting Postgres would be a rewrite. |
| A5 | "Deploy" means a new isolated Node service on this host behind Caddy, not touching the existing productions. | High — would change the deployment target. |
| A6 | The service-role key can be supplied by the owner from Lovable Cloud settings. | High — COD checkout cannot write orders without it. |
| A7 | sslip.io hostname is acceptable until DNS for a real domain is pointed here. | Low — swap the Caddy vhost. |

## Blockers raised at intake

1. **Repository access** — resolved: the owner made the repository public; import succeeded.
2. **Server-only key** — `SUPABASE_SERVICE_ROLE_KEY` was never committed and is not present in the
   host environment. Without it, `orders` INSERT (RLS has no policy for anon/authenticated) and
   staff administration cannot run. **Owner action required.**
3. **Shared production host** — the deployment must be a new isolated unit on port 5077; no shared
   service is restarted and no shared database is touched.

## BA status

| Phase | Status | Open risks | Next step |
|---|---|---|---|
| 0 — Intake | ✅ Complete | A6 (service role key); A5 (host authorization) | Discovery: requirements + backlog |
