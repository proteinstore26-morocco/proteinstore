import { describe, expect, it } from "vitest";
import {
  CSV_HEADERS,
  TEMPLATE_CSV,
  buildCatalogueCsv,
  matchKey,
  parseCsv,
  validateCatalogueCsv,
} from "@/lib/catalogue-csv";

const header = CSV_HEADERS.join(";");

describe("catalogue CSV", () => {
  it("round-trips the template with two example products", () => {
    const validation = validateCatalogueCsv(TEMPLATE_CSV);
    expect(validation.headersOk).toBe(true);
    expect(validation.rows).toHaveLength(2);
    expect(validation.rows.every((row) => row.row && row.errors.length === 0)).toBe(true);
    expect(validation.rows[0]?.row).toMatchObject({
      name: "Whey Isolate Premium 2kg",
      categorySlug: "whey",
      status: "published",
      featured: true,
      price: 459,
      salePrice: 399,
      stock: 24,
      threshold: 5,
      flavors: ["Chocolat", "Vanille", "Fraise"],
    });
    expect(validation.rows[1]?.row).toMatchObject({
      status: "draft",
      salePrice: null,
      featured: false,
    });
  });

  it("parses quoted separators, newlines and semicolons", () => {
    const csv = `${header}\r\n"Whey; Special";Brand;Whey & Protéines;Publié;1;100;;5;3;"Vanille, Chocolat";"Ligne 1\nLigne 2"`;
    const seen = parseCsv(csv);
    expect(seen.delimiter).toBe(";");
    const validation = validateCatalogueCsv(csv);
    expect(validation.rows[0]?.row?.name).toBe("Whey; Special");
    expect(validation.rows[0]?.row?.description).toContain("Ligne 1\nLigne 2");
  });

  it("detects a comma-separated file", () => {
    const csv = [
      "Nom du produit,Marque,Catégorie,Statut de Publication,Produit mis en avant,Prix (MAD),Prix promotionnel (MAD),Stock,Seuil d’alerte stock,Saveurs,Description",
      "Test Whey,Brand,Whey & Protéines,Brouillon,Non,199,,10,3,Vanille,Desc",
    ].join("\n");
    const validation = validateCatalogueCsv(csv);
    expect(validation.delimiter).toBe(",");
    expect(validation.rows[0]?.row?.price).toBe(199);
  });

  it("reports row-level validation errors", () => {
    const csv = [
      header,
      "Valid Product;Brand;Whey & Protéines;Publié;Oui;100;90;5;2;Vanille;OK",
      "Bad Price;Brand;Créatine;Publié;Non;abc;;5;2;;",
      "Bad Category;Brand;Inconnue;Publié;Non;100;;5;2;;",
      "Bad Status;Brand;Whey & Protéines;Publié;Maybe;100;;5;2;;",
      "Bad Promo;Brand;Whey & Protéines;Publié;Non;100;200;5;2;;",
    ].join("\n");
    const validation = validateCatalogueCsv(csv);
    expect(validation.rows[0]?.errors).toHaveLength(0);
    expect(validation.rows[1]?.errors.join(" ")).toContain("Prix invalide");
    expect(validation.rows[2]?.errors.join(" ")).toContain("Catégorie invalide");
    expect(validation.rows[3]?.errors.join(" ")).toContain("mis en avant");
    expect(validation.rows[4]?.errors.join(" ")).toContain("≤ au prix");
  });

  it("normalizes flavours and detects duplicates inside the file", () => {
    const csv = [
      header,
      'Same Name;Same Brand;Whey & Protéines;Publié;Non;100;;5;2;"Vanille, Vanille, Chocolat";',
      "same name;same brand;Whey & Protéines;Publié;Non;100;;5;2;;",
    ].join("\n");
    const validation = validateCatalogueCsv(csv);
    expect(validation.rows[0]?.row?.flavors).toEqual(["Vanille", "Chocolat"]);
    expect(validation.rows[1]?.errors.join(" ")).toContain("Doublon dans le fichier");
    expect(matchKey("Créatine", "Bio Tech")).toBe(matchKey("creatine", "bio-tech"));
  });

  it("guards CSV formulas on export and restores text on import", () => {
    const csv = buildCatalogueCsv([
      [
        "Formula",
        "Brand",
        "Créatine",
        "Brouillon",
        "Non",
        1,
        null,
        1,
        1,
        "",
        '=HYPERLINK("http://evil")',
      ],
    ]);
    expect(csv).toContain(`'=HYPERLINK`);
    const validation = validateCatalogueCsv(csv);
    expect(validation.rows[0]?.row?.description).toContain("=HYPERLINK");
    expect(TEMPLATE_CSV.startsWith("\uFEFF")).toBe(true);
  });

  it("rejects a file with missing headers", () => {
    const validation = validateCatalogueCsv("Nom du produit;Marque\nTest;Brand");
    expect(validation.headersOk).toBe(false);
    expect(validation.missingHeaders.length).toBeGreaterThan(0);
  });
});
