// Server-side importer: polite fetch, robots.txt check, HTML fallback, translation.
import {
  assertAllowedImportUrl,
  defaultImportHosts,
  parseShopifyProducts,
  stripHtml,
  translateToFrench,
  type SourceProduct,
} from "./import-products";

const MAX_BYTES = 8 * 1024 * 1024;
const USER_AGENT = "ProteinStoreCatalogImporter/1.0 (+https://proteinestore.pro)";

function allowedHosts(): string[] {
  const configured = process.env["IMPORT_ALLOWED_HOSTS"];
  if (!configured?.trim()) return defaultImportHosts();
  return configured
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function translationMode(): "deepl" | "glossary" {
  return process.env["DEEPL_API_KEY"] ? "deepl" : "glossary";
}

async function fetchText(
  url: string,
  timeoutMs = 20_000,
  hosts?: string[],
): Promise<{ text: string; contentType: string }> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Le site refuse l'accès automatisé (protection anti-bot / Cloudflare). Utilisez l'onglet « HTML » : ouvrez la page dans votre navigateur, copiez son code source, puis collez-le ici.",
      );
    }
    throw new Error(`Le site a répondu ${response.status}.`);
  }
  if (hosts) {
    const finalHost = new URL(response.url).hostname.toLowerCase();
    if (!hosts.map((host) => host.toLowerCase()).includes(finalHost)) {
      throw new Error("Redirection vers un hôte non autorisé.");
    }
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) throw new Error("Réponse trop volumineuse (limite 8 Mo).");
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("Réponse trop volumineuse (limite 8 Mo).");
  return { text, contentType: response.headers.get("content-type") ?? "" };
}

async function robotsAllows(origin: string, path: string): Promise<boolean> {
  let text: string;
  try {
    text = (await fetchText(`${origin}/robots.txt`, 8_000, allowedHosts())).text;
  } catch {
    // Do not block on an unreadable robots file; the product fetch will fail safely.
    return true;
  }
  let forAll = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") forAll = value === "*";
    else if (forAll && key === "disallow" && value) {
      if (value === "/" || path.startsWith(value)) return false;
    }
  }
  return true;
}

/** Fetch a Shopify product feed from an allowlisted host. */
export async function fetchSourceProducts(
  inputUrl: string,
): Promise<{ products: SourceProduct[]; source: string }> {
  const url = assertAllowedImportUrl(inputUrl, allowedHosts());
  const origin = url.origin;
  if (!(await robotsAllows(origin, "/products.json"))) {
    throw new Error(
      "robots.txt interdit l'accès automatisé à ce catalogue. Utilisez l'import HTML.",
    );
  }
  const feedUrl = `${origin}/products.json?limit=250&page=1`;
  const { text } = await fetchText(feedUrl, 20_000, allowedHosts());
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Le site ne renvoie pas un catalogue Shopify JSON. Utilisez l'import HTML.");
  }
  const products = parseShopifyProducts(payload, origin);
  if (products.length === 0) throw new Error("Aucun produit trouvé dans le flux.");
  return { products, source: origin };
}

/** Extract Product JSON-LD / Open Graph data from HTML saved by the admin. */
export function parseHtmlProducts(html: string, baseUrl: string): SourceProduct[] {
  const base = new URL(baseUrl);
  const found: SourceProduct[] = [];
  const seen = new Set<string>();

  const push = (product: Omit<SourceProduct, "handle"> & { handle?: string }) => {
    const handle =
      (product.handle || "").trim() || slugFromUrl(product.sourceUrl) || String(found.length + 1);
    if (seen.has(handle)) return;
    seen.add(handle);
    found.push({ ...product, handle });
  };

  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = match[1];
    if (!raw) continue;
    try {
      collectJsonLd(JSON.parse(raw), base, push);
    } catch {
      // Ignore malformed blocks; other blocks may still be valid.
    }
  }

  if (found.length === 0) {
    const og = openGraphProduct(html, base);
    if (og) push(og);
  }

  if (found.length === 0) {
    for (const card of cardProducts(html, base)) push(card);
  }

  return found.slice(0, 60);
}

function slugFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return (parts.at(-1) ?? "").replace(/\.[a-z]+$/i, "");
  } catch {
    return "";
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function collectJsonLd(
  node: unknown,
  base: URL,
  push: (product: Omit<SourceProduct, "handle"> & { handle?: string }) => void,
): void {
  if (Array.isArray(node)) {
    for (const entry of node) collectJsonLd(entry, base, push);
    return;
  }
  if (!node || typeof node !== "object") return;
  const object = node as Record<string, unknown>;
  if (Array.isArray(object["@graph"])) {
    for (const entry of object["@graph"] as unknown[]) collectJsonLd(entry, base, push);
  }
  const type = object["@type"];
  const types = asArray(type).map((value) => String(value));

  if (types.includes("ItemList")) {
    for (const entry of asArray(object["itemListElement"])) {
      const item = (entry as Record<string, unknown>)?.["item"] ?? entry;
      collectJsonLd(item, base, push);
    }
    return;
  }
  if (!types.includes("Product")) return;

  const name = typeof object["name"] === "string" ? object["name"].trim() : "";
  if (!name) return;
  const offers = (Array.isArray(object["offers"]) ? object["offers"][0] : object["offers"]) as
    Record<string, unknown> | undefined;
  const brandRaw = object["brand"];
  const brand =
    typeof brandRaw === "string"
      ? brandRaw
      : (brandRaw as Record<string, unknown> | undefined)?.["name"];
  const images = asArray(object["image"])
    .map((image) => {
      if (typeof image === "string") return image;
      return (image as Record<string, unknown> | undefined)?.["url"];
    })
    .map((value) => (typeof value === "string" ? resolveUrl(value, base) : null))
    .filter((value): value is string => Boolean(value));
  const descriptionHtml = typeof object["description"] === "string" ? object["description"] : "";
  const url = typeof object["url"] === "string" ? resolveUrl(object["url"], base) : base.href;
  const price = offers?.["price"];
  const parsedPrice = price === undefined ? null : Number.parseFloat(String(price));

  push({
    handle: slugFromUrl(url) || "",
    title: name,
    descriptionHtml,
    vendor: typeof brand === "string" ? brand : "",
    productType: typeof object["category"] === "string" ? object["category"] : "",
    tags: [],
    imageUrls: images.slice(0, 8),
    flavors: [],
    sourceUrl: url,
    sourcePrice: Number.isFinite(parsedPrice) ? parsedPrice : null,
    currency: typeof offers?.["priceCurrency"] === "string" ? offers["priceCurrency"] : "EUR",
  });
}

function openGraphProduct(
  html: string,
  base: URL,
): (Omit<SourceProduct, "handle"> & { handle?: string }) | null {
  const meta = (property: string): string | undefined => {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    );
    return html.match(pattern)?.[1] ?? html.match(alt)?.[1];
  };
  const title = meta("og:title");
  if (!title) return null;
  const type = meta("og:type") ?? "";
  const priceSignal = meta("product:price:amount");
  const urlSignal = (meta("og:url") ?? base.href).match(/\/products?\//i);
  if (!/product/i.test(type) && !priceSignal && !urlSignal) return null;
  const sourceUrl = meta("og:url") ?? base.href;
  const image = meta("og:image");
  const price = meta("product:price:amount");
  return {
    handle: slugFromUrl(sourceUrl),
    title: decodeHtml(title),
    descriptionHtml: meta("og:description") ?? "",
    vendor: meta("product:brand") ? decodeHtml(meta("product:brand") ?? "") : "",
    productType: "",
    tags: [],
    imageUrls: image ? [resolveUrl(decodeHtml(image), base)] : [],
    flavors: [],
    sourceUrl,
    sourcePrice: price ? Number.parseFloat(price) : null,
    currency: meta("product:price:currency") ?? "EUR",
  };
}

/** Fallback for saved category pages: product links that contain a title and image. */
function cardProducts(
  html: string,
  base: URL,
): (Omit<SourceProduct, "handle"> & { handle?: string })[] {
  const results: (Omit<SourceProduct, "handle"> & { handle?: string })[] = [];
  const seen = new Set<string>();
  const anchors = html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,1200}?)<\/a>/gi);
  for (const match of anchors) {
    const href = decodeHtml(match[1] ?? "");
    if (!/(\/products?\/|\/detail\/|\/artikel\/|\/p\/)/i.test(href)) continue;
    const inner = match[2] ?? "";
    const imageMatch = inner.match(/<img\b[^>]*(?:data-src|src)=["']([^"']+)["'][^>]*>/i);
    if (!imageMatch?.[1]) continue;
    const alt = inner.match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1] ?? "";
    const text = stripHtml(inner);
    const title = decodeHtml(alt).trim() || text.trim();
    if (title.length < 3) continue;
    const sourceUrl = resolveUrl(href, base);
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const imageUrl = resolveUrl(decodeHtml(imageMatch[1]), base);
    if (!imageUrl.startsWith("https://")) continue;
    const priceMatch = inner.match(/(\d+[.,]\d{2})\s*€/);
    results.push({
      handle: slugFromUrl(sourceUrl),
      title,
      descriptionHtml: "",
      vendor: "",
      productType: "",
      tags: [],
      imageUrls: [imageUrl],
      flavors: [],
      sourceUrl,
      sourcePrice: priceMatch?.[1] ? Number.parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
    });
    if (results.length >= 60) break;
  }
  return results;
}

function resolveUrl(value: string, base: URL): string {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export type TranslatedSource = SourceProduct & { titleFr: string; descriptionFr: string };

/** Translate titles/descriptions via DeepL when configured, else a French glossary. */
export async function translateProducts(products: SourceProduct[]): Promise<TranslatedSource[]> {
  const plain = products.map((product) => ({
    ...product,
    plainDescription: stripHtml(product.descriptionHtml).slice(0, 4_000),
  }));
  const key = process.env["DEEPL_API_KEY"];
  if (key) {
    try {
      const texts = plain.flatMap((product) => [product.title, product.plainDescription]);
      const body = new URLSearchParams();
      body.set("auth_key", key);
      body.set("source_lang", "DE");
      body.set("target_lang", "FR");
      for (const text of texts) body.append("text", text || " ");
      const endpoint = process.env["DEEPL_API_URL"] ?? "https://api-free.deepl.com/v2/translate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        const payload = (await response.json()) as { translations?: { text?: string }[] };
        const translated = payload.translations?.map((entry) => entry.text ?? "") ?? [];
        if (translated.length === texts.length) {
          return plain.map((product, index) => ({
            ...product,
            titleFr: translated[index * 2] || product.title,
            descriptionFr: translated[index * 2 + 1] || translateToFrench(product.plainDescription),
          }));
        }
      }
    } catch (error) {
      console.warn("[import] DeepL failed, falling back to glossary", error);
    }
  }
  return plain.map((product) => ({
    ...product,
    titleFr: translateToFrench(product.title),
    descriptionFr: translateToFrench(product.plainDescription),
  }));
}
