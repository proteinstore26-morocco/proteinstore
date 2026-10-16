import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const PRODUCT_COLS = "id,title,slug,brand,price,sale_price,stock_quantity,low_stock_threshold,image_urls,flavors,is_featured,rating,review_count,sold_count,category_id,created_at,category:categories(slug,name)";

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [products, categories, campaigns, partners, reviews] = await Promise.all([
    sb.from("products").select(PRODUCT_COLS).order("created_at", { ascending: false }),
    sb.from("categories").select("*").order("display_order"),
    sb.from("campaigns").select("*").eq("is_active", true),
    sb.from("partners").select("*").order("display_order"),
    sb.from("reviews").select("id,author_name,city,rating,comment,is_verified,created_at,product_id").order("created_at", { ascending: false }).limit(30),
  ]);
  return {
    products: products.data ?? [],
    categories: categories.data ?? [],
    campaigns: campaigns.data ?? [],
    partners: partners.data ?? [],
    reviews: reviews.data ?? [],
  };
});

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: product } = await sb.from("products").select(PRODUCT_COLS + ",description,nutrition_facts,sku").eq("slug", data.slug).maybeSingle();
    if (!product) return { product: null, reviews: [] };
    const { data: reviews } = await sb.from("reviews").select("*").eq("product_id", (product as { id: string }).id).order("created_at", { ascending: false });
    return { product, reviews: reviews ?? [] };
  });
