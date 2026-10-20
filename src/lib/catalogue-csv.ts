// Catalogue CSV format, parsing and validation (pure, testable).

export const CSV_HEADERS = [
  "Nom du produit",
  "Marque",
  "Catégorie",
  "Statut de Publication",
  "Produit mis en avant",
  "Prix (MAD)",
  "Prix promotionnel (MAD)",
  "Stock",
  "Seuil d’alerte stock",
  "Saveurs",
  "Description",
] as const;

export const CATEGORY_OPTIONS = [
  { slug: null, label: "Sans catégorie" },
  { slug: "whey", label: "Whey & Protéines" },
  { slug: "gainers", label: "Gainers" },
  { slug: "creatine", label: "Créatine" },
  { slug: "pre-workout", label: "Pré-Workout" },
  { slug: "acides-amines", label: "BCAA & Acides Aminés" },
  { slug: "bruleurs", label: "Brûleurs de graisse" },
  { slug: "sante", label: "Vitamines & Santé" },
  { slug: "barres", label: "Barres & Snacks" },
] as const;

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

export type CsvRecord = { values: string[]; line: number };
export type ParsedCsv = { records: CsvRecord[]; delimiter: string; errors: string[] };

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchKey(name: string, brand: string): string {
  return `${normalizeText(name)}|${normalizeText(brand)}`;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let inQuotes = false;
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in counts) counts[char] = (counts[char] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ";";
}

/** RFC4180-ish parser with BOM, quoted newlines, escaped quotes and delimiter detection. */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const records: CsvRecord[] = [];
  const errors: string[] = [];
  let field = "";
  let values: string[] = [];
  let inQuotes = false;
  let recordLine = 1;
  let line = 1;

  const pushRecord = () => {
    values.push(field);
    if (values.some((value) => value.trim() !== "")) records.push({ values, line: recordLine });
    values = [];
    field = "";
    recordLine = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
        if (char === "\n") line += 1;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      values.push(field);
      field = "";
    } else if (char === "\n") {
      pushRecord();
      line += 1;
    } else if (char === "\r") {
      // handled by the following \n (or ignored at EOF)
    } else {
      field += char;
    }
  }
  if (inQuotes) errors.push("Guillemet non fermé dans le fichier CSV.");
  if (field !== "" || values.length > 0) pushRecord();

  return { records, delimiter, errors };
}

export type RawCatalogueRow = {
  line: number;
  name: string;
  brand: string;
  category: string;
  status: string;
  featured: string;
  price: string;
  salePrice: string;
  stock: string;
  threshold: string;
  flavors: string;
  description: string;
};

export type NormalizedCatalogueRow = {
  line: number;
  name: string;
  brand: string;
  categorySlug: string | null;
  categoryLabel: string;
  status: "published" | "draft";
  featured: boolean;
  price: number;
  salePrice: number | null;
  stock: number;
  threshold: number;
  flavors: string[];
  description: string;
};

export type RowValidation = {
  line: number;
  raw: Pick<RawCatalogueRow, "name" | "brand" | "category" | "status" | "price">;
  row: NormalizedCatalogueRow | null;
  errors: string[];
};

export type CatalogueValidation = {
  delimiter: string;
  headersOk: boolean;
  missingHeaders: string[];
  unknownHeaders: string[];
  rows: RowValidation[];
  fileErrors: string[];
};

const HEADER_KEYS: Record<string, keyof RawCatalogueRow> = {
  "nom du produit": "name",
  marque: "brand",
  categorie: "category",
  "statut de publication": "status",
  "produit mis en avant": "featured",
  prix: "price",
  "prix mad": "price",
  "prix promotionnel": "salePrice",
  "prix promotionnel mad": "salePrice",
  stock: "stock",
  "seuil d alerte stock": "threshold",
  saveurs: "flavors",
  description: "description",
};

function unescapeFormula(value: string): string {
  return value.replace(/^'([=+\-@])/, "$1");
}

const clean = (value: string) => unescapeFormula(value.trim());

function parseInteger(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0]/g, "").replace(",", ".");
  if (!/^\d+(\.0+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) ? number : null;
}

function parseBoolean(value: string): boolean | null {
  const normalized = normalizeText(value);
  if (["oui", "1", "true", "vrai"].includes(normalized)) return true;
  if (["non", "0", "false", "faux", ""].includes(normalized)) return false;
  return null;
}

function parseStatus(value: string): "published" | "draft" | null {
  const normalized = normalizeText(value);
  if (normalized === "publie" || normalized === "published") return "published";
  if (normalized === "brouillon" || normalized === "draft") return "draft";
  return null;
}

function categoryFrom(value: string): { slug: string | null; label: string } | null {
  const normalized = normalizeText(value);
  const option = CATEGORY_OPTIONS.find(
    (entry) =>
      normalizeText(entry.label) === normalized ||
      (entry.slug !== null && normalizeText(entry.slug) === normalized),
  );
  return option ? { slug: option.slug, label: option.label } : null;
}

