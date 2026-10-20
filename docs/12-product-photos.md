# Product photos (1–5 per product)

Available in `/admin/store` → **Produits** → **Modifier** → **Photos du produit**.

## Usage

- **URL:** paste an `https://…` image URL and click **Ajouter l'URL**.
- **Local upload:** click an empty slot or **Choisir des photos**, select up to 5 JPEG/PNG/WebP files.
- Reorder is not available; remove a photo with the trash button and add it again.
- Maximum **5 photos**; the limit is enforced in the UI and in the server schema.
- The first photo is the main product image (product page, cards, JSON-LD).

Uploaded files are resized in the browser to max 1400 px and encoded as JPEG before being sent, so a phone
photo does not hit the server at full resolution. PNG/WebP uploads become JPEG with a white background.

## Storage & serving

| Item        | Value                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| Server path | `/srv/proteinstore-shared/uploads/products/` (`UPLOAD_DIR`)                |
| Public URL  | `/uploads/products/<uuid>.<jpg\|png\|webp>`                                |
| Serving     | Caddy `handle /uploads/* → file_server` on both instances                  |
| Shared      | Production and test read the same directory, so photos work on both        |
| Backup      | `./scripts/backup-uploads.sh` (last 7 archives in `data/backups/uploads/`) |
| Local dev   | Vite middleware serves `UPLOAD_DIR` (default `data/uploads`)               |

Uploads are **not** stored in Supabase Storage (no bucket exists on the backend). The URL saved in
`products.image_urls` is a relative `/uploads/...` path, so the same product renders on production and test.

## Validation & security

- Admin/root only; local role guard on every upload call.
- Rate limit: 40 uploads / 10 min / admin.
- Max 4 MB per file after the client resize; max 5 photos per product.
- Server checks magic bytes (JPEG/PNG/WebP) **and** that they match the declared MIME type.
- Filenames are random UUIDs; no user-controlled path, no directory traversal.
- Caddy only exposes `/uploads/*`; directory listing is disabled.
- Orphan files are not deleted automatically when a photo is removed from a product; clean
  `/srv/proteinstore-shared/uploads/products/` periodically.

## Limit

The product editor allows **0–5** photos so existing catalogue items without images remain editable; the
goal is 1–5. A published product without any photo still falls back to its category image on the storefront.
