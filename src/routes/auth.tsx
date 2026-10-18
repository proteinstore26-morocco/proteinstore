import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loginToEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { title: "Connexion — PROTEIN STORE®" },
    { name: "description", content: "Connectez-vous ou créez votre compte Protein Store." },
    { property: "og:title", content: "Connexion — PROTEIN STORE®" },
    { property: "og:description", content: "Accédez à votre compte." },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = loginToEmail(String(f.get("login")));
    const password = String(f.get("password"));
    if (mode === "in") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("Identifiant ou mot de passe incorrect.");
      else {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        nav({ to: roles?.some((r) => r.role !== "customer") ? "/admin" : "/account" });
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: String(f.get("name")) } } });
      setMsg(error ? error.message : "Vérifiez votre boîte mail pour confirmer votre compte.");
    }
    setBusy(false);
  }
  return (
    <main className="container-ps section-ps max-w-md">
      <h1 className="headline text-4xl">{mode === "in" ? "Connexion" : "Créer un compte"}</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "up" && <div><Label htmlFor="name">Nom</Label><Input id="name" name="name" required /></div>}
        <div><Label htmlFor="login">{mode === "in" ? "Identifiant ou e-mail" : "E-mail"}</Label><Input id="login" name="login" required type={mode === "up" ? "email" : "text"} /></div>
        <div><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required minLength={8} /></div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button className="w-full" disabled={busy}>{mode === "in" ? "Se connecter" : "Créer mon compte"}</Button>
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm text-primary hover:underline">{mode === "in" ? "Pas de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}</button>
    </main>
  );
}
