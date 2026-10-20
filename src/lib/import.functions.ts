import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertAllowedImportUrl,
  guessCategorySlug,
  slugify,
  type PreviewProduct,
  type SourceProduct,
} from "./import-products";

type AdminContext = { supabase: SupabaseClient<Database>; userId: string; claims?: unknown };

const baseSchema = z.object({
  mode: z.enum(["url", "html"]),
  url: z.string().trim().url().max(500).optional(),
  html: z.string().max(2_000_000).optional(),
  legalAccepted: z.literal(true),
});

async function guard(context: AdminContext) {
  const { requireStoreAdmin } = await import("./admin-guard.server");
  return requireStoreAdmin(context.supabase, context.userId, "admin", context.claims);
}

async function loadSource(input: { mode: "url" | "html"; url?: string; html?: string }) {
  const { fetchSourceProducts, parseHtmlProducts, translateProducts } =
    await import("./import.server");

  let sourceProducts: SourceProduct[];
  let sourceLabel: string;

  if (input.mode === "url") {
    if (!input.url) throw new Error("URL du catalogue manquante.");
    const result = await fetchSourceProducts(input.url);
    sourceProducts = result.products;
    sourceLabel = result.source;
  } else {
    if (!input.html || input.html.trim().length < 100)
      throw new Error("Collez le code source HTML de la page produit.");
    if (!input.url) throw new Error("URL de la page (pour résoudre les images) manquante.");
    const { effectiveImportHosts } = await import("./import-hosts.server");
    const base = assertAllowedImportUrl(input.url, await effectiveImportHosts());
    sourceProducts = parseHtmlProducts(input.html, base.href);
    sourceLabel = base.hostname;
    if (sourceProducts.length === 0) {
      throw new Error(
        "Aucun produit détecté dans ce HTML. La page doit contenir des données JSON-LD Product ou Open Graph (og:title, og:description, og:image).",
      );
    }
  }

  const translated = await translateProducts(sourceProducts);
  return { products: translated, source: sourceLabel };
}

function buildPreview(
  product: Awaited<ReturnType<typeof loadSource>>["products"][number],
  existing: Set<string>,
): PreviewProduct {
  const slug = slugify(product.handle) || slugify(product.titleFr);
  const categorySlug = guessCategorySlug({
    productType: product.productType,
    title: `${product.title} ${product.titleFr}`,
    tags: product.tags,
  });
  return {
    handle: product.handle,
    title: product.title,
    titleFr: product.titleFr,
    descriptionFr: product.descriptionFr,
    brand: product.vendor,
    categorySlug,
    imageUrls: product.imageUrls,
    flavors: product.flavors,
    sourceUrl: product.sourceUrl,
    sourcePrice: product.sourcePrice,
    currency: product.currency,
    exists: existing.has(slug),
  };
}

async function existingSlugs(supabase: SupabaseClient<Database>): Promise<Set<string>> {
  const { data, error } = await supabase.from("products").select("slug").limit(1000);
  if (error) throw new Error("Impossible de lire le catalogue pour détecter les doublons.");
  return new Set((data ?? []).map((row) => String(row.slug)));
}

function writeError(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  if (/row-level security|permission denied/i.test(message)) {
    return "Le backend refuse l'écriture : votre compte Supabase doit avoir le rôle admin (ou super_admin).";
  }
  return message || "Insertion impossible.";
}

export const getImportHosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { importHostEntries, envImportHosts } = await import("./import-hosts.server");
    return { entries: await importHostEntries(), env: envImportHosts() };
  });

export const addImportHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ host: z.string().trim().min(3).max(253) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const admin = await guard(context);
    const { addImportHost: addHost } = await import("./import-hosts.server");
    return { entry: await addHost(data.host, admin.userId) };
  });

export const removeImportHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ host: z.string().trim().min(3).max(253) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const admin = await guard(context);
    const { removeImportHost: removeHost } = await import("./import-hosts.server");
    await removeHost(data.host, admin.userId);
    return { ok: true as const };
  });

