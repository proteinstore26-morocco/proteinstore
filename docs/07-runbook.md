# Phase 5 — Runbook & Operations (Architect + QA)

## 1. What is deployed

| Item | Value |
|---|---|
| URL | https://proteinstore.46.225.2.52.sslip.io |
| Target domain | `proteinestore.pro` — **waiting for DNS A record → `46.225.2.52`** |
| Service | `proteinstore.service` (systemd, enabled) |
| Bind | `127.0.0.1:5077` |
| Reverse proxy | Caddy 2.11, automatic TLS, vhost appended to `/etc/caddy/Caddyfile` |
| Code | `/root/Said/proteinstore` |
| Runtime env | `/root/Said/proteinstore/.env` (chmod 600) |
| Logs | `journalctl -u proteinstore -f` |
| Data | Managed Supabase-compatible backend; orders travel through WhatsApp |
| Isolation | New unit, new port, new hostname. No shared unit was restarted; Caddy was **reloaded** |
| Caddy backup | `/etc/caddy/Caddyfile.bak.1792400679` |

## 2. Ordering model (important)

Checkout does **not** write to the database. The customer's form is turned into a prefilled message
and the browser is redirected to `https://wa.me/212776566089`. There is no service-role key in the
path, no `orders` INSERT, and no order confirmation screen. `/track-order` is a WhatsApp handoff.

Consequences:

- New orders appear in the shop's WhatsApp chat, not in `/admin`.
- The admin order queue only contains historical rows (currently zero).
- The shop must archive/confirm orders manually. A WhatsApp Business API integration or a Google
  Sheet export is the recommended next step for order records and analytics.

## 3. Prerequisites

- Node.js 22 (`/usr/bin/node`), npm 10+
- Caddy 2.11 running, ports 80/443 reachable
- Network access to the managed backend and Google Fonts
- No Docker required

## 4. Environment

```bash
cp .env.example .env
chmod 600 .env
# fill SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / VITE_* from the backend dashboard
```

`VITE_*` values are inlined into the client bundle **at build time**; changing them requires a
rebuild. `SUPABASE_SERVICE_ROLE_KEY` is optional and only used by privileged staff administration.

## 5. Local development

```bash
npm install --legacy-peer-deps   # npm 10.9 peer-resolution bug on this graph
npm run dev                      # plain Vite + TanStack Start, prints its URL
```

> If your shell exports `NODE_ENV=production`, add `--include=dev` to the install command.

## 6. Build

```bash
npm ci --legacy-peer-deps
npm test          # 15 tests
npx tsc --noEmit
npm run build     # → .output/server/index.mjs (node-server preset)
```

## 7. Deploy / update

```bash
./deploy/deploy.sh
```

Or manually:

```bash
NODE_ENV=development npm install --legacy-peer-deps --include=dev --no-audit --no-fund
npm test && npm run build
systemctl restart proteinstore      # our isolated unit only
node scripts/smoke.mjs https://proteinstore.46.225.2.52.sslip.io
```

First-time setup (already done):

```bash
install -m 644 deploy/proteinstore.service /etc/systemd/system/proteinstore.service
systemctl daemon-reload && systemctl enable --now proteinstore
# append deploy/Caddyfile.snippet to /etc/caddy/Caddyfile, then:
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

## 8. Switching to proteinestore.pro

1. At the registrar/DNS provider, create:
   - `A  @    46.225.2.52`
   - `A  www  46.225.2.52`
2. Confirm propagation: `getent hosts proteinestore.pro` (or `dig +short proteinestore.pro`).
3. In `deploy/Caddyfile.snippet`, uncomment the `proteinestore.pro, www.proteinestore.pro` block.
   Append it to `/etc/caddy/Caddyfile`.
4. Validate, reload, verify:
   ```bash
   caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
   curl -sI https://proteinestore.pro | head
   ```
5. Optionally redirect the sslip.io host to the domain in Caddy and update the `og:url`/README.

## 9. Verify

```bash
systemctl is-active proteinstore
curl -sI https://proteinstore.46.225.2.52.sslip.io | head -20
node scripts/smoke.mjs https://proteinstore.46.225.2.52.sslip.io
journalctl -u proteinstore -n 50 --no-pager
```

Expected: 17/17 smoke checks, TLS verify ok, HSTS/CSP present, checkout shows “Commander sur
WhatsApp”.

## 10. Rollback

```bash
# 1) restore the previous Caddy config (if the vhost itself is the problem)
cp /etc/caddy/Caddyfile.bak.1792400679 /etc/caddy/Caddyfile
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

# 2) stop the app (does not affect any other service)
systemctl disable --now proteinstore

# 3) restore the previous build if kept
rm -rf .output && mv .output.prev .output && systemctl start proteinstore
```

## 11. Routine operations

| Task | Command |
|---|---|
| Tail app logs | `journalctl -u proteinstore -f` |
| Tail proxy logs | `journalctl -u caddy -f` |
| Restart app only | `systemctl restart proteinstore` |
| Check port | `ss -ltnp \| grep 5077` |
| Check TLS | `curl -vI https://proteinstore.46.225.2.52.sslip.io` |
| Disk usage | `du -sh /root/Said/proteinstore/.output` |

**Never** `systemctl restart caddy` or restart shared `ted-studio`/`ao-*` units for this app.

## 12. Backups

- Application code: git repository.
- Database: managed by the backend provider; confirm the retention window in its dashboard.
- Orders: the WhatsApp chat is the primary record. Export or connect the WhatsApp Business API
  before volume grows.
- Caddy/systemd: copies live in `deploy/`; the Caddyfile backup is timestamped on each edit.

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 502 from Caddy | Node process down or port mismatch | `systemctl status proteinstore`, check `PORT=5077` |
| WhatsApp does not open | Pop-up blocker, desktop without WhatsApp Web session | The redirect is same-tab; open `https://wa.me/212776566089` manually |
| Message too long | Unusually large cart | WhatsApp truncates the URL; ask the customer to split the order |
| Catalogue empty / error page | Backend paused or network | check `curl "$SUPABASE_URL/rest/v1/"` with the publishable key |
| TLS warning on proteinestore.pro | DNS not pointing here yet | add the A records, then enable the vhost |
| Slow first paint | Google Fonts blocked | self-host fonts (next step) |

## 14. Known limitations

1. WhatsApp orders are not stored in the database (no admin queue, analytics or reconciliation).
2. `/track-order` is a chat handoff, not a live status lookup.
3. No browser E2E; no automated accessibility audit.
4. No admin audit log, no MFA.
5. French only; no Arabic/RTL toggle.
6. `drizzle/` schema is reference-only.
7. No WhatsApp Business API: replies come from the shop phone.

## 15. Next steps (roadmap)

| Priority | Item |
|---|---|
| P0 | Create the `proteinestore.pro` A records and enable the vhost |
| P1 | Order archive: WhatsApp Business API or Sheet export, then a read-only admin order view |
| P1 | Playwright E2E (cart → WhatsApp URL) and axe checks in CI |
| P1 | Admin audit log + MFA |
| P2 | Self-host fonts, sitemap.xml, image optimisation |
| P2 | Arabic version with RTL |
| P3 | CMI/Stripe card payments, B2B tiers, rider tracking |
