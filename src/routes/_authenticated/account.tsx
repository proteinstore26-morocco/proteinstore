import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },{ title: "Mon compte — PROTEIN STORE®" }, { name: "description", content: "Votre compte Protein Store." }, { property: "og:title", content: "Mon compte — PROTEIN STORE®" }, { property: "og:description", content: "Votre compte." }] }),
  component: Account,
});

function Account() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function logout() {
    await queryClient.cancelQueries(); queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }
  return (
    <main className="container-ps section-ps max-w-xl">
      <h1 className="headline text-4xl">Mon compte</h1>
      <p className="mt-4 text-muted-foreground">{user?.email}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/track-order">Suivre une commande</Link></Button>
        {isAdmin && <Button asChild><Link to="/admin">Administration</Link></Button>}
        <Button variant="ghost" onClick={logout}>Déconnexion</Button>
      </div>
    </main>
  );
}
