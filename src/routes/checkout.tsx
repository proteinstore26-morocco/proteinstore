import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Banknote } from "lucide-react";
import { useCart } from "@/lib/cart";
import { createOrder } from "@/lib/orders.functions";
import { mad, shippingFor } from "@/lib/pricing";
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
        content: "Finalisez votre commande, paiement à la livraison partout au Maroc.",
      },
      { property: "og:title", content: "Commande — PROTEIN STORE®" },
      { property: "og:description", content: "Paiement à la livraison partout au Maroc." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const shipping = shippingFor(subtotal);

  if (done)
    return (
      <main className="container-ps section-ps max-w-xl text-center">
        <CheckCircle2 className="mx-auto size-16 text-primary" />
        <h1 className="headline mt-6 text-4xl">Commande confirmée !</h1>
        <p className="mt-4 text-muted-foreground">
          Votre numéro de commande : <span className="font-mono text-foreground">{done}</span>. Nous
          vous appellerons pour confirmer la livraison.
        </p>
        <Button asChild className="mt-8">
          <Link to="/track-order">Suivre ma commande</Link>
        </Button>
      </main>
    );
  if (!items.length)
    return (
      <main className="container-ps section-ps text-center">
        <h1 className="headline text-4xl">Votre panier est vide</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Découvrir la boutique</Link>
        </Button>
      </main>
    );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    try {
      const r = await createOrder({
        data: {
          customer_name: g("name"),
          customer_email: g("email"),
          customer_phone: g("phone").replace(/\s/g, ""),
          address: g("address"),
          city: g("city"),
          notes: g("notes"),
          items: items.map((i) => ({ productId: i.productId, qty: i.qty, flavor: i.flavor })),
        },
      });
      if (r.ok) {
        clear();
        setDone(r.order_number);
      } else setErr(r.error);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setErr(
        /trop de tentatives/i.test(detail)
          ? detail
          : "La commande n'a pas pu être enregistrée. Vérifiez vos informations (téléphone au format 06XXXXXXXX) ou commandez sur WhatsApp.",
      );
    }
    setBusy(false);
  }

  return (
    <main className="container-ps section-ps">
      <h1 className="headline text-5xl">Commande</h1>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom complet *</Label>
            <Input id="name" name="name" required minLength={2} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone *</Label>
            <Input
              id="phone"
              name="phone"
              required
              placeholder="06 XX XX XX XX"
              pattern="^(\+212|0)\s?[5-7](\s?\d){8}$"
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail (optionnel)</Label>
            <Input id="email" name="email" type="email" maxLength={255} />
          </div>
          <div>
            <Label htmlFor="city">Ville *</Label>
            <Input id="city" name="city" required defaultValue="Kénitra" maxLength={80} />
          </div>
          <div>
            <Label htmlFor="address">Adresse *</Label>
            <Textarea id="address" name="address" required minLength={5} maxLength={300} />
          </div>
          <div>
            <Label htmlFor="notes">Remarques</Label>
            <Textarea id="notes" name="notes" maxLength={500} />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-primary bg-card p-4">
            <Banknote className="size-6 text-primary" />
            <div>
              <p className="font-semibold">Paiement à la livraison</p>
              <p className="text-sm text-muted-foreground">Vous payez en espèces à la réception.</p>
            </div>
          </div>
          {err && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <p>{err}</p>
              <a
                className="mt-2 inline-block font-medium underline"
                href="https://wa.me/212776566089"
                target="_blank"
                rel="noreferrer"
              >
                Commander sur WhatsApp
              </a>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Envoi…" : `Confirmer la commande · ${mad(subtotal + shipping)}`}
          </Button>
        </form>
        <aside className="h-fit rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Récapitulatif</h2>
          <ul className="mt-4 space-y-3">
            {items.map((i) => (
              <li key={i.productId + i.flavor} className="flex justify-between gap-3 text-sm">
                <span>
                  {i.qty} × {i.title}
                  {i.flavor ? ` (${i.flavor})` : ""}
                </span>
                <span className="shrink-0">{mad(i.qty * i.unitPrice)}</span>
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
        </aside>
      </div>
    </main>
  );
}