export function validateCatalogueCsv(input: string): CatalogueValidation {
  const parsed = parseCsv(input);
  const fileErrors = [...parsed.errors];
  const headerRecord = parsed.records[0];

  if (!headerRecord) {
    return {
      delimiter: parsed.delimiter,
      headersOk: false,
      missingHeaders: [...CSV_HEADERS],
      unknownHeaders: [],
      rows: [],
      fileErrors: [...fileErrors, "Fichier vide."],
    };
  }

  const indexByKey = new Map<keyof RawCatalogueRow, number>();
  const unknownHeaders: string[] = [];
  headerRecord.values.forEach((header, index) => {
    const key = HEADER_KEYS[normalizeText(header)];
    if (key) indexByKey.set(key, index);
    else if (header.trim()) unknownHeaders.push(header.trim());
  });

  const missingHeaders = CSV_HEADERS.filter((header) => {
    const key = HEADER_KEYS[normalizeText(header)];
    return key ? !indexByKey.has(key) : false;
  });

  if (missingHeaders.length > 0) {
    return {
      delimiter: parsed.delimiter,
      headersOk: false,
      missingHeaders,
      unknownHeaders,
      rows: [],
      fileErrors,
    };
  }

  const rows: RowValidation[] = [];
  const seen = new Set<string>();
  for (const record of parsed.records.slice(1)) {
    const value = (key: keyof RawCatalogueRow) => {
      const index = indexByKey.get(key);
      return index === undefined ? "" : (record.values[index] ?? "");
    };
    const raw = {
      name: clean(value("name")),
      brand: clean(value("brand")),
      category: clean(value("category")),
      status: clean(value("status")),
      price: clean(value("price")),
    };
    const errors: string[] = [];
    const name = raw.name;
    const brand = raw.brand;
    if (name.length < 2 || name.length > 200)
      errors.push("Nom du produit requis (2 à 200 caractères).");
    if (brand.length > 100) errors.push("Marque trop longue (100 caractères max).");

    const category = categoryFrom(raw.category);
    if (!category) errors.push(`Catégorie invalide : « ${raw.category || "(vide)"} ».`);

    const status = parseStatus(raw.status);
    if (!status) errors.push("Statut invalide : utilisez « Publié » ou « Brouillon ».");

    const featured = parseBoolean(clean(value("featured")));
    if (featured === null) errors.push("Produit mis en avant : utilisez Oui/Non ou 1/0.");

    const price = parseInteger(raw.price);
    if (price === null || price < 0) errors.push("Prix invalide (entier MAD ≥ 0).");

    const saleRaw = clean(value("salePrice"));
    const salePrice = saleRaw === "" ? null : parseInteger(saleRaw);
    if (saleRaw !== "" && (salePrice === null || salePrice < 0))
      errors.push("Prix promotionnel invalide (entier MAD ≥ 0).");
    if (price !== null && salePrice !== null && salePrice > price)
      errors.push("Le prix promotionnel doit être ≤ au prix.");

    const stockValue = parseInteger(clean(value("stock")));
    if (stockValue === null || stockValue < 0) errors.push("Stock invalide (entier ≥ 0).");
    const threshold = parseInteger(clean(value("threshold")));
    if (threshold === null || threshold < 0) errors.push("Seuil d’alerte invalide (entier ≥ 0).");

    const flavors = clean(value("flavors"))
      .split(",")
      .map((flavor) => flavor.trim())
      .filter(Boolean);
    const uniqueFlavors = [...new Set(flavors)];
    if (uniqueFlavors.length > 50) errors.push("Trop de saveurs (50 max).");
    if (uniqueFlavors.some((flavor) => flavor.length > 60))
      errors.push("Une saveur dépasse 60 caractères.");

    const description = clean(value("description"));
    if (description.length > 10_000)
      errors.push("Description trop longue (10 000 caractères max).");

    if (name && brand !== undefined) {
      const key = matchKey(name, brand);
      if (seen.has(key))
        errors.push("Doublon dans le fichier : même Nom + Marque qu’une ligne précédente.");
      seen.add(key);
    }

    const valid =
      errors.length === 0 &&
      category &&
      status &&
      featured !== null &&
      price !== null &&
      stockValue !== null &&
      threshold !== null;
    rows.push({
      line: record.line,
      raw,
      row: valid
        ? {
            line: record.line,
            name,
            brand,
            categorySlug: category.slug,
            categoryLabel: category.label,
            status,
            featured,
            price,
            salePrice,
            stock: stockValue,
            threshold,
            flavors: uniqueFlavors,
            description,
          }
        : null,
      errors,
    });
  }

  if (rows.length > MAX_IMPORT_ROWS)
    fileErrors.push(`Trop de lignes (${rows.length}) : maximum ${MAX_IMPORT_ROWS}.`);

  return {
    delimiter: parsed.delimiter,
    headersOk: true,
    missingHeaders: [],
    unknownHeaders,
    rows,
    fileErrors,
  };
}

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  // CSV/formula injection guard: prefix text that Excel could evaluate.
  if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCatalogueCsv(rows: (string | number | null)[][]): string {
  const lines = [
    CSV_HEADERS.map(csvCell).join(";"),
    ...rows.map((row) => row.map(csvCell).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export const TEMPLATE_CSV = buildCatalogueCsv([
  [
    "Whey Isolate Premium 2kg",
    "NutriLab",
    "Whey & Protéines",
    "Publié",
    "Oui",
    "459",
    "399",
    "24",
    "5",
    "Chocolat, Vanille, Fraise",
    "Whey isolate 90 %, 66 portions. Produit authentique, livraison au Maroc.",
  ],
  [
    "Créatine Monohydrate 300g",
    "PowerFuel",
    "Créatine",
    "Brouillon",
    "Non",
    "149",
    "",
    "0",
    "3",
    "Neutre",
    "Créatine monohydrate micronisée, 60 portions.",
  ],
]);
