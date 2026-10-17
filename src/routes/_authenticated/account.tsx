import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Mon compte — PROTEIN STORE®" }, { name: "description", content: "Votre compte Protein Store." }, { property: "og:title", content: "Mon compte — PROTEIN STORE®" }, { property: "og:description", content: "Votre compte." }] }),
  component: Account,
});

function Account() {
  const { user, isAdmin } = useAuth();
  return (
    <main className="container-ps section-ps max-w-xl">
      <h1 className="headline text-4xl">Mon compte</h1>
      <p className="mt-4 text-muted-foreground">{user?.email}</p>
      <div className="mt-8 flex gap-3">
        <Button asChild variant="outline"><Link to="/track-order">Suivre une commande</Link></Button>
        {isAdmin && <p className="self-center text-sm text-primary">Accès administrateur actif</p>}
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Déconnexion</Button>
      </div>
    </main>
  );
}
