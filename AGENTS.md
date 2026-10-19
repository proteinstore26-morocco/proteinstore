# Project conventions

- Store administration lives under the managed authenticated route; every administration server
  function independently validates roles before private reads or mutations.
- Ordinary store administration uses the authenticated RLS client; privileged staff management
  loads the admin client only after validating the Super Admin role.
- Product administration edits the existing sourced catalogue instead of allowing arbitrary new
  products, preserving catalogue provenance.
- **Orders live in the local SQLite store** (`src/lib/order-store.server.ts`) and are mirrored to WhatsApp
  after checkout. Do not add an `orders` INSERT policy to the managed backend; that table remains unused.
- Every customer-facing admin action must generate a WhatsApp message and log it with `recordWhatsApp`
  (`order_events` + `whatsapp_messages`). Internal notes stay internal.
- `data/` must stay writable by the service (`ReadWritePaths`) and out of git; back it up before deploys.
- Never commit `.env`. Keep `.env.example` in sync and keep the service-role key server-only.
- The production target is Node 22 (`nitro` preset `node-server`) behind systemd + Caddy on
  `127.0.0.1:5077`. Do not reintroduce a Cloudflare build.
- Do not force-push or rewrite published history; keep `main` in a working state.
