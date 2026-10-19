import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, MessageCircle, ShieldCheck } from "lucide-react";
import { useCart } from "@/lib/cart";
import { mad, shippingFor } from "@/lib/pricing";
import { whatsappUrl, WHATSAPP_DISPLAY } from "@/lib/whatsapp";
import { createOrder } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Commande — PROTEIN STORE®" },
      {
        name: "description",
        content: "Finalisez votre commande sur WhatsApp, paiement à la livraison partout au Maroc.",
      },
      { property: "og:title", content: "Commande — PROTEIN STORE®" },
      {
        property: "og:description",
        content: "Commande par WhatsApp, paiement à la livraison partout au Maroc.",
      },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shipping = shippingFor(subtotal);

  if (!items.length) {
    return (
      <main className="container-ps section-ps text-center">
        <h1 className="headline text-4xl">Votre panier est vide</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Découvrir la boutique</Link>
        </Button>
      </main>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");

    try {
      const result = await createOrder({
        data: {
          customer_name: value("name"),
          customer_email: value("email"),
          customer_phone: value("phone"),
          city: value("city"),
          address: value("address"),
          notes: value("notes"),
          items: items.map((item) => ({
            slug: item.slug,
            qty: item.qty,
            ...(item.flavor ? { flavor: item.flavor } : {}),
          })),
        },
      });

      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }

      clear();
      // Same-tab redirect after the order is safely stored: WhatsApp app on mobile,
      // WhatsApp Web on desktop, with the full order prefilled.
      window.location.assign(result.whatsappUrl);
    } catch (submitError) {
      console.error("[checkout] order failed", submitError);
      setError(
        "La commande n'a pas pu être enregistrée. Réessayez ou commandez directement sur WhatsApp.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="container-ps section-ps">
      <h1 className="headline text-5xl">Commande</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Renseignez vos coordonnées : la commande est enregistrée, puis WhatsApp s'ouvre avec le
        récapitulatif complet. Notre équipe confirme la livraison et vous payez en espèces à la
        réception.
      </p>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom complet *</Label>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone *</Label>
            <Input
              id="phone"
              name="phone"
              required
              placeholder="06 XX XX XX XX"
              pattern="^(\+212|0)\s?[5-7](\s?\d){8}$"
              autoComplete="tel"
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail (optionnel)</Label>
            <Input id="email" name="email" type="email" maxLength={255} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="city">Ville *</Label>
            <Input
              id="city"
              name="city"
              required
              defaultValue="Kénitra"
              maxLength={80}
              autoComplete="address-level2"
            />
          </div>
          <div>
            <Label htmlFor="address">Adresse *</Label>
            <Textarea
              id="address"
              name="address"
              required
              minLength={5}
              maxLength={300}
              autoComplete="street-address"
            />
          </div>
          <div>
            <Label htmlFor="notes">Remarques</Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={500}
              placeholder="Étage, repère, heure de livraison…"
            />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-primary bg-card p-4">
            <Banknote className="size-6 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Paiement à la livraison</p>
              <p className="text-sm text-muted-foreground">
                Vous payez en espèces à la réception. Aucun paiement en ligne.
              </p>
            </div>
          </div>
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <p>{error}</p>
              <a
                className="mt-2 inline-block font-medium underline"
                href={whatsappUrl("Bonjour PROTEIN STORE® 👋 Je souhaite passer une commande.")}
                target="_blank"
                rel="noreferrer"
              >
                Commander directement sur WhatsApp
              </a>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            <MessageCircle className="mr-2 size-5" />
            {busy
              ? "Enregistrement de la commande…"
              : `Commander sur WhatsApp · ${mad(subtotal + shipping)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Numéro de la boutique : <span className="font-mono">{WHATSAPP_DISPLAY}</span>
          </p>
        </form>

        <aside className="h-fit rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Récapitulatif</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.productId + (item.flavor ?? "")}
                className="flex justify-between gap-3 text-sm"
              >
                <span>
                  {item.qty} × {item.title}
                  {item.flavor ? ` (${item.flavor})` : ""}
                </span>
                <span className="shrink-0">{mad(item.qty * item.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <p className="flex justify-between">
              <span>Sous-total</span>
              <span>{mad(subtotal)}</span>
            </p>
            <p className="flex justify-between">
              <span>Livraison</span>
              <span>{shipping ? mad(shipping) : "Gratuite"}</span>
            </p>
            <p className="flex justify-between pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{mad(subtotal + shipping)}</span>
            </p>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Produits 100 % authentiques. Livraison partout au Maroc, gratuite dès 500 MAD.
          </p>
        </aside>
      </div>
    </main>
  );
}
