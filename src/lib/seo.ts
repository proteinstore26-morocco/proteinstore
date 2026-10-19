// SEO helpers kept free of server imports (usable in components and tests).
const envUrl = import.meta.env["VITE_SITE_URL"] as string | undefined;

export const SITE_URL = (envUrl || "https://proteinestore.pro").replace(/\/+$/, "");
export const SITE_NAME = "PROTEIN STORE® Kénitra";
export const SITE_DESCRIPTION =
  "Whey, créatine, gainers et pré-workouts authentiques à Kénitra. Livraison partout au Maroc, paiement à la livraison.";

export type SeoProductInput = {
  title: string;
  description: string | null;
  imageCount: number;
  slug: string;
  brand: string | null;
  categoryName: string | null;
  price: number;
  stock: number;
  status: string;
};

export function productSeoScore(product: SeoProductInput): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (product.title.length < 30) issues.push("Titre trop court (< 30 caractères)");
  if (product.title.length > 65) issues.push("Titre trop long (> 65 caractères)");
  if (!product.description || product.description.trim().length < 80) {
    issues.push("Description absente ou trop courte (< 80 caractères)");
  }
  if (product.imageCount === 0) issues.push("Aucune image produit");
  if (product.slug.length > 70) issues.push("Slug trop long (> 70 caractères)");
  if (!/^[a-z0-9-]+$/.test(product.slug))
    issues.push("Slug non normalisé (minuscules, chiffres, tirets)");
  if (!product.brand) issues.push("Marque manquante");
  if (!product.categoryName) issues.push("Catégorie manquante");
  if (product.price <= 0) issues.push("Prix à 0 MAD");
  if (product.status === "published" && product.stock <= 0)
    issues.push("Publié en rupture de stock");
  return { score: Math.max(0, 100 - issues.length * 12), issues };
}

export function productJsonLd(input: {
  title: string;
  description: string;
  image: string;
  brand: string | null;
  slug: string;
  price: number;
  stock: number;
  rating: number;
  reviewCount: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.title,
    description: input.description,
    image: [input.image],
    brand: input.brand ? { "@type": "Brand", name: input.brand } : undefined,
    sku: input.slug,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${input.slug}`,
      priceCurrency: "MAD",
      price: input.price,
      availability:
        input.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(input.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.rating,
            reviewCount: input.reviewCount,
          },
        }
      : {}),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    telephone: "+212776566089",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Kénitra",
      addressCountry: "MA",
    },
    sameAs: ["https://www.instagram.com/proteinestore"],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
