import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loginToEmail } from "@/lib/auth";
import { syncMyAccount } from "@/lib/account.functions";
import { roleAtLeast } from "@/lib/account-types";
import { STATIC_MODE } from "@/lib/static-mode";
import { staticSignIn, staticSignUp, staticTopRole } from "@/lib/static-backend";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
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
  const sync = useServerFn(syncMyAccount);
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInGoogle() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      setMsg("Connexion Google indisponible pour le moment.");
      setBusy(false);
    }
    // En cas de succès, le navigateur est redirigé vers Google puis revenu ici.
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = loginToEmail(String(form.get("login")));
    const password = String(form.get("password"));

    try {
      if (mode === "forgot") {
        if (STATIC_MODE) {
          setMsg(
            "Réinitialisation indisponible en démo statique — écrivez-nous sur WhatsApp Business pour réinitialiser votre mot de passe.",
          );
          return;
        }
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
        if (STATIC_MODE) {
          const res = staticSignIn(email, password);
          if (!res.ok || !res.session) {
            setMsg("Identifiant ou mot de passe incorrect.");
            return;
          }
          window.dispatchEvent(new Event("ps-static-auth"));
          const role = staticTopRole(res.session.user.id);
          if (roleAtLeast(role, "manager")) nav({ to: "/admin" });
          else nav({ to: "/account" });
          return;
        }
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

      if (STATIC_MODE) {
        const res = staticSignUp(email, password, String(form.get("name")));
        setMsg(
          res.ok
            ? "Compte créé ! Connectez-vous avec vos identifiants."
            : (res.error ?? "Erreur lors de la création du compte."),
        );
        if (res.ok) setMode("in");
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: { full_name: String(form.get("name")) },
        },
      });
      setMsg(
        error
          ? error.message
          : "Un e-mail de confirmation vient de partir : confirmez votre adresse (obligatoire) pour activer votre compte. Vérifiez aussi les spams.",
      );
    } catch (submitError) {
      console.error("[auth] submit failed", submitError);
      setMsg("Connexion effectuée, mais le profil est momentanément indisponible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "in"
      ? t("Connexion")
      : mode === "up"
        ? t("Créer mon compte")
        : t("Mot de passe oublié ?");

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
            <Label htmlFor="name">{t("Nom")}</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
        )}
        <div>
          <Label htmlFor="login">{mode === "in" ? t("Identifiant ou e-mail") : t("E-mail")}</Label>
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
            <Label htmlFor="password">{t("Mot de passe")}</Label>
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
            ? t("Envoi…")
            : mode === "in"
              ? t("Se connecter")
              : mode === "up"
                ? t("Créer mon compte")
                : t("Envoyer le lien")}
        </Button>
      </form>

      {mode === "in" && (
        <div className="mt-6">
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={signInGoogle}
            disabled={busy}
          >
            <svg viewBox="0 0 24 24" className="mr-2 size-4" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
              />
            </svg>
            {t("Continuer avec Google")}
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode === "in" && (
          <button
            onClick={() => {
              setMode("forgot");
              setMsg("");
            }}
            className="text-primary hover:underline"
          >
            {t("Mot de passe oublié ?")}
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
            {t("Retour à la connexion")}
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
            {mode === "in" ? t("Pas de compte ? Inscrivez-vous") : t("Déjà un compte ? Connectez-vous")}
          </button>
        )}
      </div>
    </main>
  );
}
