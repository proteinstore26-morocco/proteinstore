# Phase 2 — Data Model (Database Expert)

Two stores back the application:

1. **Managed Supabase-compatible Postgres** — catalogue, auth, roles (10 tables, RLS).
2. **Local SQLite** (`data/proteinstore.db`, `node:sqlite`) — orders, order items, events, invoices and the
   WhatsApp log. This is the order system of record and needs no service-role key.

Sources: PostgREST OpenAPI + `src/integrations/supabase/types.ts`, `drizzle/migrations/0000_store_schema_and_seed.sql`
(reference DDL), and `src/lib/order-store.server.ts` (local schema).

## 1. ERD

```mermaid
erDiagram
  auth_users ||--o{ user_roles : "has"
  auth_users ||--|| profiles : "profile"
  auth_users ||--o{ orders : "places"
  categories ||--o{ products : "contains"
  products ||--o{ order_items : "ordered as"
  products ||--o{ reviews : "receives"
  orders ||--|{ order_items : "contains"
  campaigns }o--o{ categories : "targets"
  campaigns }o--o{ products : "targets"
  partners }o--|| partners : "gym network"

  user_roles {
    uuid id PK
    uuid user_id FK
    app_role role "customer|admin|super_admin"
  }
  profiles {
    uuid id PK "= auth.users.id"
    text full_name
    text phone
    text city
    text address
    timestamptz created_at
  }
  categories {
    uuid id PK
    text name
    text slug UK
    text description
    text image_url
    int display_order
  }
  products {
    uuid id PK
    text title
    text slug UK
    text description
    text brand
    uuid category_id FK
    int price "MAD, whole"
    int sale_price "nullable"
    int stock_quantity
    int low_stock_threshold
    text sku
    text[] image_urls
    text[] flavors
    jsonb nutrition_facts
    bool is_featured
    text status "published|draft"
    numeric rating
    int review_count
    int sold_count
    timestamptz created_at
    timestamptz updated_at
  }
  partners {
    uuid id PK
    text name
    text location
    text address
    text description
    text logo_url
    text website_url
    text instagram_url
    text discount_code
    bool is_active
    int display_order
  }
  campaigns {
    uuid id PK
    text name
    text discount_type "percent|fixed"
    int discount_value
    text applies_to_type "all|categories|products"
    uuid[] category_ids
    uuid[] product_ids
    timestamptz start_date
    timestamptz end_date
    int priority
    bool is_active
  }
  orders {
    uuid id PK
    text order_number UK
    uuid user_id FK "nullable"
    text customer_name
    text customer_email
    text customer_phone
    jsonb shipping_address "address, city, postal"
    int subtotal
    int shipping_cost
    int total
    text payment_method "cod"
    order_status status "pending|confirmed|shipped|delivered|cancelled"
    text notes
    text admin_notes
    timestamptz created_at
    timestamptz updated_at
  }
  order_items {
    uuid id PK
    uuid order_id FK
    uuid product_id FK "SET NULL"
    text product_title "snapshot"
    text variant_name "flavour"
    int quantity
    int price_at_purchase "snapshot"
  }
  reviews {
    uuid id PK
    uuid product_id FK
    uuid user_id
    text author_name
    text city
    int rating "1..5"
    text comment
    bool is_verified
    bool is_approved
    timestamptz created_at
  }
  subscribers {
    uuid id PK
    text email UK
    timestamptz created_at
  }
```

`auth.users` is managed by Supabase and is not exposed through PostgREST.

## 2. Design notes

- **Money is integer MAD.** No floats, no cents: the Moroccan retail convention here is whole
  dirhams. `unitPrice()` rounds campaign percentages to the nearest dirham.
- **Historical snapshots.** `order_items.product_title` and `price_at_purchase` are copied at
  purchase time so later catalogue edits never rewrite history.
- **Address as JSONB.** `shipping_address` keeps `{address, city, postal}` without a join; the
  columns are small and always read together.
- **Campaign targeting arrays.** `category_ids` / `product_ids` are `uuid[]`; fine for < 100
  campaigns. At scale, normalise into `campaign_targets`.
- **Enums.** `app_role` (`customer|admin|super_admin`) and `order_status`
  (`pending|confirmed|shipped|delivered|cancelled`) are Postgres enums — invalid states are
  rejected by the database, not only by the UI.

## 3. Indexes & constraints

| Object | Status |
|---|---|
| `products.slug` UNIQUE, `categories.slug` UNIQUE, `orders.order_number` UNIQUE, `subscribers.email` UNIQUE | ✅ present |
| `order_items.order_id` FK ON DELETE CASCADE | ✅ present |
| `products.stock_quantity >= 0`, `price >= 0`, `rating 1..5` | ✅ CHECK constraints |
| Index on `orders(status, created_at)` for admin queues | ⚠️ missing — add when orders grow |
| Index on `products(category_id)` and GIN on `products(flavors)` | ⚠️ missing; catalogue is 58 rows so no impact today |
| Index on `campaigns(is_active, start_date, end_date)` | ⚠️ missing; 1 campaign today |

