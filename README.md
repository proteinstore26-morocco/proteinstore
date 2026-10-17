# Proteinstore

4 Questions Answered

1. Language handling for the UI?

   French-only copy, RTL-safe layout, no language switcher (Recommended)

2. How should I sequence this build? (Backend + full storefront + full admin is a very large surface.)

   Everything in one pass (backend, storefront, cart/checkout, auth, full admin)

3. Payment methods at checkout?

   COD only (Paiement à la livraison) — no card, no Stripe (Recommended)

4. Product and gym-logo imagery for seed data?

   use our instagram page : https://www.instagram.com/proteinestore?cplk=NGNxY3ozb2drejVx&utm_source=qr
Whatsapp business  +212776566089

I'll explore the current project structure before planning this large build.

This is a large build on a bare template (React 19 + RR v7 + Tailwind 3 + Tailwind Animate, no backend connected yet). Before writing the plan, four decisions shape the work significantly.
Backend (live, but currently paused)
12 tables with RLS enabled in the same migrations that created them: products, categories, variants, orders, order_items, campaigns, partners, carousels, profiles, reviews, plus site_settings and subscribers (needed for a working settings page and newsletter). Verified via policy counts on every table.
Public media bucket (products/partners/banners), writes restricted to admins.
profiles auto-created by trigger; admin@proteinestore.ma becomes admin on signup; a trigger blocks role escalation.
Backend functions create-order (prices, campaign discounts, shipping and stock recomputed server-side) and track-order (order number + phone must match). Exercised directly: valid order → 200 with correct totals, out-of-stock → 409, invalid payload → 400, wrong phone → 404.
Seed: 6 rayons, 21 products with real prices/variants/nutrition/images, 9 Kénitra gyms, 4 campaigns (one live for the countdown), 3 carousels, 30 verified reviews, 10 orders across every status, store settings.
Storefront + admin

Home (all 13 sections, including the two-row partner marquee with grayscale→color hover, red glow and reduced-motion fallback), shop with full filters/sort/load-more, product detail (gallery, variants, tabs, reviews), cart drawer, 4-step COD checkout, confirmation with confetti, track order, partners, about, contact, auth and account; admin with dashboard charts, products (bulk actions + inline price/stock), categories, orders (status flow, notes, print), campaigns, carousels, partners, customers, analytics and settings. Admin is code-split and guarded by role, with RLS as the real gate.

Blocked by infrastructure

Your Cloud instance is currently paused ("instance status is pausing"), so products/orders/stocks don't load right now — this is why the shop screenshots show empty cards. Every network attempt to the backend host is refused. Resume it (it's an instance-level action, not something I can trigger) and the data comes back immediately.

Because of that pause I could not re-verify these after the pause started: UI checkout end-to-end, post-deploy integer price rounding (client and function now both round to whole dirhams), and the admin screens with live rows. Everything else was verified with real data beforehand.

I also added a request timeout so a stalled backend shows a "Catalogue indisponible / Réessayer" state instead of endless skeletons.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://proteinstore.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e1681b59-920c-4e0e-ba7c-09f81ac5c1d2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
