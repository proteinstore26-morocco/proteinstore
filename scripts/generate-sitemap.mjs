#!/usr/bin/env node
// Generates sitemap.xml from the live catalogue. Runs as npm `postbuild`, so it
// receives the same .env as the build. Network failure degrades to static pages.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

try {
  process.loadEnvFile?.(".env");
} catch {
  // .env is optional (CI can provide real environment variables).
}

const base = (process.env.SITE_URL || "https://proteinestore.pro").replace(/\/+$/, "");
const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const headers = key ? { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }) } : null;
const today = new Date().toISOString().slice(0, 10);

const staticPaths = ["/", "/shop", "/about", "/contact", "/partners", "/track-order"];
let products = [];
let categories = [];

if (supabaseUrl && headers) {
  try {
    const productsRes = await fetch(
      `${supabaseUrl}/rest/v1/products?select=slug,updated_at&status=eq.published&order=updated_at.desc&limit=1000`,
      { headers },
    );
    if (productsRes.ok) products = await productsRes.json();
    const categoriesRes = await fetch(`${supabaseUrl}/rest/v1/categories?select=slug&order=display_order`, { headers });
    if (categoriesRes.ok) categories = await categoriesRes.json();
  } catch (error) {
    console.warn("[sitemap] catalogue unavailable, writing static pages only:", error.message);
  }
}

const escapeXml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const urls = [
  ...staticPaths.map((path) => ({ loc: `${base}${path}`, lastmod: today, priority: path === "/" ? "1.0" : "0.7" })),
  ...categories.map((category) => ({
    loc: `${base}/shop?cat=${encodeURIComponent(category.slug)}`,
    lastmod: today,
    priority: "0.6",
  })),
  ...products.map((product) => ({
    loc: `${base}/product/${encodeURIComponent(product.slug)}`,
    lastmod: (product.updated_at || today).slice(0, 10),
    priority: "0.8",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) =>
      `  <url><loc>${escapeXml(entry.loc)}</loc><lastmod>${entry.lastmod}</lastmod><priority>${entry.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>
`;

for (const target of ["public/sitemap.xml", ".output/public/sitemap.xml"]) {
  if (target.startsWith(".output") && !existsSync(".output/public")) continue;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, xml);
}
console.log(`[sitemap] ${urls.length} URLs (${products.length} products) → ${base}`);
