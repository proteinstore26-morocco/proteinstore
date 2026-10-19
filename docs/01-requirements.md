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
| F4 | 4-field COD checkout with server-side re-pricing, shipping and stock checks. | `src/routes/checkout.tsx`, `src/lib/orders.functions.ts` |
| F5 | Order confirmation with order number, and tracking by order number + phone. | `checkout.tsx`, `src/routes/track-order.tsx` |
| F6 | Campaign pricing (percent/fixed, all/category/product, priority, date window). | `src/lib/pricing.ts` |
| F7 | Sign-up / sign-in, protected account area. | `src/routes/auth.tsx`, `_authenticated/*` |
| F8 | Admin: orders (status, notes), products (price, stock, status), partners (CRUD), KPIs. | `src/routes/_authenticated/admin.tsx`, `src/lib/admin.functions.ts` |
| F9 | Super Admin: list staff, grant/revoke admin, protect own and Super-Admin accounts. | `admin.functions.ts`, `src/lib/admin-rules.ts` |
| F10 | French-only UI, MAD formatting, Kénitra storefront identity, WhatsApp contact. | all routes, `src/lib/pricing.ts` |
| F11 | Public content pages: partners, about, contact; 404; sitemap-free robots policy. | `src/routes/*` |
| F12 | Server-side validation of every write (zod) and role checks on every admin read/write. | `.inputValidator`, `requireSupabaseAuth` |

## 3. Non-functional requirements

| ID | Requirement | Target / evidence |
|---|---|---|
| N1 | SSR + SEO metadata on public pages | `head()` per route, SSR verified with `curl` |
| N2 | First meaningful HTML < 1 s locally | measured 0.02–0.66 s on localhost |
| N3 | All pages usable at 360 px width | Tailwind responsive classes, mobile menu |
| N4 | WCAG 2.2 AA on core screens | partial audit — see `06-qa.md`; **not certified** |
| N5 | No secret in the client bundle | service key server-only; `.env` git-ignored |
| N6 | Order writes are authoritative server-side | prices, shipping, stock recomputed |
| N7 | Rate-limit public writes | 8 orders / 10 min / IP, 20 lookups / 10 min / IP |
| N8 | Deployable on Node 22 with no Docker | `nitro` preset `node-server`, systemd unit |
| N9 | No dependency on the Lovable editor | plain Vite/TanStack build |

## 4. Prioritised backlog (MoSCoW)

| Priority | Item | Owner |
|---|---|---|
| **Must** | F1–F9, F12, N1, N5, N6, N8 | Dev-1/4/6/7, DB, Security, Architect |
| **Must** | F10, F11 | Dev-2/6 |
| **Should** | N7 rate limiting, structured server error logging, smoke test suite | Security, QA |
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

**AC-3 — COD checkout (F4)**
- Given a cart and a valid Moroccan phone, when the customer submits the form,
  then the server recomputes line prices, shipping (30 MAD, free ≥ 500 MAD) and stock,
  creates one `orders` row plus its `order_items`, decrements stock atomically,
  and returns an order number starting with `PS`.
- Given the same product in two concurrent orders, when stock is 1, then exactly one order
  succeeds and the other receives `STOCK_RACE` with no order row left behind.

**AC-4 — Tracking (F5)**
- Given a valid order number and the matching phone, when the customer submits tracking, then
  status and items are shown; with any other phone, then no order data is returned.

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
| F4 | `orders.functions.ts` | **blocked**: needs service-role key | ⚠️ |
| F5 | `track-order.tsx`, `trackOrder` | manual (needs order) | ⚠️ |
| F6 | `pricing.ts` | `pricing.test.ts` (5 cases) | ✅ |
| F7 | `auth.tsx`, `_authenticated` | manual | ✅ |
| F8 | `admin.tsx`, `admin.functions.ts` | `admin-rules.test.ts` | ✅ |
| F9 | `admin-rules.ts` | `admin-rules.test.ts` (4 cases) | ✅ |
| F10 | `pricing.ts` `mad()` | smoke | ✅ |
| F12 | zod schemas, `requireSupabaseAuth` | type-check + review | ✅ |
| N5 | `.gitignore`, `.env.example` | review | ✅ |
| N7 | `rate-limit.server.ts` | manual/review | ✅ |
| N8 | `vite.config.ts`, `deploy/*` | build + smoke | ✅ |
