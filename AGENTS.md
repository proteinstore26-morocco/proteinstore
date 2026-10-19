# Project conventions

- Store administration lives under the managed authenticated route; every administration server
  function independently validates roles before private reads or mutations.
- Ordinary store administration uses the authenticated RLS client; privileged staff management
  loads the admin client only after validating the Super Admin role.
- Product administration edits the existing sourced catalogue instead of allowing arbitrary new
  products, preserving catalogue provenance.
- **Orders are placed through WhatsApp.** There is no public `orders` INSERT policy and no
  server-side order writer. Do not add one; the checkout builds a prefilled WhatsApp message instead.
- Never commit `.env`. Keep `.env.example` in sync and keep the service-role key server-only.
- The production target is Node 22 (`nitro` preset `node-server`) behind systemd + Caddy on
  `127.0.0.1:5077`. Do not reintroduce a Cloudflare build.
- Do not force-push or rewrite published history; keep `main` in a working state.
