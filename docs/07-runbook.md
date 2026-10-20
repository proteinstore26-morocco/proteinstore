# Phase 5 — Runbook & Operations (Architect + QA)

A separate test instance runs on port 5078 — see [08-staging.md](08-staging.md).

## 1. What is deployed

| Item | Value |
|---|---|
| URL | https://proteinstore.46.225.2.52.sslip.io |
| Target domain | `proteinestore.pro` — DNS A record → `46.225.2.52` still required |
| Service | `proteinstore.service` (systemd, enabled) |
| Bind | `127.0.0.1:5077` |
| Data | `data/proteinstore.db` (SQLite WAL), writable via `ReadWritePaths` |
| Backups | `data/backups/` — last 14 snapshots |
| Reverse proxy | Caddy 2.11, TLS, security headers |
| Code | `/root/Said/proteinstore` |
| Logs | `journalctl -u proteinstore -f` |
| Managed backend | Catalogue/auth/roles only; orders are local |

## 2. Ordering model

1. Checkout calls `createOrder` → server re-prices from the live catalogue → SQLite transaction
   (order + items + event) → WhatsApp message logged → `wa.me` URL returned.
2. Browser redirects to WhatsApp; the shop confirms in the chat.
3. Admin actions in `/admin` change status and **generate a WhatsApp message** to the customer's number:
   confirmation, shipping, delivery, cancellation, invoice, payment, free-form.
4. Public `/track-order` reads the same order/event log (order number + phone).

The service-role key is **not** required for any of this.

## 3. Environment

```bash
cp .env.example .env
chmod 600 .env
# SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / VITE_* from the backend dashboard
# optional: SUPABASE_SERVICE_ROLE_KEY (staff admin), ORDER_DB_PATH, VITE_SITE_URL
```

`VITE_*` values are compiled into the client bundle; rebuild after changing them.

## 4. Local development

```bash
npm install --legacy-peer-deps   # npm 10.9 peer bug on this graph
npm run dev
```

If `NODE_ENV=production` is exported, add `--include=dev`.

## 5. Build & verify

```bash
npm ci --legacy-peer-deps
npm test          # 40 tests
npx tsc --noEmit
npm run build     # server + public/sitemap.xml (postbuild)
```

## 6. Deploy / update

```bash
./deploy/deploy.sh
```

The script installs, typechecks, tests, **backs up SQLite**, builds (with sitemap), restarts the isolated
unit and runs the 21-check smoke test.

First-time setup (already done):

```bash
install -m 644 deploy/proteinstore.service /etc/systemd/system/proteinstore.service
systemctl daemon-reload && systemctl enable --now proteinstore
# append deploy/Caddyfile.snippet to /etc/caddy/Caddyfile, then:
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

## 7. Switching to proteinestore.pro

1. DNS: `A @ 46.225.2.52` and `A www 46.225.2.52`.
2. Confirm: `getent hosts proteinestore.pro`.
3. Uncomment the `proteinestore.pro, www.proteinestore.pro` block in `deploy/Caddyfile.snippet` and append it.
4. `caddy validate …`, `caddy reload …`, then `curl -sI https://proteinestore.pro`.
5. Set `VITE_SITE_URL=https://proteinestore.pro` in `.env`, rebuild (sitemap/JSON-LD), restart.
6. Optionally redirect the sslip.io host to the domain.

## 8. Admin access

No password is stored on this host. Use `/auth` → **Mot de passe oublié ?** → `/auth/reset`. The backend must
allow the reset redirect URL and have SMTP configured. Full procedure and role SQL: [09-admin-access.md](09-admin-access.md).

## 9. Backup & restore

```bash
node scripts/backup-orders.mjs          # consistent snapshot (safe while running)
ls -lh data/backups/                    # 14 kept
```

Restore:

```bash
systemctl stop proteinstore
cp data/backups/proteinstore-<stamp>.db data/proteinstore.db
rm -f data/proteinstore.db-wal data/proteinstore.db-shm
systemctl start proteinstore
```

Backups contain personal data — encrypt them off-host (`age`, `gpg`) before copying.

## 10. Verify

```bash
systemctl is-active proteinstore
node scripts/smoke.mjs https://proteinstore.46.225.2.52.sslip.io   # 21 checks
journalctl -u proteinstore -n 50 --no-pager
```

## 11. Rollback

```bash
cp /etc/caddy/Caddyfile.bak.1792400679 /etc/caddy/Caddyfile && caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl disable --now proteinstore
rm -rf .output && mv .output.prev .output && systemctl start proteinstore
```

## 12. Routine operations

| Task | Command |
|---|---|
| Tail logs | `journalctl -u proteinstore -f` |
| Restart app only | `systemctl restart proteinstore` |
| Check port | `ss -ltnp \| grep 5077` |
| Backup | `node scripts/backup-orders.mjs` |
| DB size | `du -h data/proteinstore.db*` |
| Sitemap | `npm run sitemap` |

**Never** restart Caddy or shared `ted-studio`/`ao-*` units for this app.

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 502 from Caddy | Node down / port mismatch | `systemctl status proteinstore` |
| `SQLITE_CANTOPEN` | `data/` not writable | check `ReadWritePaths`, `ls -ld data` |
| `database is locked` | long write / external tool | retry; WAL allows readers; avoid writing with external sqlite CLIs |
| Checkout 500 | backend catalogue unreachable | `curl "$SUPABASE_URL/rest/v1/"` with the publishable key |
| Admin shows "Accès réservé" | user has no `admin` role | grant role via Supabase/Lovable admin |
| WhatsApp doesn't open | pop-up/desktop session | open `https://wa.me/212776566089` manually |
| Sitemap 404 | build ran without postbuild | `npm run sitemap`, redeploy |

## 14. Known limitations

1. WhatsApp messages are opened by an admin; no Business API auto-send.
2. SQLite is single-host (no replication); backups are manual/cron.
3. PII in SQLite and backups is unencrypted.
4. No browser E2E, axe audit, MFA or global admin audit log.
5. French only; no Arabic/RTL.
6. `drizzle/` is reference-only.

## 15. Roadmap

| Priority | Item |
|---|---|
| P0 | `proteinestore.pro` DNS + vhost; set `VITE_SITE_URL` and rebuild |
| P1 | Encrypted off-host backups; privacy notice; MFA |
| P1 | Playwright E2E (checkout → tracking → admin) + axe in CI |
| P2 | WhatsApp Business API for automatic sending and delivery receipts |
| P2 | Admin audit log, CSV export, low-stock alerts |
| P3 | Card payments, B2B tiers, Arabic/RTL |
