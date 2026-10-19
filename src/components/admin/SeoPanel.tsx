import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { getSeoAudit } from "@/lib/seo.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const scoreTone = (score: number) =>
  score >= 80 ? "text-success" : score >= 55 ? "text-warning" : "text-destructive";
const barTone = (score: number) =>
  score >= 80 ? "bg-success" : score >= 55 ? "bg-warning" : "bg-destructive";

export function SeoPanel() {
  const auditFn = useServerFn(getSeoAudit);
  const audit = useQuery({ queryKey: ["admin", "seo"], queryFn: () => auditFn(), retry: false });

  if (audit.isPending)
    return <p className="py-12 text-center text-sm text-muted-foreground">Analyse du catalogue…</p>;
  if (audit.isError || !audit.data) {
    return <p className="py-12 text-center text-sm text-destructive">Audit SEO indisponible.</p>;
  }
  const data = audit.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Score global</p>
          <p className={`font-mono text-5xl font-bold ${scoreTone(data.score)}`}>
            {data.score}/100
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.publishedCount} produits publiés sur {data.productCount} · {data.baseUrl}
          </p>
        </div>
        <Button variant="outline" onClick={() => void audit.refetch()} disabled={audit.isFetching}>
          <RefreshCw className={audit.isFetching ? "animate-spin" : ""} /> Relancer l'audit
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Score produits (moyenne)</p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold ${scoreTone(data.averageProductScore)}`}
          >
            {data.averageProductScore}/100
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Sitemap</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            {data.sitemapReady ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
            {data.sitemapReady ? "Généré au build" : "Manquant"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Titres dupliqués</p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold ${data.duplicates.length ? "text-warning" : "text-success"}`}
          >
            {data.duplicates.length}
          </p>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Technique & pages
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-y text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Page</th>
                <th className="px-3 py-2 font-medium">Titre / description</th>
                <th className="px-3 py-2 font-medium">État</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.site.map((entry) => (
                <tr key={entry.path}>
                  <td className="px-3 py-2 font-mono text-xs">{entry.path}</td>
                  <td className="px-3 py-2">
                    <p>{entry.title}</p>
                    <p className="text-xs text-muted-foreground">{entry.description}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={
                        entry.ok
                          ? "text-success border-success/30"
                          : "text-destructive border-destructive/30"
                      }
                    >
                      {entry.ok ? "OK" : "À corriger"}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Produits ({data.products.length})
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-y text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">À corriger</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.products.map((product) => (
                <tr key={product.id} className={product.issues.length ? "" : "opacity-70"}>
                  <td className="px-3 py-3">
                    <p className="max-w-72">{product.title}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">/{product.slug}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm ${scoreTone(product.score)}`}>
                        {product.score}
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full ${barTone(product.score)}`}
                          style={{ width: `${product.score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {product.issues.length === 0 ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="size-3" /> Complet
                      </span>
                    ) : (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {product.issues.slice(0, 3).map((issue) => (
                          <li key={issue} className="flex items-start gap-1">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />
                            {issue}
                          </li>
                        ))}
                        {product.issues.length > 3 && (
                          <li>+{product.issues.length - 3} autre(s)</li>
                        )}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={`/product/${product.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Voir <ExternalLink className="size-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.duplicates.length > 0 && (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-4">
          <p className="text-sm font-semibold">Titres dupliqués</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
            {data.duplicates.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Audit généré le {new Date(data.checkedAt).toLocaleString("fr-MA")}. Le sitemap est régénéré
        à chaque build (<span className="font-mono">npm run build</span>).
      </p>
    </div>
  );
}
