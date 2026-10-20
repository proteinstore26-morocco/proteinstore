import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { productSeoScore, SITE_URL } from "./seo";
import type { ProductSeoIssue, SeoAudit } from "./order-types";

type AdminContext = { supabase: SupabaseClient<Database>; userId: string; claims?: unknown };

async function guard(context: AdminContext) {
  const { requireStoreAdmin } = await import("./admin-guard.server");
  return requireStoreAdmin(context.supabase, context.userId, "admin", context.claims);
}

export const getSeoAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeoAudit> => {
    await guard(context);
    const { publicServerClient } = await import("./supabase-public.server");
    const supabase = publicServerClient();
    const { data: products, error } = await supabase
      .from("products")
      .select(
        "id,title,slug,description,brand,image_urls,price,sale_price,stock_quantity,status,category:categories(name)",
      )
      .order("title");
    if (error) throw new Error("Impossible de charger le catalogue pour l'audit SEO.");

    const rows = products ?? [];
    const scored: ProductSeoIssue[] = rows.map((product) => {
      const category = product.category as { name?: string } | null;
      const { score, issues } = productSeoScore({
        title: product.title,
        description: product.description,
        imageCount: product.image_urls?.length ?? 0,
        slug: product.slug,
        brand: product.brand,
        categoryName: category?.name ?? null,
        price: product.sale_price ?? product.price,
        stock: product.stock_quantity,
        status: product.status,
      });
      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        status: product.status,
        score,
        issues,
      };
    });

    const titleCounts = new Map<string, number>();
    for (const product of rows) {
      const key = product.title.trim().toLowerCase();
      titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
    }
    const duplicates = [...titleCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([title]) => title);

    const { sitemapExists } = await import("./seo-sitemap.server");
    const sitemapReady = sitemapExists();

    const site: SeoAudit["site"] = [
      {
        path: "/",
        title: "PROTEIN STORE® Kénitra",
        description: "Titre, description, JSON-LD Store + WebSite",
        ok: true,
        note: "Complet",
      },
      {
        path: "/shop",
        title: "Boutique — PROTEIN STORE® Kénitra",
        description: "Titre et description dynamiques",
        ok: true,
        note: "Complet",
      },
      {
        path: "/product/:slug",
        title: "Titre + description du produit",
        description: "JSON-LD Product (prix, stock, avis)",
        ok: true,
        note: "Complet",
      },
      {
        path: "/track-order",
        title: "Suivi de commande",
        description: "Page utilitaire, indexable",
        ok: true,
        note: "Complet",
      },
      {
        path: "/robots.txt",
        title: "Robots",
        description: "Crawlers autorisés, sitemap déclaré",
        ok: true,
        note: "Complet",
      },
      {
        path: "/sitemap.xml",
        title: "Sitemap",
        description: "Produits publiés + pages statiques",
        ok: sitemapReady,
        note: sitemapReady ? "Généré" : "À générer au build",
      },
    ];

    const published = scored.filter((product) => product.status === "published");
    const averageProductScore = published.length
      ? Math.round(published.reduce((sum, product) => sum + product.score, 0) / published.length)
      : 0;
    const siteScore = Math.round((site.filter((entry) => entry.ok).length / site.length) * 100);
    const score = Math.round(averageProductScore * 0.75 + siteScore * 0.25);

    return {
      baseUrl: SITE_URL,
      score,
      productCount: rows.length,
      publishedCount: published.length,
      averageProductScore,
      products: scored.sort((a, b) => a.score - b.score),
      duplicates,
      site,
      sitemapReady,
      checkedAt: new Date().toISOString(),
    };
  });
