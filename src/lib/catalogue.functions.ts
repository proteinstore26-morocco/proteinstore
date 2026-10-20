import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CATEGORY_OPTIONS,
  MAX_CSV_BYTES,
  MAX_IMPORT_ROWS,
  TEMPLATE_CSV,
  buildCatalogueCsv,
  matchKey,
  normalizeText,
  validateCatalogueCsv,
  type NormalizedCatalogueRow,
} from "./catalogue-csv";
import { slugify } from "./import-products";

type AdminContext = { supabase: SupabaseClient<Database>; userId: string; claims?: unknown };
type ProductRow = {
  id: string;
  title: string;
  brand: string | null;
  slug: string;
  category_id: string | null;
  status: string;
  is_featured: boolean;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  flavors: string[];
  description: string | null;
};

async function guard(context: AdminContext) {
  const { requireStoreAdmin } = await import("./admin-guard.server");
  return requireStoreAdmin(context.supabase, context.userId, "admin", context.claims);
}

function categoryLabel(slug: string | null): string {
  return CATEGORY_OPTIONS.find((entry) => entry.slug === slug)?.label ?? "Sans catégorie";
}

function statusToLabel(status: string): string {
  return status === "published" ? "Publié" : "Brouillon";
}

async function loadProducts(context: AdminContext): Promise<ProductRow[]> {
  const { data, error } = await context.supabase
    .from("products")
    .select(
      "id,title,brand,slug,category_id,status,is_featured,price,sale_price,stock_quantity,low_stock_threshold,flavors,description",
    )
    .limit(1000);
  if (error) throw new Error("Impossible de lire le catalogue.");
  return (data ?? []) as ProductRow[];
}

async function loadCategoryMap(context: AdminContext): Promise<Map<string, string>> {
  const { data, error } = await context.supabase.from("categories").select("id,slug");
  if (error) throw new Error("Impossible de lire les catégories.");
  return new Map((data ?? []).map((row) => [String(row.slug), String(row.id)]));
}

function duplicateMap(products: ProductRow[]): Map<string, ProductRow[]> {
  const map = new Map<string, ProductRow[]>();
  for (const product of products) {
    const key = matchKey(product.title, product.brand ?? "");
    map.set(key, [...(map.get(key) ?? []), product]);
  }
  return map;
}

function categoryIdFor(
  row: NormalizedCatalogueRow,
  categories: Map<string, string>,
): string | null {
  if (!row.categorySlug) return null;
  return categories.get(row.categorySlug) ?? null;
}

export const getCatalogueCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { data, error } = await context.supabase
      .from("categories")
      .select("id,slug,name")
      .order("display_order");
    if (error) throw new Error("Impossible de lire les catégories.");
    return (data ?? []).map((category) => {
      const known = CATEGORY_OPTIONS.find((entry) => entry.slug === category.slug);
      return {
        id: String(category.id),
        slug: String(category.slug),
        label: known?.label ?? String(category.name),
      };
    });
  });

export const downloadCatalogueTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    return { filename: "modele-catalogue-proteinstore.csv", csv: TEMPLATE_CSV };
  });

