// Pure helpers for the third-party product importer (no server imports).

export type SourceProduct = {
  handle: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  imageUrls: string[];
  flavors: string[];
  sourceUrl: string;
  sourcePrice: number | null;
  currency: string;
};

export type PreviewProduct = {
  handle: string;
  title: string;
  titleFr: string;
  descriptionFr: string;
  brand: string;
  categorySlug: string | null;
  imageUrls: string[];
  flavors: string[];
  sourceUrl: string;
  sourcePrice: number | null;
  currency: string;
  exists: boolean;
};

const asString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

/** Convert Shopify body_html into readable plain text. */
export function stripHtml(html: string): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutBlocks)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// German/English supplement vocabulary → French. Full machine translation is
// optional (DeepL); this glossary guarantees sensible French key terms offline.
const GLOSSARY: [RegExp, string][] = [
  [/\bwhey\s+protein\b/gi, "protéine whey"],
  [/\bwhey\s+isolate\b/gi, "isolat de whey"],
  [/\bwhey\s+hydrolysat\b/gi, "hydrolysat de whey"],
  [/\bwhey\b/gi, "whey"],
  [/\bprotein\b/gi, "protéine"],
  [/\bproteine\b/gi, "protéines"],
  [/\beiweiß\b/gi, "protéines"],
  [/\bmehrkomponentenprotein\b/gi, "protéine multi-composants"],
  [/\bkreatin\b/gi, "créatine"],
  [/\bcreatine\b/gi, "créatine"],
  [/\bgainer\b/gi, "gainer"],
  [/\bmass\s*gainer\b/gi, "gainer de masse"],
  [/\bpre[\s-]?workout\b/gi, "pré-workout"],
  [/\bbooster\b/gi, "booster"],
  [/\bbcaa\b/gi, "BCAA"],
  [/\beaa\b/gi, "EAA"],
  [/\baminosäuren\b/gi, "acides aminés"],
  [/\bamino\b/gi, "acides aminés"],
  [/\bfettverbrenner\b/gi, "brûleur de graisse"],
  [/\bfatburner\b/gi, "brûleur de graisse"],
  [/\bvitamine\b/gi, "vitamines"],
  [/\bvitamin\b/gi, "vitamine"],
  [/\bmineralstoffe\b/gi, "minéraux"],
  [/\bomega[\s-]?3\b/gi, "oméga-3"],
  [/\bzink\b/gi, "zinc"],
  [/\bmagnesium\b/gi, "magnésium"],
  [/\bgeschmack\b/gi, "saveur"],
  [/\bgeschmacksrichtungen\b/gi, "saveurs"],
  [/\bsorte\b/gi, "saveur"],
  [/\bgeschmacksrichtung\b/gi, "saveur"],
  [/\binhalt\b/gi, "contenu"],
  [/\bportionen\b/gi, "portions"],
  [/\bportion\b/gi, "portion"],
  [/\bdosen\b/gi, "doses"],
  [/\bdose\b/gi, "dose"],
  [/\bzucker\b/gi, "sucre"],
  [/\bzuckerfrei\b/gi, "sans sucre"],
  [/\bohne\s+zucker\b/gi, "sans sucre"],
  [/\bkohlenhydrate\b/gi, "glucides"],
  [/\bfett\b/gi, "matières grasses"],
  [/\bkalorien\b/gi, "calories"],
  [/\bvegan\b/gi, "végan"],
  [/\bvegetarisch\b/gi, "végétarien"],
  [/\bqualität\b/gi, "qualité"],
  [/\blieferung\b/gi, "livraison"],
  [/\bkostenlos\b/gi, "gratuit"],
  [/\bneu\b/gi, "nouveau"],
  [/\bbestseller\b/gi, "best-seller"],
  [/\bvorrat\b/gi, "stock"],
  [/\bmit\b/gi, "avec"],
  [/\bund\b/gi, "et"],
  [/\bfür\b/gi, "pour"],
  [/\bohne\b/gi, "sans"],
];

export function translateToFrench(text: string): string {
  let output = text;
  for (const [pattern, replacement] of GLOSSARY) output = output.replace(pattern, replacement);
  return output.replace(/\s{2,}/g, " ").trim();
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function guessCategorySlug(product: { productType: string; title: string; tags: string[] }): string | null {
  const haystack = `${product.productType} ${product.title} ${product.tags.join(" ")}`.toLowerCase();
  if (/\b(whey|isolat|isolate|protein|eiweiß|proteine)\b/.test(haystack)) return "whey";
  if (/\b(gainer|mass|aufbau)\b/.test(haystack)) return "gainers";
  if (/\b(kreatin|creatine)\b/.test(haystack)) return "creatine";
  if (/\b(pre[\s-]?workout|booster)\b/.test(haystack)) return "pre-workout";
  if (/\b(bcaa|eaa|amino|aminosäuren)\b/.test(haystack)) return "acides-amines";
  if (/\b(fettverbrenner|fatburner|burner)\b/.test(haystack)) return "bruleurs";
  if (/\b(vitamin|mineral|omega|zink|magnesium|gesundheit)\b/.test(haystack)) return "sante";
  if (/\b(bar|riegel|snack)\b/.test(haystack)) return "barres";
  return null;
}

/** Parse a Shopify /products.json payload into source products (untranslated). */
export function parseShopifyProducts(payload: unknown, origin: string): SourceProduct[] {
  const products = (payload as { products?: unknown })?.products;
  if (!Array.isArray(products)) return [];
  return products
    .map((entry): SourceProduct | null => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const handle = asString(item["handle"]);
      const title = asString(item["title"]);
      if (!handle || !title) return null;
      const images = Array.isArray(item["images"]) ? item["images"] : [];
      const imageUrls = images
        .map((image) => asString((image as Record<string, unknown>)?.["src"]))
        .filter((url) => url.startsWith("http"));
      const variants = Array.isArray(item["variants"]) ? item["variants"] : [];
      const firstVariant = (variants[0] ?? {}) as Record<string, unknown>;
      const options = Array.isArray(item["options"]) ? item["options"] : [];
      const flavorOption = options.find((option) =>
        /geschmack|flavor|saveur|variante/i.test(asString((option as Record<string, unknown>)?.["name"])),
      ) as Record<string, unknown> | undefined;
      const flavors = Array.isArray(flavorOption?.["values"])
        ? (flavorOption?.["values"] as unknown[]).map((value) => asString(value)).filter(Boolean).slice(0, 30)
        : [];
      return {
        handle,
        title,
        descriptionHtml: asString(item["body_html"]),
        vendor: asString(item["vendor"]),
        productType: asString(item["product_type"]),
        tags: asString(item["tags"])
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        imageUrls: [...new Set(imageUrls)].slice(0, 8),
        flavors,
        sourceUrl: `${origin}/products/${handle}`,
        sourcePrice: asNumber(firstVariant["price"]),
        currency: "EUR",
      };
    })
    .filter((product): product is SourceProduct => product !== null);
}

/** Enforce an explicit host allowlist before any outbound request (SSRF guard). */
export function assertAllowedImportUrl(input: string, allowedHosts: string[]): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("URL invalide.");
  }
  if (url.protocol !== "https:") throw new Error("Seules les URL HTTPS sont autorisées.");
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.map((allowed) => allowed.toLowerCase()).includes(host)) {
    throw new Error(`Hôte non autorisé : ${host}. Ajoutez-le à IMPORT_ALLOWED_HOSTS.`);
  }
  if (url.username || url.password) throw new Error("URL invalide.");
  return url;
}

export function defaultImportHosts(): string[] {
  return ["powernutritionstore.de", "www.powernutritionstore.de"];
}
