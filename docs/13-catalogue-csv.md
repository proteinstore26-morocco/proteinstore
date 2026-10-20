# Catalogue CSV — import & export

Admin page: **`/admin/catalogue`** (admin/root).

## 1. Format decision

**CSV UTF-8 with BOM, semicolon separator (`;`), CRLF line endings.** It opens directly in Excel (French
locale), Google Sheets and LibreOffice, has no dependency, and is safer to parse than XLSX. Export adds the
BOM so Excel detects UTF-8 accents. Import auto-detects `;`, `,` or tab, so a comma CSV also works.

XLSX is not parsed: export the sheet as “CSV UTF-8” first.

### Headers (exact, 11 columns)

```
Nom du produit;Marque;Catégorie;Statut de Publication;Produit mis en avant;Prix (MAD);Prix promotionnel (MAD);Stock;Seuil d’alerte stock;Saveurs;Description
```

### Two example rows

```
Whey Isolate Premium 2kg;NutriLab;Whey & Protéines;Publié;Oui;459;399;24;5;"Chocolat, Vanille, Fraise";"Whey isolate 90 %, 66 portions. Produit authentique, livraison au Maroc."
Créatine Monohydrate 300g;PowerFuel;Créatine;Brouillon;Non;149;;0;3;Neutre;"Créatine monohydrate micronisée, 60 portions."
```

The same content is available from **Modèle** in the UI.

## 2. UI

### Export

- Filters: **category**, **status** (all/published/draft), **search** (name/brand).
- **Exporter** downloads `catalogue-proteinstore-YYYY-MM-DD.csv`.
- **Modèle** downloads the 11 headers + the two example rows.
- Drafts are only included when “Brouillon” or “Tous” is selected.

### Import

- Drag & drop zone or click-to-select (`.csv`, 5 MB max).
- Progress bar: reading → validation → import.
- **Preview:** total lines, valid, creations, updates, invalid.
- Table per line with action (`Création`, `Mise à jour`, `Erreur`), target product for updates, and error list.
- **Rapport d'erreurs** downloads `Ligne;Nom du produit;Marque;Erreur` (includes import failures).
- **Importer N lignes valides** writes only valid rows; invalid rows are ignored and reported.
- Preview is capped at 500 displayed rows; import is capped at 2000 rows.

## 3. Validation rules

| Field                 | Rule                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| Nom du produit        | required, 2–200 chars                                                |
| Marque                | optional, ≤ 100 chars                                                |
| Catégorie             | one of the 9 labels (or slug), required                              |
| Statut de Publication | `Publié` / `Brouillon` (also accepts published/draft)                |
| Produit mis en avant  | `Oui`/`Non`, `1`/`0`, `true`/`false`; empty = Non                    |
| Prix (MAD)            | integer ≥ 0, required                                                |
| Prix promotionnel     | optional integer ≥ 0, must be ≤ price                                |
| Stock                 | integer ≥ 0, required                                                |
| Seuil d’alerte stock  | integer ≥ 0, required                                                |
| Saveurs               | comma-separated, trimmed, deduplicated, ≤ 50 values, ≤ 60 chars each |
| Description           | optional, ≤ 10 000 chars, text/HTML stored as-is (React escapes it)  |

- Missing/unknown headers: missing required headers block the import; extra columns are reported and ignored.
- Row numbers in errors are data-record positions (header = line 1).
- Duplicates inside the file (same normalized Nom + Marque) are rejected on the second occurrence.
- `category_id` is resolved from existing `categories`; a label that does not exist in the DB is an error.

## 4. Comportement en cas d'erreur

- Une ligne avec **au moins un champ invalide** est entièrement ignorée : aucun champ n'est écrit partiellement.
- L'import **continue** avec les lignes suivantes ; les lignes valides sont créées ou mises à jour.
- Les lignes ignorées sont listées dans le rapport d'erreurs (`Ligne;Nom;Marque;Erreur`).
- Un en-tête manquant bloque tout l'import (impossible de mapper les colonnes) ; un fichier sans aucune ligne
  valide affiche une erreur et n'écrit rien.
- Les erreurs d'écriture Supabase (droits, doublon ambigu) sont propres à la ligne et n'interrompent pas les
  autres.
- L'import n'est pas une transaction globale : les lignes valides déjà écrites restent en place.

## 5. Duplicate handling

Existing products are indexed by `normalize(Nom) + normalize(Marque)` (accents, case and punctuation
insensitive).

- **One match** → `UPDATE`: title, brand, category, status, featured, price, sale price, stock, threshold,
  flavours, description.
- **No match** → `INSERT`: new unique slug generated from the name, `image_urls: []`, rating/reviews/sold at 0.
- **Several matches** → line rejected (ambiguous), no write.
- The update preserves `slug`, `image_urls`, `sku`, `nutrition_facts`, reviews and sales counters.

## 6. Implementation

| File                                            | Role                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/catalogue-csv.ts`                      | headers, categories, CSV parser, validation, template, formula guard |
| `src/lib/catalogue.functions.ts`                | export, categories/template, preview, import                         |
| `src/components/admin/CatalogueIoPanel.tsx`     | export filters, drag & drop, preview, report                         |
| `src/routes/_authenticated/admin.catalogue.tsx` | admin page `/admin/catalogue`                                        |
| `src/test/catalogue-csv.test.ts`                | 7 tests (round-trip, delimiters, errors, duplicates, formula guard)  |

Security: admin/root only, 5 MB / 2000 rows, CSV formula-injection guard (`'` prefix on export, removed on
import), Supabase RLS admin required for writes. Partial import is possible: per-row errors do not roll back
successful rows; the report lists failures.
