# Partner logos

## Admin

`/admin/store` → **Partenaires** → **Modifier** → **Logo du partenaire**.

- Upload PNG / JPEG / WebP (resized in the browser to max 600 px, transparency preserved as PNG).
- Or paste an `https://…` URL.
- Preview on a white tile, remove button, then **Enregistrer**.
- The logo also appears on the partner cards inside the admin.

## Public site

| Page                  | Display                                           |
| --------------------- | ------------------------------------------------- |
| `/partners`           | Logo on a white tile above the gym name (if set)  |
| `/` — partner marquee | Small logo before the name, grayscale until hover |
| No logo               | Fallback to the name only                         |

## Storage

- Server path: `/srv/proteinstore-shared/uploads/partners/` (`UPLOAD_DIR`)
- URL stored in `partners.logo_url`: `/uploads/partners/<uuid>.<png|jpg|webp>`
- Served by Caddy on both production and test (`handle /uploads/*`).
- Included in `scripts/backup-uploads.sh`.
- Partner logos uploaded or linked are validated by `partnerEditSchema` (HTTPS or `/uploads/partners/...`).

## Security

Admin/root only; 40 uploads / 10 min; max 4 MB; magic-byte + MIME validation; random UUID filenames;
no user-controlled path. External logos are hotlinked, so rights and availability remain the partner's
responsibility.
