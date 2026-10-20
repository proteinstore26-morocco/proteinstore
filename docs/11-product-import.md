# Product import (draft-only)

`/admin/import` lets an `admin` or `root` import third-party products as **drafts**. Drafts never reach the
public storefront, sitemap, search or tracking until an admin edits and publishes them.

## Gérer les domaines autorisés (IMPORT_ALLOWED_HOSTS)

`/admin/import` contient une section **« Domaines autorisés (IMPORT_ALLOWED_HOSTS) »** :

- les domaines de la variable serveur sont affichés avec le badge **env** et ne peuvent pas être retirés ici ;
- un administrateur peut **ajouter** un domaine public (ex. `boutique-exemple.com`) ou **retirer** un domaine
  ajouté via l'interface ;
- les ajouts sont stockés dans la table `import_hosts` de `data/proteinstore.db`, prennent effet immédiatement
  pour l'import URL et la résolution d'images HTML, et sont audités (`import.host.added` / `removed` dans le
  journal root) ;
- la validation refuse protocoles/chemins/ports, adresses IP, `localhost` et suffixes locaux/internes
  (`.local`, `.internal`, `.test`, `.invalid`, `.onion`) ;
- un domaine ajouté n'autorise que HTTPS et reste soumis à `robots.txt` et aux limites de taille/temps.

## Two import modes

### 1. From a URL

The server looks for a Shopify product feed:

```
https://<allowlisted-host>/products.json?limit=250
```

- Host must be in `IMPORT_ALLOWED_HOSTS` (default: `powernutritionstore.de`, `www.powernutritionstore.de`).
- HTTPS only, redirects validated against the same allowlist, 8 MB / 20 s limits.
- `robots.txt` is checked before the feed is fetched; a disallowed path aborts the import.
- If the site blocks automated access (Cloudflare, 403), the importer **does not try to bypass it** and tells
  the admin to use HTML mode.

### 2. From HTML saved in the browser

Open the product or category page in a normal browser, save it (Ctrl/Cmd+S) or copy its HTML, then upload/paste
it. The parser reads, in order:

1. **JSON-LD `Product`** (schema.org) — best quality: title, description, brand, image, price.
2. **Open Graph** — only when the page signals a product (`og:type=product`, `product:price:amount` or a
   `/product/` URL).
3. **Product cards** on a saved category page — titles and images from links containing
   `/product/`, `/products/`, `/detail/`, `/artikel/` or `/p/`.

Category-page cards have no descriptions; drafts fall back to the title and can be enriched by the admin.
HTML is capped at 1.5 MB and yields at most 60 products (50 shown, 30 importable per batch).

## What the importer writes

| Field                 | Value                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `status`              | **`draft`**                                                           |
| `price`               | `0`                                                                   |
| `sale_price`          | `null`                                                                |
| `stock_quantity`      | `0`                                                                   |
| `low_stock_threshold` | `5`                                                                   |
| `image_urls`          | source HTTPS image URLs (max 8)                                       |
| `brand`               | source vendor                                                         |
| `category_id`         | guessed from title/type/tags against existing categories, else `null` |
| `flavors`             | source flavour option values                                          |
| `description`         | French text + source URL + "traduction automatique à relire"          |
| `title`               | French title                                                          |
| `slug`                | slugified source handle (duplicates are skipped)                      |

Price and stock are **not** imported by design: the admin sets them before publishing. Drafts are hidden by
Supabase RLS (`status='published' OR admin`), so the public catalogue and sitemap never include them.

## Translation

- **Default (offline):** German/English supplement glossary → French (`Whey Protein` → `protéine whey`,
  `Kreatin` → `créatine`, `Geschmack` → `saveur`, etc.). Full sentences are not translated; the description is
  marked "traduction automatique à relire".
- **Full translation (optional):** set `DEEPL_API_KEY` (and optionally `DEEPL_API_URL`) in `.env`. Titles and
  descriptions are translated through DeepL; on failure the glossary is used.

## Legal / content rights

The importer is a tool, not a licence. The admin must confirm they have the rights to reuse the product text
and images. Imported images are referenced by their source URL (hotlinked), which may also expose visitor IPs to
the source CDN. Replace images with owned assets before publishing if needed.

## Publish workflow

1. `/admin/import` → import drafts.
2. `/admin/store` → **Produits** → edit a draft: price, stock, description, category, image.
3. Set `status = published` and save; the product then appears publicly.
4. Before publishing, check the description translation and the source image rights.

## Configuration

| Variable               | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `IMPORT_ALLOWED_HOSTS` | Comma-separated host allowlist (SSRF guard) |
| `DEEPL_API_KEY`        | Optional DeepL key for full translation     |
| `DEEPL_API_URL`        | Optional DeepL endpoint (default free API)  |
