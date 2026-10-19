import { describe, expect, it } from "vitest";
import { productSeoScore, productJsonLd } from "@/lib/seo";

const complete = {
  title: "ISO 100 Hydrolyzed 1.37kg Dymatize – Whey Isolate",
  description:
    "Whey isolate hydrolysé Dymatize ISO 100, 1.37 kg, 42 doses. Produit authentique, livré partout au Maroc avec paiement à la livraison.",
  imageCount: 2,
  slug: "iso-100-hydrolyzed-137kg-dymatize",
  brand: "Dymatize",
  categoryName: "Whey",
  price: 1029,
  stock: 40,
  status: "published",
};

describe("SEO scoring", () => {
  it("gives 100 to a complete product", () => {
    expect(productSeoScore(complete)).toEqual({ score: 100, issues: [] });
  });

  it("flags missing description, image, brand, category and stock", () => {
    const { score, issues } = productSeoScore({
      ...complete,
      description: "",
      imageCount: 0,
      brand: null,
      categoryName: null,
      stock: 0,
    });
    expect(issues).toContain("Description absente ou trop courte (< 80 caractères)");
    expect(issues).toContain("Aucune image produit");
    expect(issues).toContain("Marque manquante");
    expect(issues).toContain("Catégorie manquante");
    expect(issues).toContain("Publié en rupture de stock");
    expect(score).toBe(40);
  });

  it("flags long titles and non-normalized slugs", () => {
    const { issues } = productSeoScore({ ...complete, title: "x".repeat(70), slug: "Bad Slug" });
    expect(issues).toContain("Titre trop long (> 65 caractères)");
    expect(issues).toContain("Slug non normalisé (minuscules, chiffres, tirets)");
  });

  it("builds Product JSON-LD with availability and rating", () => {
    const json = productJsonLd({
      title: complete.title,
      description: complete.description,
      image: "https://proteinestore.pro/assets/whey.jpg",
      brand: complete.brand,
      slug: complete.slug,
      price: 1029,
      stock: 40,
      rating: 4.8,
      reviewCount: 12,
    });
    expect(json["@type"]).toBe("Product");
    expect(json.offers.priceCurrency).toBe("MAD");
    expect(json.offers.availability).toContain("InStock");
    expect(json.aggregateRating?.reviewCount).toBe(12);
  });
});
