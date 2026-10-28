import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/confirm")({
  head: () => ({
    meta: [
      { title: "Confirmation du compte — PROTEIN STORE®" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Confirm,
});

/**
 * Callback des e-mails transactionnels (confirmation d'inscription, etc.).
 * Supabase renvoie ici avec ?token_hash=…&type=signup : on échange contre une
 * session via verifyOtp, puis on emmène le client vers son compte.
 */
function Confirm() {
  const [msg, setMsg] = useState("Confirmation de votre adresse e-mail…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.search,
    );
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") ?? "signup") as "signup" | "email" | "recovery";

    (async () => {
      if (!tokenHash) {
        setMsg("Lien de confirmation incomplet. Réouvrez l'e-mail ou demandez un nouveau lien.");
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) {
        console.error("[auth] confirm failed", error);
        setMsg("Lien invalide ou déjà utilisé. Demandez un nouvel e-mail de confirmation.");
        return;
      }
      setMsg("Adresse confirmée ! Votre compte est actif — redirection vers votre compte…");
      setTimeout(() => {
        window.location.assign("/account");
      }, 900);
    })();
  }, []);

  return (
    <main className="container-ps section-ps max-w-md text-center">
      <h1 className="headline text-3xl">Confirmation</h1>
      <p role="status" aria-live="polite" className="mt-4 text-muted-foreground">
        {msg}
      </p>
      <Button asChild variant="outline" className="mt-8">
        <Link to="/auth">Retour à la connexion</Link>
      </Button>
    </main>
  );
}
