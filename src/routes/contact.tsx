import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Instagram, MapPin } from "lucide-react";
import { INSTAGRAM } from "@/components/site/Layout";
import { whatsappUrl, WHATSAPP_DISPLAY } from "@/lib/whatsapp";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Contact — PROTEIN STORE® Kénitra" },
      { name: "description", content: "Contactez Protein Store sur WhatsApp ou Instagram." },
      { property: "og:title", content: "Contact — PROTEIN STORE®" },
      { property: "og:description", content: "WhatsApp +212 776 566 089." },
    ],
  }),
  component: () => (
    <main className="container-ps section-ps max-w-3xl">
      <h1 className="headline text-5xl">Contact</h1>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <a
          href={whatsappUrl("Bonjour PROTEIN STORE® 👋")}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-border bg-card p-6 hover:border-primary"
        >
          <MessageCircle className="size-8 text-primary" />
          <p className="mt-4 font-semibold">WhatsApp</p>
          <p className="text-sm text-muted-foreground">{WHATSAPP_DISPLAY}</p>
        </a>
        <a
          href={INSTAGRAM}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-border bg-card p-6 hover:border-primary"
        >
          <Instagram className="size-8 text-primary" />
          <p className="mt-4 font-semibold">Instagram</p>
          <p className="text-sm text-muted-foreground">@proteinestore</p>
        </a>
        <div className="rounded-xl border border-border bg-card p-6">
          <MapPin className="size-8 text-primary" />
          <p className="mt-4 font-semibold">Boutique</p>
          <p className="text-sm text-muted-foreground">Kénitra, Maroc</p>
        </div>
      </div>
    </main>
  ),
});
