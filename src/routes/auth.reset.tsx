import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/reset")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — PROTEIN STORE®" },
      {
        name: "description",
        content: "Choisissez un nouveau mot de passe pour votre compte Protein Store.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPassword,
});

type State = "checking" | "ready" | "invalid" | "done";

function ResetPassword() {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setState("ready");
    });

    const detect = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) setState("ready");
      else setState((current) => (current === "ready" ? current : "invalid"));
    };

    void detect();
    // Supabase parses the recovery tokens from the URL just after mount.
    const timer = window.setTimeout(() => void detect(), 1200);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      console.error("[auth] password update failed", updateError);
      setError("Le lien a expiré ou le mot de passe a été refusé. Demandez un nouveau lien.");
      return;
    }
    setState("done");
  }

  return (
    <main className="container-ps section-ps max-w-md">
      <h1 className="headline text-4xl">Nouveau mot de passe</h1>

      {state === "checking" && (
        <p className="mt-4 text-sm text-muted-foreground" aria-busy="true">
          Vérification du lien…
        </p>
      )}

      {state === "invalid" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-destructive">
            Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis la page de connexion.
          </p>
          <Button asChild>
            <Link to="/auth">Demander un nouveau lien</Link>
          </Button>
        </div>
      )}

      {state === "ready" && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
            <Input
              id="confirmation"
              name="confirmation"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </Button>
        </form>
      )}

      {state === "done" && (
        <div className="mt-4 space-y-4">
          <p role="status" className="text-sm text-success">
            Mot de passe mis à jour. Vous êtes connecté avec le nouveau mot de passe.
          </p>
          <Button asChild>
            <Link to="/account">Continuer</Link>
          </Button>
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Le lien de réinitialisation est valable une heure. Si vous ne l'avez pas demandé, ignorez
        cet e-mail.
      </p>
    </main>
  );
}
