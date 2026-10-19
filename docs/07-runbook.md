# Phase 5 — Runbook & Operations (Architect + QA)

## 1. What is deployed

| Item | Value |
|---|---|
| URL | https://proteinstore.46.225.2.52.sslip.io |
| Service | `proteinstore.service` (systemd, enabled) |
| Bind | `127.0.0.1:5077` |
| Reverse proxy | Caddy 2.11, automatic TLS, vhost appended to `/etc/caddy/Caddyfile` |
| Code | `/root/Said/proteinstore` |
| Runtime env | `/root/Said/proteinstore/.env` (chmod 600) |
| Logs | `journalctl -u proteinstore -f` |
| Data | Lovable Cloud (Supabase-compatible), unchanged |
| Isolation | New unit, new port, new hostname. No shared unit was restarted; Caddy was **reloaded** |
| Caddy backup | `/etc/caddy/Caddyfile.bak.1792400679` |

## 2. Prerequisites

- Node.js 22 (`/usr/bin/node`), npm 10+
- Caddy 2.11 already running
- Network access to the Lovable Cloud backend and to Google Fonts
- No Docker required

## 3. Environment

```bash
cp .env.example .env
chmod 600 .env
# fill SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / VITE_* from the Lovable project
# and, for COD checkout, SUPABASE_SERVICE_ROLE_KEY (server-only)
```

`VITE_*` values are inlined into the client bundle **at build time**; changing them requires a
rebuild. The service-role key is read **at runtime** and must never be prefixed with `VITE_`.

## 4. Local development

```bash
npm install --legacy-peer-deps   # npm 10.9 has a peer-resolution bug on this graph
npm run dev                      # Vite dev server
```

> If your shell exports `NODE_ENV=production`, add `--include=dev` to the install command.

## 5. Build

```bash
npm ci --legacy-peer-deps
npm test          # 14 tests
npx tsc --noEmit
npm run build     # → .output/server/index.mjs (node-server preset)
```

## 6. Deploy / update

```bash
./deploy/deploy.sh
```

Or manually:

```bash
npm install --legacy-peer-deps --no-audit --no-fund
npm test && npm run build
systemctl restart proteinstore      # our isolated unit only
node scripts/smoke.mjs https://proteinstore.46.225.2.52.sslip.io
```

The first-time setup (already done) was:

```bash
install -m 644 deploy/proteinstore.service /etc/systemd/system/proteinstore.service
systemctl daemon-reload && systemctl enable --now proteinstore
# append deploy/Caddyfile.snippet to /etc/caddy/Caddyfile, then:
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

## 7. Verify

```bash
systemctl is-active proteinstore
curl -sI https://proteinstore.46.225.2.52.sslip.io | head -20
node scripts/smoke.mjs https://proteinstore.46.225.2.52.sslip.io
journalctl -u proteinstore -n 50 --no-pager
```

Expected: 15/15 smoke checks, `SSL certificate verify ok`, HSTS/CSP headers present.

## 8. Rollback

```bash
# 1) restore the previous Caddy config (if the vhost itself is the problem)
cp /etc/caddy/Caddyfile.bak.1792400679 /etc/caddy/Caddyfile
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

# 2) stop the app (does not affect any other service)
systemctl disable --now proteinstore

# 3) restore the previous build if kept
rm -rf .output && mv .output.prev .output && systemctl start proteinstore
```

## 9. Routine operations

| Task | Command |
|---|---|
| Tail app logs | `journalctl -u proteinstore -f` |
| Tail proxy logs | `journalctl -u caddy -f` |
| Restart app only | `systemctl restart proteinstore` |
| Check port | `ss -ltnp \| grep 5077` |
| Check TLS | `curl -vI https://proteinstore.46.225.2.52.sslip.io` |
| Disk usage | `du -sh /root/Said/proteinstore/.output` |

**Never** `systemctl restart caddy` or restart shared `ted-studio`/`ao-*` units for this app.

## 10. Backups

- Application code: git repository.
- Database: managed by Lovable Cloud. **Confirm the retention window in the dashboard.**
- Recommended off-host dump: weekly `pg_dump` to an encrypted bucket (not configured).
- Caddy/systemd: copies live in `deploy/`; the Caddyfile backup is timestamped on each edit.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 502 from Caddy | Node process down or port mismatch | `systemctl status proteinstore`, check `PORT=5077` |
| Checkout says "indisponible" | `SUPABASE_SERVICE_ROLE_KEY` missing | add key to `.env`, `systemctl restart proteinstore` |
| Checkout rejects phone | regex expects `06/07…` or `+2126…` | normalise the number |
| Catalogue empty / error page | backend paused or network | check `curl "$SUPABASE_URL/rest/v1/"` with the publishable key |
| TLS warning | certificate not issued yet | `journalctl -u caddy -n 50`; ensure port 80 reachable |
| Slow first paint | Google Fonts blocked | self-host fonts (next step) |

## 12. Known limitations

1. **COD checkout is disabled** until the service-role key is provided (D-01).
2. No browser E2E; no automated accessibility audit.
3. Rate limiting is per-process and in-memory (resets on restart).
4. No admin audit log, no MFA, no idempotency key.
5. French only; no Arabic/RTL toggle.
6. No sitemap.xml; robots.txt allows crawlers.
7. Google Fonts is a third-party request (GDPR consideration).
8. `drizzle/` schema is reference-only; the live schema lives in Lovable Cloud.

## 13. Next steps (roadmap)

| Priority | Item |
|---|---|
| P0 | Provide service-role key, run a real COD order, close D-01 |
| P0 | Point a real domain (e.g. proteinestore.ma) to `46.225.2.52` and swap the vhost |
| P1 | Admin audit log + idempotency key + MFA for admins |
| P1 | Playwright E2E (cart → COD → tracking) and axe checks in CI |
| P2 | Self-host fonts, add sitemap.xml, image optimisation |
| P2 | Arabic version with RTL |
| P3 | CMI/Stripe card payments, B2B tiers, delivery-rider tracking |