Recommended migration (not applied — needs DB owner approval):

```sql
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category_id);
CREATE INDEX IF NOT EXISTS campaigns_active_window_idx ON public.campaigns (is_active, start_date, end_date);
```

## 4. Row-Level Security (RLS) — as implemented

| Table | anon | authenticated | admin / super_admin |
|---|---|---|---|
| `products` | SELECT published | SELECT published | ALL |
| `categories` | SELECT | SELECT | ALL |
| `partners` | SELECT active | SELECT active | ALL |
| `campaigns` | SELECT active | SELECT active | ALL |
| `reviews` | SELECT approved | SELECT approved, INSERT own unverified | ALL |
| `orders` | **none** | SELECT own, UPDATE none | SELECT/UPDATE/DELETE (admin, super_admin) |
| `order_items` | none | SELECT own order | SELECT all |
| `profiles` | none | SELECT/UPDATE own | SELECT all |
| `user_roles` | none | SELECT own | SELECT all; staff writes via service role |
| `subscribers` | INSERT only | INSERT only | SELECT |

**Consequence:** the managed `orders` table is never written by the app. Checkout writes to the local
SQLite store and then hands the order to WhatsApp; the managed table stays historical/unused. There is no
public INSERT policy and none should be added (see `AGENTS.md`).

## 5. Concurrency & integrity (local SQLite)

- **Transactions:** `createOrder` runs `BEGIN IMMEDIATE` → order + items + `created` event → `COMMIT`;
  any failure rolls back. Node's SQLite driver serialises writers in one process.
- **Numbering:** `counters` is updated with `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, so order and
  invoice numbers are gap-free per sequence (`PS-YYYY-NNNNN`, `FAC-YYYY-NNNNN`).
- **Stock:** checked against the live catalogue before insert, but **not decremented** — WhatsApp orders are
  confirmed by the shop, which owns stock in the chat. No oversell risk because no online reservation exists.
- **Immutability:** item title, variant and unit price are snapshotted in `order_items`; later catalogue edits
  never rewrite history.
- **Events:** status changes, notes, invoice issues, payments and WhatsApp sends append to `order_events`
  (append-only; no update/delete path in the app).
- **Backups:** SQLite WAL is backed up with the built-in `backup()` API (`scripts/backup-orders.mjs`), which
  is safe while the service runs.

## 6. Seed / reference data

Live backend: **58 products, 8 categories, 9 partners, 1 campaign, 5 reviews** (counts read on
19/10/2026). `drizzle/migrations/0000_store_schema_and_seed.sql` contains a smaller reference seed
(21 products, 6 categories, 9 gyms, 4 campaigns, 30 reviews, 10 orders) that documents the intended
shape; it is **not** applied to the live database automatically.

## 7. Backup & retention

- **Local orders:** `node scripts/backup-orders.mjs` writes a consistent snapshot to `data/backups/` and keeps
  the last 14. Run it daily (cron) and before every deploy that changes the schema.
- **Managed backend:** the provider manages Postgres backups; confirm the retention window in its dashboard.
- **Retention:** financial records (orders/invoices) are kept 13 months minimum. Personal data is needed to
  deliver the order; the admin can annotate/anonymise on request (no automated deletion yet).

## 8. Local order store — ERD

```mermaid
erDiagram
  orders ||--|{ order_items : contains
  orders ||--o{ order_events : logs
  orders ||--o| invoices : "invoiced by"
  orders ||--o{ whatsapp_messages : "messages"

  orders {
    text id PK
    text order_number UK
    text customer_name
    text customer_phone
    text customer_phone_norm "indexed"
    text customer_email
    text city
    text address
    text notes
    int subtotal
    int shipping
    int total
    text status "pending|confirmed|shipped|delivered|cancelled"
    text payment_status "unpaid|paid|refunded"
    text created_at
    text updated_at
  }
  order_items {
    text id PK
    text order_id FK
    text product_slug
    text product_title "snapshot"
    text variant
    int quantity
    int unit_price "snapshot"
    int line_total
  }
  order_events {
    int id PK
    text order_id FK
    text type "created|status|note|invoice|payment|whatsapp"
    text message
    text actor
    text created_at
  }
  invoices {
    text id PK
    text number UK
    text order_id FK "unique"
    text status "issued|paid|void"
    text issued_at
    text paid_at
    text notes
  }
  whatsapp_messages {
    int id PK
    text phone
    text order_id FK
    text template
    text body
    text created_at
    text sent_by
  }
  counters {
    text name PK
    int value
  }
```

Indexes: `orders(created_at DESC)`, `orders(customer_phone_norm)`, `orders(status, created_at DESC)`,
`order_items(order_id)`, `order_events(order_id, id)`, `whatsapp_messages(order_id, id)`.

Accessed only by server modules (`order-store.server.ts`); the DB file is never exposed by Caddy.
