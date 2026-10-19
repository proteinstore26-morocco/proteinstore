# Phase 1 — Requirements & Backlog (BA)

## 1. Personas

| Persona | Goals | Frustrations |
|---|---|---|
| **Yassine, 24 — gym customer (Kénitra)** | Find a specific whey, compare price/sale, order in under 2 minutes, pay cash on delivery. | Fake products, hidden shipping cost, checkout that asks for a card. |
| **Salma, 31 — returning customer** | Re-order her usual creatine, track a delivery, keep an account. | Re-entering her address, not knowing the order status. |
| **Hamza — store owner / admin** | Update prices and stock, move orders through `pending → confirmed → shipped → delivered`, add partner gyms. | Overselling, orders that vanish, staff who can edit everything. |
| **Nadia — super admin / staff manager** | Grant or revoke admin access, protect her own account. | Anyone being able to self-promote. |
| **Googlebot / social crawlers** | Crawl indexable pages, render rich previews. | Client-only pages with empty HTML. |

## 2. Functional requirements (Must)

| ID | Requirement | Implementation |
|---|---|---|
| F1 | Public catalogue with category filter, brand filter, search, sort, product count. | `src/routes/shop.tsx`, `src/lib/catalog.ts` |
| F2 | Product page: gallery image, variants (flavours), stock state, campaign price, nutrition facts, reviews. | `src/routes/product.$slug.tsx` |
| F3 | Persistent cart (localStorage) with quantities capped by stock, free-shipping progress. | `src/lib/cart.tsx`, `components/site/Layout.tsx` |
| F4 | COD checkout that stores the order locally (re-priced server-side), then redirects to WhatsApp with the prefilled order. | `src/routes/checkout.tsx`, `src/lib/orders.functions.ts`, `src/lib/order-store.server.ts` |
| F5 | Real order tracking by order number + phone, with a status timeline; WhatsApp fallback. | `src/routes/track-order.tsx`, `src/lib/order-store.server.ts` |
| F6 | Campaign pricing (percent/fixed, all/category/product, priority, date window). | `src/lib/pricing.ts` |
| F7 | Sign-up / sign-in, protected account area. | `src/routes/auth.tsx`, `_authenticated/*` |
| F8 | Admin dashboard: orders (status, notes), customers, invoices, KPIs, products, partners. | `src/routes/_authenticated/admin.tsx`, `src/components/admin/*`, `src/lib/store.functions.ts` |
| F9 | Super Admin: list staff, grant/revoke admin, protect own and Super-Admin accounts. | `admin.functions.ts`, `src/lib/admin-rules.ts` |
| F10 | French-only UI, MAD formatting, Kénitra storefront identity, WhatsApp contact. | all routes, `src/lib/pricing.ts` |
| F11 | Public content pages: partners, about, contact; 404; sitemap-free robots policy. | `src/routes/*` |
| F12 | Server-side validation of every write (zod) and role checks on every admin read/write. | `.inputValidator`, `requireSupabaseAuth`, `requireStoreAdmin` |
| F13 | Customers aggregated by phone: orders count, total spent, last order, history. | `order-store.server.ts`, `CustomersPanel` |
| F14 | Invoices: sequential number, printable document, paid/void status. | `order-store.server.ts`, `InvoicesPanel` |
| F15 | Every customer-facing admin action generates and logs a WhatsApp message to that customer. | `store.functions.ts`, `whatsapp.ts` |
| F16 | SEO dashboard + sitemap + Product/Store JSON-LD. | `seo.functions.ts`, `seo.ts`, `scripts/generate-sitemap.mjs` |

## 3. Non-functional requirements

| ID | Requirement | Target / evidence |
|---|---|---|
| N1 | SSR + SEO metadata on public pages | `head()` per route, SSR verified with `curl` |
| N2 | First meaningful HTML < 1 s locally | measured 0.02–0.66 s on localhost |
| N3 | All pages usable at 360 px width | Tailwind responsive classes, mobile menu |
| N4 | WCAG 2.2 AA on core screens | partial audit — see `06-qa.md`; **not certified** |
| N5 | No secret in the client bundle | service key server-only; `.env` git-ignored |
| N6 | Order writes are authoritative server-side | prices, shipping, stock recomputed |
| N7 | Public checkout is rate-limited (8/10 min/IP) and tracking lookups too (20/10 min/IP) | `rate-limit.ts` |
| N8 | Deployable on Node 22 with no Docker | `nitro` preset `node-server`, systemd unit |
| N9 | No dependency on the original hosted editor | plain Vite/TanStack build |
| N10 | Orders survive restarts and are backed up | SQLite WAL + `scripts/backup-orders.mjs` |

