import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { CatalogueIoPanel } from "@/components/admin/CatalogueIoPanel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/catalogue")({
  head: () => ({
    meta: [
      { title: "Catalogue CSV — PROTEIN STORE®" },
      { name: "description", content: "Exporter et importer le catalogue produits en CSV." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CatalogueIoPage,
});

function CatalogueIoPage() {
  const { isAdmin, loading } = useAuth();

  return (
    <main className="container-ps py-8 md:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <FileSpreadsheet className="size-4" /> Catalogue
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">Import / Export CSV</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Exporter le catalogue filtré, ou importer un fichier avec prévisualisation et rapport
            d'erreurs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin">
              <ArrowLeft /> Tableau de bord
            </Link>
          </Button>
          <AdminUserMenu />
        </div>
      </header>

      <div className="mt-8">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Vérification des droits…
          </p>
        ) : isAdmin ? (
          <CatalogueIoPanel />
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <p className="text-sm text-destructive">
              Import/export réservé aux administrateurs et super admins.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/admin">Retour au tableau de bord</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