export const previewProductImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => baseSchema.parse(data))
  .handler(async ({ context, data }) => {
    await guard(context);
    const { translationMode } = await import("./import.server");
    const { products, source } = await loadSource({
      mode: data.mode,
      ...(data.url ? { url: data.url } : {}),
      ...(data.html ? { html: data.html } : {}),
    });
    const slugs = await existingSlugs(context.supabase);
    const limited = products.slice(0, 50);
    return {
      source,
      translation: translationMode(),
      total: products.length,
      truncated: products.length > limited.length,
      legalNotice:
        "Vous devez disposer des droits sur les textes et images importés. Les produits sont créés en brouillon, hors du site public.",
      products: limited.map((product) => buildPreview(product, slugs)),
    };
  });

export const importProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    baseSchema
      .extend({ handles: z.array(z.string().trim().min(1).max(200)).min(1).max(30) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context);
    const { translationMode } = await import("./import.server");
    const { products, source } = await loadSource({
      mode: data.mode,
      ...(data.url ? { url: data.url } : {}),
      ...(data.html ? { html: data.html } : {}),
    });
    const wanted = new Set(data.handles);
    const selected = products.filter((product) => wanted.has(product.handle));
    if (selected.length === 0)
      throw new Error("Aucun produit sélectionné n'a été retrouvé dans la source.");

    const [{ data: categoryRows, error: categoryError }, slugs] = await Promise.all([
      context.supabase.from("categories").select("id,slug"),
      existingSlugs(context.supabase),
    ]);
    if (categoryError) throw new Error("Impossible de lire les catégories.");
    const categoryBySlug = new Map(
      (categoryRows ?? []).map((row) => [String(row.slug), String(row.id)]),
    );

    const imported: { handle: string; slug: string; title: string; categorySlug: string | null }[] =
      [];
    const skipped: { handle: string; reason: string }[] = [];

    for (const product of selected) {
      const slug = slugify(product.handle) || slugify(product.titleFr);
      if (!slug) {
        skipped.push({ handle: product.handle, reason: "Slug impossible à générer." });
        continue;
      }
      if (slugs.has(slug)) {
        skipped.push({ handle: product.handle, reason: "Un produit avec ce slug existe déjà." });
        continue;
      }
      const categorySlug = guessCategorySlug({
        productType: product.productType,
        title: `${product.title} ${product.titleFr}`,
        tags: product.tags,
      });
      const categoryId = categorySlug ? (categoryBySlug.get(categorySlug) ?? null) : null;
      const description = `${product.descriptionFr || product.titleFr}\n\nSource : ${product.sourceUrl}\nImporté le ${new Date().toLocaleDateString("fr-MA")} — traduction automatique à relire avant publication.`;

      const { data: inserted, error } = await context.supabase
        .from("products")
        .insert({
          title: product.titleFr.slice(0, 200),
          slug,
          description: description.slice(0, 10_000),
          brand: product.vendor.slice(0, 100),
          category_id: categoryId,
          price: 0,
          sale_price: null,
          stock_quantity: 0,
          low_stock_threshold: 5,
          sku: null,
          image_urls: product.imageUrls.filter((url) => url.startsWith("https://")).slice(0, 8),
          flavors: product.flavors.slice(0, 50),
          nutrition_facts: [],
          is_featured: false,
          status: "draft",
          rating: 0,
          review_count: 0,
          sold_count: 0,
        })
        .select("id,slug,title")
        .single();

      if (error || !inserted) {
        skipped.push({ handle: product.handle, reason: writeError(error) });
        continue;
      }
      slugs.add(slug);
      imported.push({
        handle: product.handle,
        slug: String(inserted.slug),
        title: String(inserted.title),
        categorySlug,
      });
    }

    return { source, translation: translationMode(), imported, skipped, total: selected.length };
  });
