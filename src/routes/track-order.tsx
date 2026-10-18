import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trackOrder } from "@/lib/orders.functions";
import { mad } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const STATUS_FR: Record<string, string> = { pending: "En attente", confirmed: "Confirmée", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };

export const Route = createFileRoute("/track-order")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { title: "Suivi de commande — PROTEIN STORE®" },
    { name: "description", content: "Suivez votre commande avec votre numéro et votre téléphone." },
    { property: "og:title", content: "Suivi de commande — PROTEIN STORE®" },
    { property: "og:description", content: "Où en est votre commande ?" },
  ] }),
  component: Track,
});

function Track() {
  const [res, setRes] = useState<Awaited<ReturnType<typeof trackOrder>> | undefined>();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true);
    const f = new FormData(e.currentTarget);
    try { setRes(await trackOrder({ data: { order_number: String(f.get("n")), phone: String(f.get("p")) } })); } catch { setRes(null); }
    setBusy(false);
  }
  return (
    <main className="container-ps section-ps max-w-2xl">
      <h1 className="headline text-5xl">Suivi de commande</h1>
      <form onSubmit={submit} className="mt-8 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input name="n" placeholder="N° de commande (PS…)" required />
        <Input name="p" placeholder="Téléphone" required />
        <Button disabled={busy}>Rechercher</Button>
      </form>
      {res === null && <p className="mt-6 text-destructive">Aucune commande trouvée avec ces informations.</p>}
      {res && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex justify-between"><p className="font-mono">{res.order_number}</p><span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">{STATUS_FR[res.status]}</span></div>
          <ul className="mt-4 space-y-1 text-sm">{res.order_items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.quantity} × {i.product_title}</span><span>{mad(i.quantity * i.price_at_purchase)}</span></li>)}</ul>
          <p className="mt-4 border-t border-border pt-4 text-right font-bold">Total : {mad(res.total)}</p>
        </div>
      )}
    </main>
  );
}
