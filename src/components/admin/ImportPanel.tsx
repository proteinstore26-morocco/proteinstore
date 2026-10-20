import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckSquare,
  Download,
  FileCode2,
  Globe,
  ImageOff,
  Lock,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addImportHost,
  getImportHosts,
  importProducts,
  previewProductImport,
  removeImportHost,
} from "@/lib/import.functions";
import type { PreviewProduct } from "@/lib/import-products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_SOURCE = "https://powernutritionstore.de/products-de/";

type Preview = {
  source: string;
  translation: "deepl" | "glossary";
  total: number;
  truncated: boolean;
  legalNotice: string;
  products: PreviewProduct[];
};

type ImportResult = {
  source: string;
  translation: "deepl" | "glossary";
  imported: { handle: string; slug: string; title: string; categorySlug: string | null }[];
  skipped: { handle: string; reason: string }[];
  total: number;
};

export function ImportPanel() {
  const previewFn = useServerFn(previewProductImport);
  const importFn = useServerFn(importProducts);
  const hostsFn = useServerFn(getImportHosts);
  const addHostFn = useServerFn(addImportHost);
  const removeHostFn = useServerFn(removeImportHost);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"url" | "html">("url");
  const [url, setUrl] = useState(DEFAULT_SOURCE);
  const [html, setHtml] = useState("");
  const [legal, setLegal] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newHost, setNewHost] = useState("");
  const [hostBusy, setHostBusy] = useState(false);

  const hosts = useQuery({
    queryKey: ["admin", "import-hosts"],
    queryFn: () => hostsFn({ data: undefined }),
    retry: false,
  });

  const importable = useMemo(
    () => (preview?.products ?? []).filter((product) => !product.exists),
    [preview],
  );
  const selectedCount = selected.size;

  async function runPreview() {
    setError("");
    setResult(null);
    setBusy(true);
    setPreview(null);
    setSelected(new Set());
    try {
      const data = await previewFn({
        data: {
          mode,
          url,
          legalAccepted: true,
          ...(mode === "html" ? { html } : {}),
        },
      });
      setPreview(data);
      setSelected(
        new Set(
          data.products.filter((product) => !product.exists).map((product) => product.handle),
        ),
      );
      if (data.products.length === 0) toast.error("Aucun produit détecté.");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!preview || selectedCount === 0) return;
    setBusy(true);
    setError("");
    try {
      const data = await importFn({
        data: {
          mode,
          url,
          legalAccepted: true,
          handles: [...selected],
          ...(mode === "html" ? { html } : {}),
        },
      });
      setResult(data);
      setSelected(new Set());
      setPreview((current) =>
        current
          ? {
              ...current,
              products: current.products.map((product) =>
                selected.has(product.handle) ? { ...product, exists: true } : product,
              ),
            }
          : current,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(`${data.imported.length} brouillon(s) importé(s).`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_500_000) {
      toast.error("Fichier trop volumineux (limite 1,5 Mo).");
      return;
    }
    const text = await file.text();
    setHtml(text);
    toast.success("HTML chargé. Cliquez sur « Analyser la source ».");
  }

  async function addHost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHostBusy(true);
    try {
      await addHostFn({ data: { host: newHost } });
      setNewHost("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "import-hosts"] });
      toast.success("Domaine autorisé.");
    } catch (hostError) {
      toast.error(hostError instanceof Error ? hostError.message : "Domaine invalide.");
    } finally {
      setHostBusy(false);
    }
  }

  async function dropHost(host: string) {
    setHostBusy(true);
    try {
      await removeHostFn({ data: { host } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "import-hosts"] });
      toast.success("Domaine retiré.");
    } catch (hostError) {
      toast.error(hostError instanceof Error ? hostError.message : "Retrait impossible.");
    } finally {
      setHostBusy(false);
    }
  }

  function toggle(handle: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }

  function toggleAll() {
    if (selectedCount === importable.length) setSelected(new Set());
    else setSelected(new Set(importable.map((product) => product.handle)));
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          Import réservé aux administrateurs — brouillons uniquement
        </p>
        <p className="mt-2 text-muted-foreground">
          Les produits sont créés avec <strong>prix 0, stock 0 et statut brouillon</strong> : ils ne
          sont pas visibles sur le site public. Vous devrez renseigner prix, stock et description,
          puis publier depuis le catalogue. Vous devez disposer des droits sur les textes et images
          importés.
        </p>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <h2 className="font-semibold">Domaines autorisés (IMPORT_ALLOWED_HOSTS)</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Les domaines ajoutés ici s'ajoutent à la variable serveur{" "}
          <span className="font-mono">IMPORT_ALLOWED_HOSTS</span>. Ils autorisent l'import par URL
          et servent de base aux images en mode HTML.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(hosts.data?.entries ?? []).map((entry) => (
            <span
              key={entry.host}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
            >
              {entry.source === "env" ? (
                <Lock className="size-3 text-muted-foreground" />
              ) : (
                <Globe className="size-3 text-primary" />
              )}
              <span className="font-mono">{entry.host}</span>
              {entry.source === "env" ? (
                <span className="text-muted-foreground">env</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void dropHost(entry.host)}
                  disabled={hostBusy}
                  aria-label={`Retirer ${entry.host}`}
                  className="text-destructive hover:opacity-80"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </span>
          ))}
          {hosts.isPending && <span className="text-xs text-muted-foreground">Chargement…</span>}
          {hosts.isError && <span className="text-xs text-destructive">Liste indisponible.</span>}
        </div>
        <form onSubmit={addHost} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="new-import-host">Ajouter un domaine</Label>
            <Input
              id="new-import-host"
              value={newHost}
              onChange={(event) => setNewHost(event.target.value)}
              placeholder="boutique-exemple.com"
            />
          </div>
          <Button type="submit" variant="outline" disabled={hostBusy || newHost.trim().length < 3}>
            <Plus /> Autoriser
          </Button>
        </form>
      </section>

      <Tabs
        value={mode}
        onValueChange={(value) => {
          setMode(value as "url" | "html");
          setPreview(null);
          setResult(null);
          setError("");
        }}
      >
        <TabsList className="h-auto bg-transparent p-0">
          <TabsTrigger value="url" className="gap-2 px-4 py-3">
            <Globe className="size-4" /> Depuis une URL
          </TabsTrigger>
          <TabsTrigger value="html" className="gap-2 px-4 py-3">
            <FileCode2 className="size-4" /> Depuis un HTML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="mt-4 space-y-4">
          <div>
            <Label htmlFor="source-url">URL du catalogue (page catégorie ou boutique)</Label>
            <Input id="source-url" value={url} onChange={(event) => setUrl(event.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              L'import tente le flux <span className="font-mono">/products.json</span> du site
              (hôtes autorisés :<span className="font-mono"> powernutritionstore.de</span>). Si le
              site bloque les robots, utilisez l'onglet HTML.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="html" className="mt-4 space-y-4">
          <div>
            <Label htmlFor="base-url">URL de la page (pour résoudre les images)</Label>
            <Input id="base-url" value={url} onChange={(event) => setUrl(event.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Download /> Charger un fichier HTML
            </Button>
            <span className="text-xs text-muted-foreground">
              Dans votre navigateur : Ctrl+S / Cmd+S, ou clic droit → Inspecter → copier le HTML.
            </span>
          </div>
          <div>
            <Label htmlFor="html-source">Code source de la page (max 1,5 Mo)</Label>
            <Textarea
              id="html-source"
              rows={10}
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              placeholder="<html>…</html>"
              className="font-mono text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Le parseur lit les données <span className="font-mono">JSON-LD Product</span> et, à
            défaut, les balises Open Graph. Une page produit individuelle fonctionne mieux qu'une
            page de catégorie.
          </p>
        </TabsContent>
      </Tabs>

      <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          checked={legal}
          onChange={(event) => setLegal(event.target.checked)}
          className="mt-1 size-4"
        />
        <span>
          Je confirme disposer des droits nécessaires pour importer ces contenus et images, et je
          m'engage à les conserver en brouillon jusqu'à validation.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void runPreview()} disabled={busy || !legal}>
          <Globe /> {busy ? "Analyse…" : "Analyser la source"}
        </Button>
        {preview && (
          <Badge variant="outline">
            {preview.translation === "deepl" ? "Traduction DeepL" : "Glossaire local — à relire"}
          </Badge>
        )}
        {preview && (
          <span className="text-xs text-muted-foreground">
            {preview.products.length} produit(s) affiché(s)
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {preview && preview.products.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {selectedCount === importable.length ? (
                <CheckSquare className="size-4" />
              ) : (
                <Square className="size-4" />
              )}
              Tout sélectionner ({importable.length} importables)
            </button>
            <Button onClick={() => void runImport()} disabled={busy || selectedCount === 0}>
              <Download /> Importer {selectedCount} brouillon(s)
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-y text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2 font-medium">Aperçu</th>
                  <th className="px-2 py-2 font-medium">Titre (FR)</th>
                  <th className="px-2 py-2 font-medium">Marque</th>
                  <th className="px-2 py-2 font-medium">Catégorie</th>
                  <th className="px-2 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.products.map((product) => (
                  <tr key={product.handle} className={product.exists ? "opacity-50" : ""}>
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${product.titleFr}`}
                        checked={selected.has(product.handle)}
                        disabled={product.exists}
                        onChange={() => toggle(product.handle)}
                        className="size-4"
                      />
                    </td>
                    <td className="px-2 py-3">
                      {product.imageUrls[0] ? (
                        <img
                          src={product.imageUrls[0]}
                          alt=""
                          className="size-14 rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-14 place-items-center rounded-md border text-muted-foreground">
                          <ImageOff className="size-5" />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <p className="max-w-72 font-medium">{product.titleFr}</p>
                      <p className="mt-1 line-clamp-2 max-w-72 text-xs text-muted-foreground">
                        {product.descriptionFr.slice(0, 140)}
                      </p>
                      {product.exists && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Déjà au catalogue
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{product.brand || "—"}</td>
                    <td className="px-2 py-3">
                      <Badge variant="outline">{product.categorySlug ?? "non classé"}</Badge>
                    </td>
                    <td className="px-2 py-3">
                      <a
                        href={product.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Voir la source
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.sourcePrice !== null
                          ? `${product.sourcePrice} ${product.currency}`
                          : "prix inconnu"}{" "}
                        (non importé)
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.truncated && (
            <p className="mt-2 text-xs text-muted-foreground">
              Seuls les 50 premiers produits sont affichés.
            </p>
          )}
        </section>
      )}

      {result && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Import terminé</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.imported.length} brouillon(s) créé(s), {result.skipped.length} ignoré(s). Les
            produits ne sont pas publics tant que vous ne les publiez pas.
          </p>
          {result.imported.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {result.imported.map((product) => (
                <li key={product.slug} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-warning border-warning/30">
                    brouillon
                  </Badge>
                  <span>{product.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">/{product.slug}</span>
                </li>
              ))}
            </ul>
          )}
          {result.skipped.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {result.skipped.map((item) => (
                <li key={item.handle}>
                  • {item.handle} : {item.reason}
                </li>
              ))}
            </ul>
          )}
          <Button asChild className="mt-4">
            <Link to="/admin/store">Ouvrir le catalogue pour compléter et publier</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
