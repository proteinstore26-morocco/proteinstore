import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadCatalogueTemplate,
  exportCatalogueCsv,
  getCatalogueCategories,
  importCatalogueCsv,
  previewCatalogueCsv,
} from "@/lib/catalogue.functions";
import { CSV_HEADERS, MAX_CSV_BYTES } from "@/lib/catalogue-csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

type Action = "create" | "update" | "invalid";

type PreviewRow = {
  line: number;
  raw: { name: string; brand: string; category: string; status: string; price: string };
  row: {
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
  } | null;
  errors: string[];
  action: Action;
  existingId?: string;
  existingTitle?: string;
};

type Preview = {
  headersOk: boolean;
  missingHeaders: string[];
  unknownHeaders: string[];
  fileErrors: string[];
  rows: PreviewRow[];
  truncated?: boolean;
  summary: { total: number; valid: number; invalid: number; create: number; update: number };
};

type ImportResult = {
  created: { line: number; name: string; slug: string }[];
  updated: { line: number; name: string }[];
  failed: { line: number; name: string; error: string }[];
  total: number;
  invalidLines: number[];
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCell(value: string | number) {
  const text = String(value);
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function errorReportCsv(rows: { line: number; name: string; brand?: string; errors: string[] }[]) {
  const header = "Ligne;Nom du produit;Marque;Erreur";
  const lines = rows.map((row) =>
    [row.line, row.name, row.brand ?? "", row.errors.join(" | ")].map(escapeCell).join(";"),
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

export function CatalogueIoPanel() {
  const categoriesFn = useServerFn(getCatalogueCategories);
  const exportFn = useServerFn(exportCatalogueCsv);
  const templateFn = useServerFn(downloadCatalogueTemplate);
  const previewFn = useServerFn(previewCatalogueCsv);
  const importFn = useServerFn(importCatalogueCsv);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useQuery({
    queryKey: ["admin", "catalogue-categories"],
    queryFn: () => categoriesFn({ data: undefined }),
    retry: false,
  });

  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  async function runExport() {
    setExporting(true);
    try {
      const data = await exportFn({
        data: { ...(category ? { category } : {}), status, ...(q.trim() ? { q: q.trim() } : {}) },
      });
      downloadCsv(data.filename, data.csv);
      toast.success(`${data.count} produit(s) exporté(s).`);
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "Export impossible.");
    } finally {
      setExporting(false);
    }
  }

  async function downloadTemplate() {
    try {
      const data = await templateFn({ data: undefined });
      downloadCsv(data.filename, data.csv);
    } catch (templateError) {
      toast.error(templateError instanceof Error ? templateError.message : "Modèle indisponible.");
    }
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("Formats acceptés : CSV UTF-8 uniquement (.csv).");
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setError("Fichier trop volumineux (5 Mo max).");
      return;
    }
    setError("");
    setResult(null);
    setPreview(null);
    setFileName(file.name);
    setBusy(true);
    setProgress(15);
    try {
      const text = await file.text();
      setCsv(text);
      setProgress(35);
      const data = (await previewFn({ data: { csv: text } })) as Preview;
      setPreview(data);
      setProgress(50);
      if (!data.headersOk)
        setError("En-têtes invalides : téléchargez le modèle pour voir les colonnes attendues.");
      else if (data.rows.length === 0) setError("Le fichier ne contient aucune ligne de données.");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Analyse impossible.");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!preview || preview.summary.valid === 0) return;
    setBusy(true);
    setProgress(75);
    setError("");
    try {
      const data = (await importFn({ data: { csv } })) as ImportResult;
      setResult(data);
      setProgress(100);
      toast.success(`${data.created.length} créé(s), ${data.updated.length} mis à jour.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import impossible.");
      setProgress(50);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFileName("");
    setCsv("");
    setPreview(null);
    setResult(null);
    setError("");
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  const invalidRows = preview?.rows.filter((row) => row.action === "invalid") ?? [];
  const errorRows = [
    ...invalidRows.map((row) => ({
      line: row.line,
      name: row.row?.name ?? row.raw.name,
      brand: row.row?.brand ?? row.raw.brand,
      errors: row.errors,
    })),
    ...(result?.failed.map((row) => ({
      line: row.line,
      name: row.name,
      brand: "",
      errors: [row.error],
    })) ?? []),
  ];

  return (
    <div className="space-y-10">
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <FileDown className="size-5 text-primary" />
          <h2 className="font-semibold">Exporter le catalogue</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          CSV UTF-8 (séparateur « ; ») compatible Excel. Les brouillons sont inclus uniquement si
          vous les sélectionnez.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto]">
          <div>
            <Label htmlFor="export-category">Catégorie</Label>
            <select
              id="export-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Toutes</option>
              {(categories.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.slug}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="export-status">Statut</Label>
            <select
              id="export-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | "published" | "draft")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Tous</option>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
            </select>
          </div>
          <div>
            <Label htmlFor="export-q">Recherche</Label>
            <Input
              id="export-q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Nom ou marque"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => void runExport()} disabled={exporting}>
              <Download /> Exporter
            </Button>
            <Button variant="outline" onClick={() => void downloadTemplate()}>
              Modèle
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <UploadCloud className="size-5 text-primary" />
          <h2 className="font-semibold">Importer un catalogue</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Glissez un fichier CSV ou cliquez pour le sélectionner. Les produits existants sont mis à
          jour par correspondance <strong>Nom + Marque</strong> ; les autres sont créés.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);
            void loadFile(event.dataTransfer.files?.[0]);
          }}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") fileRef.current?.click();
          }}
          role="button"
          tabIndex={0}
          className={`mt-4 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
          }`}
        >
          <UploadCloud className="size-8 text-primary" />
          <p className="mt-3 text-sm font-medium">{fileName || "Déposer un fichier CSV ici"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            CSV UTF-8 · 5 Mo max · colonnes du modèle
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Une ligne contenant un champ invalide (prix, stock, catégorie, statut…) est{" "}
          <strong>ignorée</strong> : elle n'est pas écrite et l'import continue avec les lignes
          suivantes. Le rapport d'erreurs la liste.
        </p>

        {progress > 0 && (
          <div className="mt-4">
            <Progress value={progress} />
            <p className="mt-1 text-xs text-muted-foreground">
              {progress < 35
                ? "Lecture du fichier…"
                : progress < 60
                  ? "Validation des lignes…"
                  : progress < 100
                    ? "Import en cours…"
                    : "Terminé."}
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {preview && preview.headersOk && (
          <div className="mt-6 space-y-4">
            {preview.fileErrors.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {preview.fileErrors.map((entry) => (
                  <p key={entry}>{entry}</p>
                ))}
              </div>
            )}
            {preview.unknownHeaders.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Colonnes ignorées : {preview.unknownHeaders.join(", ")}.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Lignes", value: preview.summary.total },
                { label: "Valides", value: preview.summary.valid },
                { label: "Créations", value: preview.summary.create },
                { label: "Mises à jour", value: preview.summary.update },
              ].map((entry) => (
                <div key={entry.label} className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{entry.label}</p>
                  <p className="mt-1 font-mono text-xl font-semibold">{entry.value}</p>
                </div>
              ))}
            </div>

            {preview.summary.invalid > 0 && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="size-4" /> {preview.summary.invalid} ligne(s) en erreur —
                elles seront ignorées.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void runImport()}
                disabled={busy || preview.summary.valid === 0 || result !== null}
              >
                <CheckCircle2 /> Importer {preview.summary.valid} ligne(s) valide(s)
              </Button>
              {errorRows.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      `erreurs-catalogue-${new Date().toISOString().slice(0, 10)}.csv`,
                      errorReportCsv(errorRows),
                    )
                  }
                >
                  <FileDown /> Rapport d'erreurs
                </Button>
              )}
              <Button variant="ghost" onClick={reset}>
                <RefreshCw /> Recommencer
              </Button>
            </div>

            <div className="max-h-96 overflow-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="sticky top-0 border-b bg-card text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Ligne</th>
                    <th className="px-2 py-2">Nom</th>
                    <th className="px-2 py-2">Marque</th>
                    <th className="px-2 py-2">Catégorie</th>
                    <th className="px-2 py-2">Prix</th>
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2">Erreurs</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.rows.slice(0, 200).map((row) => (
                    <tr
                      key={row.line}
                      className={row.action === "invalid" ? "bg-destructive/5" : ""}
                    >
                      <td className="px-2 py-2 font-mono text-xs">{row.line}</td>
                      <td className="px-2 py-2">{row.row?.name ?? row.raw.name}</td>
                      <td className="px-2 py-2">{row.row?.brand ?? row.raw.brand}</td>
                      <td className="px-2 py-2">{row.row?.categoryLabel ?? row.raw.category}</td>
                      <td className="px-2 py-2 font-mono">
                        {row.row ? `${row.row.price} MAD` : row.raw.price}
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          variant="outline"
                          className={
                            row.action === "invalid"
                              ? "text-destructive border-destructive/30"
                              : row.action === "update"
                                ? "text-warning border-warning/30"
                                : "text-success border-success/30"
                          }
                        >
                          {row.action === "invalid"
                            ? "Erreur"
                            : row.action === "update"
                              ? "Mise à jour"
                              : "Création"}
                        </Badge>
                        {row.existingTitle && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            → {row.existingTitle}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-destructive">
                        {row.errors.join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.truncated && (
              <p className="text-xs text-muted-foreground">
                Prévisualisation limitée aux 500 premières lignes.
              </p>
            )}

            {result && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                <p className="flex items-center gap-2 font-semibold text-success">
                  <CheckCircle2 className="size-4" /> Import terminé
                </p>
                <p className="mt-1 text-sm">
                  {result.created.length} créé(s), {result.updated.length} mis à jour,{" "}
                  {result.failed.length} échec(s), {result.invalidLines.length} ligne(s) ignorée(s)
                  pour champ invalide.
                </p>
                {result.invalidLines.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Les lignes ignorées n'ont pas été écrites ; consultez le rapport d'erreurs pour
                    les corriger.
                  </p>
                )}
                {result.failed.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-destructive">
                    {result.failed.map((entry) => (
                      <li key={`${entry.line}-${entry.name}`}>
                        Ligne {entry.line} : {entry.name} — {entry.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Structure attendue (11 colonnes)</p>
        <p className="mt-2 font-mono">{CSV_HEADERS.join(" ; ")}</p>
        <p className="mt-2">
          Catégories valides :{" "}
          {[
            "Sans catégorie",
            "Whey & Protéines",
            "Gainers",
            "Créatine",
            "Pré-Workout",
            "BCAA & Acides Aminés",
            "Brûleurs de graisse",
            "Vitamines & Santé",
            "Barres & Snacks",
          ].join(", ")}
          .
        </p>
        <p className="mt-1">
          Statut : « Publié » ou « Brouillon ». Booléen : Oui/Non ou 1/0. Saveurs séparées par des
          virgules.
        </p>
      </section>
    </div>
  );
}
