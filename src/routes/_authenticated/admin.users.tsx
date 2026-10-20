import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Utilisateurs — PROTEIN STORE®" },
      { name: "description", content: "Gestion des comptes, rôles et invitations." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { isRoot, loading } = useAuth();

  return (
    <main className="container-ps py-8 md:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <ShieldCheck className="size-4" /> Super admin
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">Utilisateurs & rôles</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Invitations, comptes, rôles et suspensions. Seul un compte root peut agir ici.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin">
            <ArrowLeft /> Tableau de bord
          </Link>
        </Button>
      </header>

      <div className="mt-8">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Vérification des droits…
          </p>
        ) : isRoot ? (
          <UsersPanel />
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <p className="text-sm text-destructive">
              Cette page est réservée au rôle <strong>root</strong>. Votre compte ne dispose pas de
              cet accès.
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