export const exportCatalogueCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        category: z.string().trim().max(80).optional(),
        status: z.enum(["all", "published", "draft"]).optional(),
        q: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context);
    const [products, categoryMap] = await Promise.all([
      loadProducts(context),
      loadCategoryMap(context),
    ]);
    const slugById = new Map([...categoryMap.entries()].map(([slug, id]) => [id, slug]));
    const query = normalizeText(data.q ?? "");
    const filtered = products.filter((product) => {
      if (data.status && data.status !== "all" && product.status !== data.status) return false;
      if (data.category) {
        const slug = product.category_id ? (slugById.get(product.category_id) ?? null) : null;
        if (slug !== data.category) return false;
      }
      if (query && !normalizeText(`${product.title} ${product.brand ?? ""}`).includes(query))
        return false;
      return true;
    });
    const rows = filtered.map((product) => [
      product.title,
      product.brand ?? "",
      categoryLabel(product.category_id ? (slugById.get(product.category_id) ?? null) : null),
      statusToLabel(product.status),
      product.is_featured ? "Oui" : "Non",
      product.price,
      product.sale_price ?? "",
      product.stock_quantity,
      product.low_stock_threshold,
      product.flavors.join(", "),
      product.description ?? "",
    ]);
    return {
      filename: `catalogue-proteinstore-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: buildCatalogueCsv(rows),
      count: filtered.length,
    };
  });

export const previewCatalogueCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ csv: z.string().min(1).max(MAX_CSV_BYTES) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context);
    const validation = validateCatalogueCsv(data.csv);
    if (!validation.headersOk) {
      return {
        ...validation,
        rows: [],
        summary: { total: 0, valid: 0, invalid: 0, create: 0, update: 0 },
      };
    }
    const [products, categories] = await Promise.all([
      loadProducts(context),
      loadCategoryMap(context),
    ]);
    const duplicates = duplicateMap(products);
    const rows = validation.rows.map((entry) => {
      const errors = [...entry.errors];
      if (!entry.row) return { ...entry, action: "invalid" as const };
      const matches = duplicates.get(matchKey(entry.row.name, entry.row.brand)) ?? [];
      let action: "create" | "update" | "invalid" = "create";
      let existingId: string | undefined;
      let existingTitle: string | undefined;
      if (matches.length > 1) {
        errors.push(
          `${matches.length} produits existants correspondent à ce Nom + Marque : mise à jour ambiguë.`,
        );
        action = "invalid";
      } else if (matches.length === 1) {
        action = "update";
        existingId = matches[0]?.id;
        existingTitle = matches[0]?.title;
      }
      if (!categoryIdFor(entry.row, categories) && entry.row.categorySlug) {
        errors.push("La catégorie existe dans la liste mais pas dans le catalogue.");
        action = "invalid";
      }
      return {
        ...entry,
        errors,
        action,
        ...(existingId ? { existingId } : {}),
        ...(existingTitle ? { existingTitle } : {}),
      };
    });
    const valid = rows.filter((row) => row.action !== "invalid");
    return {
      ...validation,
      rows: rows.slice(0, 500),
      truncated: rows.length > 500,
      summary: {
        total: rows.length,
        valid: valid.length,
        invalid: rows.length - valid.length,
        create: valid.filter((row) => row.action === "create").length,
        update: valid.filter((row) => row.action === "update").length,
      },
    };
  });

export const importCatalogueCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ csv: z.string().min(1).max(MAX_CSV_BYTES) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context);
    const validation = validateCatalogueCsv(data.csv);
    if (!validation.headersOk)
      throw new Error(`En-têtes manquants : ${validation.missingHeaders.join(", ")}.`);
    const validRows = validation.rows.filter((row) => row.row && row.errors.length === 0);
    if (validRows.length === 0) throw new Error("Aucune ligne valide à importer.");
    if (validRows.length > MAX_IMPORT_ROWS)
      throw new Error(`Trop de lignes valides (${validRows.length}).`);

    const [products, categories] = await Promise.all([
      loadProducts(context),
      loadCategoryMap(context),
    ]);
    const duplicates = duplicateMap(products);
    const slugs = new Set(products.map((product) => product.slug));
    const created: { line: number; name: string; slug: string }[] = [];
    const updated: { line: number; name: string }[] = [];
    const failed: { line: number; name: string; error: string }[] = [];

    const uniqueSlug = (base: string) => {
      const root = slugify(base) || "produit";
      let candidate = root;
      let suffix = 2;
      while (slugs.has(candidate)) {
        candidate = `${root}-${suffix}`;
        suffix += 1;
      }
      slugs.add(candidate);
      return candidate;
    };

    for (const entry of validRows) {
      const row = entry.row;
      if (!row) continue;
      const matches = duplicates.get(matchKey(row.name, row.brand)) ?? [];
      const categoryId = categoryIdFor(row, categories);
      const values = {
        title: row.name,
        brand: row.brand,
        category_id: categoryId,
        status: row.status,
        is_featured: row.featured,
        price: row.price,
        sale_price: row.salePrice,
        stock_quantity: row.stock,
        low_stock_threshold: row.threshold,
        flavors: row.flavors,
        description: row.description,
      };
      try {
        if (matches.length > 1)
          throw new Error("Plusieurs produits existants correspondent à ce Nom + Marque.");
        if (matches.length === 1 && matches[0]) {
          const { error } = await context.supabase
            .from("products")
            .update(values)
            .eq("id", matches[0].id);
          if (error) throw error;
          updated.push({ line: entry.line, name: row.name });
        } else {
          const slug = uniqueSlug(row.name);
          const { error } = await context.supabase.from("products").insert({
            ...values,
            slug,
            sku: null,
            image_urls: [],
            nutrition_facts: [],
            rating: 0,
            review_count: 0,
            sold_count: 0,
          });
          if (error) throw error;
          created.push({ line: entry.line, name: row.name, slug });
        }
      } catch (error) {
        const message =
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : "Écriture refusée.";
        failed.push({
          line: entry.line,
          name: row.name,
          error: /row-level security|permission denied/i.test(message)
            ? "Le backend refuse l'écriture : rôle Supabase admin requis."
            : message,
        });
      }
    }

    return {
      created,
      updated,
      failed,
      total: validRows.length,
      invalidLines: validation.rows
        .filter((row) => row.errors.length > 0 || !row.row)
        .map((row) => row.line),
    };
  });
