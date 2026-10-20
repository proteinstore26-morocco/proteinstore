import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loginToEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Connexion — PROTEIN STORE®" },
      {
        name: "description",
        content:
          "Connectez-vous, créez votre compte ou réinitialisez votre mot de passe Protein Store.",
      },
      { property: "og:title", content: "Connexion — PROTEIN STORE®" },
      { property: "og:description", content: "Accédez à votre compte." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

type Mode = "in" | "up" | "forgot";

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = loginToEmail(String(form.get("login")));
    const password = String(form.get("password"));

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        // Do not reveal whether the account exists (prevents account enumeration).
        if (error) console.error("[auth] reset request failed", error);
        setMsg(
          "Si un compte existe pour cet e-mail, un lien de réinitialisation vient d'être envoyé. Vérifiez votre boîte mail et les spams.",
        );
        return;
      }

      if (mode === "in") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMsg("Identifiant ou mot de passe incorrect.");
          return;
        }
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        if (roles?.some((role) => role.role !== "customer")) nav({ to: "/admin" });
        else nav({ to: "/account" });
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: String(form.get("name")) },
        },
      });
      setMsg(error ? error.message : "Vérifiez votre boîte mail pour confirmer votre compte.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "in" ? "Connexion" : mode === "up" ? "Créer un compte" : "Mot de passe oublié";

  return (
    <main className="container-ps section-ps max-w-md">
      <h1 className="headline text-4xl">{title}</h1>
      {mode === "forgot" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Indiquez l'e-mail du compte. Vous recevrez un lien valable une heure pour choisir un
          nouveau mot de passe.
        </p>
      )}
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "up" && (
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
        )}
        <div>
          <Label htmlFor="login">{mode === "in" ? "Identifiant ou e-mail" : "E-mail"}</Label>
          <Input
            id="login"
            name="login"
            required
            type={mode === "in" ? "text" : "email"}
            autoComplete="email"
            placeholder={mode === "forgot" ? "admin@proteinestore.ma" : undefined}
          />
        </div>
        {mode !== "forgot" && (
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />
          </div>
        )}
        {msg && (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {msg}
          </p>
        )}
        <Button className="w-full" disabled={busy}>
          {busy
            ? "Envoi…"
            : mode === "in"
              ? "Se connecter"
              : mode === "up"
                ? "Créer mon compte"
                : "Envoyer le lien"}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode === "in" && (
          <button
            onClick={() => {
              setMode("forgot");
              setMsg("");
            }}
            className="text-primary hover:underline"
          >
            Mot de passe oublié ?
          </button>
        )}
        {mode === "forgot" && (
          <button
            onClick={() => {
              setMode("in");
              setMsg("");
            }}
            className="text-primary hover:underline"
          >
            Retour à la connexion
          </button>
        )}
        {mode !== "forgot" && (
          <button
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setMsg("");
            }}
            className="text-primary hover:underline"
          >
            {mode === "in" ? "Pas de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
          </button>
        )}
      </div>
    </main>
  );
}
