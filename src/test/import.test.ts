// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  assertAllowedImportUrl,
  guessCategorySlug,
  parseShopifyProducts,
  slugify,
  stripHtml,
  translateToFrench,
} from "@/lib/import-products";
import { parseHtmlProducts } from "@/lib/import.server";

describe("product import helpers", () => {
  it("strips HTML and decodes entities", () => {
    expect(stripHtml("<p>Whey&nbsp;<b>Protein</b> &amp; Kreatin</p>")).toContain(
      "Whey Protein & Kreatin",
    );
  });

  it("translates supplement vocabulary to French", () => {
    const text = translateToFrench("Whey Protein mit Kreatin, Geschmack Vanille, ohne Zucker");
    expect(text).toContain("protéine whey");
    expect(text).toContain("créatine");
    expect(text).toContain("saveur");
    expect(text).toContain("sans sucre");
  });

  it("guesses catalogue categories", () => {
    expect(guessCategorySlug({ productType: "Whey Protein", title: "Iso Whey", tags: [] })).toBe(
      "whey",
    );
    expect(guessCategorySlug({ productType: "", title: "Kreatin Monohydrat", tags: [] })).toBe(
      "creatine",
    );
    expect(guessCategorySlug({ productType: "", title: "Omega 3", tags: [] })).toBe("sante");
    expect(guessCategorySlug({ productType: "Zubehör", title: "Shaker", tags: [] })).toBeNull();
  });

  it("slugifies titles safely", () => {
    expect(slugify("ESN Designer Whey – Vanille 2kg")).toBe("esn-designer-whey-vanille-2kg");
  });

  it("enforces the HTTPS host allowlist", () => {
    expect(
      assertAllowedImportUrl("https://powernutritionstore.de/products-de/", [
        "powernutritionstore.de",
      ]).hostname,
    ).toBe("powernutritionstore.de");
    expect(() =>
      assertAllowedImportUrl("http://powernutritionstore.de/", ["powernutritionstore.de"]),
    ).toThrow("HTTPS");
    expect(() =>
      assertAllowedImportUrl("https://evil.example/", ["powernutritionstore.de"]),
    ).toThrow("non autorisé");
  });

  it("parses a Shopify product feed", () => {
    const products = parseShopifyProducts(
      {
        products: [
          {
            handle: "test-whey",
            title: "Test Whey",
            body_html: "<p>Whey <b>Protein</b></p>",
            vendor: "TestBrand",
            product_type: "Whey",
            tags: "whey, test",
            images: [{ src: "https://cdn.example/whey.jpg" }],
            options: [{ name: "Geschmack", values: ["Vanille", "Schoko"] }],
            variants: [{ price: "29.90" }],
          },
        ],
      },
      "https://powernutritionstore.de",
    );
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      handle: "test-whey",
      vendor: "TestBrand",
      sourcePrice: 29.9,
      flavors: ["Vanille", "Schoko"],
    });
    expect(products[0]?.imageUrls[0]).toContain("whey.jpg");
  });

  it("extracts a product from JSON-LD HTML", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Test Protein","description":"<p>Whey Protein mit Vanille</p>","image":["https://cdn.example/p.jpg"],"brand":{"name":"TestBrand"},"offers":{"price":"19.90","priceCurrency":"EUR"},"url":"https://powernutritionstore.de/products/test-protein"}</script>
    </head><body></body></html>`;
    const products = parseHtmlProducts(html, "https://powernutritionstore.de/products-de/");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      title: "Test Protein",
      vendor: "TestBrand",
      sourcePrice: 19.9,
      currency: "EUR",
    });
    expect(products[0]?.imageUrls[0]).toBe("https://cdn.example/p.jpg");
  });

  it("falls back to Open Graph tags", () => {
    const html = `<html><head>
      <meta property="og:title" content="OG Whey" />
      <meta property="og:description" content="Whey isolate" />
      <meta property="og:image" content="/media/whey.jpg" />
      <meta property="og:url" content="https://powernutritionstore.de/products/og-whey" />
    </head></html>`;
    const products = parseHtmlProducts(html, "https://powernutritionstore.de/products-de/");
    expect(products[0]?.title).toBe("OG Whey");
    expect(products[0]?.imageUrls[0]).toBe("https://powernutritionstore.de/media/whey.jpg");
  });
});