## 4. Prioritised backlog (MoSCoW)

| Priority | Item | Owner |
|---|---|---|
| **Must** | F1–F9, F12, N1, N5, N6, N8 | Dev-1/4/6/7, DB, Security, Architect |
| **Must** | F10, F11 | Dev-2/6 |
| **Should** | structured server error logging, smoke test suite | Security, QA |
| **Should** | N2/N3/N4 fixes found during audit | Dev-8 |
| **Could** | Newsletter capture (table + policy exist, no UI), sitemap.xml, image CDN optimisation, Arabic version | Dev-6/8 |
| **Won't (v1)** | Card payments (CMI/Stripe), B2B price tiers, delivery-rider app, multi-store tenancy | — |

## 5. Acceptance criteria (Given / When / Then)

**AC-1 — Browse and filter (F1)**
- Given 58 published products, when a visitor opens `/shop`, then all products render server-side,
  and filtering by category or brand or typing a query updates the list without a reload.

**AC-2 — Campaign price (F6)**
- Given a percent campaign of 10 % and a product at 1000 MAD with sale price 849,
  when the product is displayed, then the unit price is 764 MAD (rounded to whole dirhams)
  and the crossed-out price is 1000 MAD.

**AC-3 — Checkout (F4)**
- Given a cart and a valid Moroccan phone, when the customer submits the form, then the server
  re-prices from the live catalogue (campaigns included), inserts one order + items + `created` event in
  one SQLite transaction, returns `PS-YYYY-NNNNN`, logs the WhatsApp message, and the browser navigates
  to `wa.me/…` with the full order.
- Given an empty cart, then checkout shows the empty state and offers no redirect.

**AC-4 — Tracking (F5)**
- Given the order number and the matching phone, when the customer submits tracking, then the status,
  items, total, invoice reference and event timeline are shown.
- Given a wrong phone, then no order data is returned.

**AC-7 — Invoices (F14)**
- Given an order, when the admin generates an invoice, then a unique `FAC-YYYY-NNNNN` is stored once
  (idempotent), an event is appended, and a WhatsApp message is generated.
- Given an invoice marked paid, then the order payment status becomes `paid` and an event is logged.

**AC-8 — SEO (F16)**
- Given the catalogue, when the admin opens the SEO tab, then each product has a score and explicit
  issues; `/sitemap.xml` lists published products and static pages; product pages expose Product JSON-LD.

**AC-5 — RBAC (F8/F9)**
- Given a `customer`, when calling `getAdminData`, then the call is rejected.
- Given an `admin`, when revoking their own role or a `super_admin` role, then the action is refused.
- Given a `super_admin`, when granting `admin` to an existing account, then the role is upserted.

**AC-6 — Deployment (N8)**
- Given a clean checkout and a filled `.env`, when `npm ci && npm run build` is run,
  then `.output/server/index.mjs` starts and all public routes answer 200 over HTTPS.

## 6. Traceability matrix

| Requirement | Code | Test evidence | Status |
|---|---|---|---|
| F1 | `shop.tsx`, `catalog.functions.ts` | smoke: `/shop` | ✅ |
| F2 | `product.$slug.tsx` | smoke + manual | ✅ |
| F3 | `cart.tsx` | manual | ✅ |
| F4 | `checkout.tsx`, `orders.functions.ts`, `order-store.server.ts` | `order-store.test.ts` + live RPC | ✅ |
| F5 | `track-order.tsx`, `order-store.server.ts` | `order-store.test.ts` + live RPC | ✅ |
| F6 | `pricing.ts` | `pricing.test.ts` (5 cases) | ✅ |
| F7 | `auth.tsx`, `_authenticated` | manual | ✅ |
| F8 | `admin.tsx`, `admin.functions.ts` | `admin-rules.test.ts` | ✅ |
| F9 | `admin-rules.ts` | `admin-rules.test.ts` (4 cases) | ✅ |
| F10 | `pricing.ts` `mad()` | smoke | ✅ |
| F12 | zod schemas, `requireSupabaseAuth` | type-check + review | ✅ |
| N5 | `.gitignore`, `.env.example` | review | ✅ |
| N7 | `rate-limit.ts` | `rate-limit.test.ts` | ✅ |
| N8 | `vite.config.ts`, `deploy/*` | build + smoke | ✅ |
