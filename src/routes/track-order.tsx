import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { buildTrackingMessage, whatsappUrl, WHATSAPP_DISPLAY } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/track-order")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Suivi de commande — PROTEIN STORE®" },
      {
        name: "description",
        content: "Suivez votre commande avec votre numéro et votre téléphone, sur WhatsApp.",
      },
      { property: "og:title", content: "Suivi de commande — PROTEIN STORE®" },
      { property: "og:description", content: "Où en est votre commande ?" },
    ],
  }),
  component: Track,
});

function Track() {
  const [redirecting, setRedirecting] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = buildTrackingMessage(String(form.get("n") ?? ""), String(form.get("p") ?? ""));
    setRedirecting(true);
    window.location.assign(whatsappUrl(message));
  }

  return (
    <main className="container-ps section-ps max-w-2xl">
      <h1 className="headline text-5xl">Suivi de commande</h1>
      <p className="mt-4 text-muted-foreground">
        Le suivi est assuré par notre équipe sur WhatsApp. Indiquez votre numéro de commande (si
        vous l'avez) et le téléphone utilisé lors de la commande : le chat s'ouvre avec le message
        prêt à envoyer.
      </p>
      <form onSubmit={submit} className="mt-8 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          name="n"
          placeholder="N° de commande (optionnel)"
          maxLength={30}
          aria-label="Numéro de commande"
        />
        <Input
          name="p"
          placeholder="Téléphone"
          maxLength={30}
          aria-label="Téléphone"
          inputMode="tel"
        />
        <Button disabled={redirecting}>
          <MessageCircle className="mr-2 size-4" />
          {redirecting ? "Ouverture…" : "Suivre sur WhatsApp"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Pas encore de numéro ? Écrivez-nous directement au{" "}
        <a
          href={whatsappUrl("Bonjour PROTEIN STORE® 👋 Je souhaite suivre ma commande.")}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-primary underline"
        >
          {WHATSAPP_DISPLAY}
        </a>
        .
      </p>
    </main>
  );
}
