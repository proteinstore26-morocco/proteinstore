import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, Truck, Banknote } from "lucide-react";
import { getProduct } from "@/lib/catalog.functions";
import { catalogQuery, useCatalog, priceOf, type Product } from "@/lib/catalog";
import { productImage } from "@/lib/images";
import { mad } from "@/lib/pricing";
import { useCart } from "@/lib/cart";
import { Stars } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";

const productQuery = (slug: string) => queryOptions({ queryKey: ["product", slug], queryFn: () => getProduct({ data: { slug } }) });

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    const [d] = await Promise.all([context.queryClient.ensureQueryData(productQuery(params.slug)), context.queryClient.ensureQueryData(catalogQuery)]);
    if (!d.product) throw notFound();
    return { title: (d.product as unknown as Product).title };
  },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.title ?? "Produit"} — PROTEIN STORE®` },
    { name: "description", content: `${loaderData?.title ?? "Produit"} authentique, livré partout au Maroc, paiement à la livraison.` },
    { property: "og:title", content: `${loaderData?.title ?? "Produit"} — PROTEIN STORE®` },
    { property: "og:description", content: "Produit 100% authentique, paiement à la livraison." },
  ] }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(slug));
  const { campaigns } = useCatalog();
  const p = data.product as unknown as Product & { description: string | null; nutrition_facts: { label: string; value: string }[] };
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [flavor, setFlavor] = useState(p.flavors[0] ?? "");
  const pr = priceOf(p, campaigns);
  const out = p.stock_quantity <= 0;
  const img = productImage(p);
  return (
    <main className="container-ps section-ps">
      <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground">← Boutique</Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-card"><img src={img} alt={p.title} className="h-full w-full object-cover" /></div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">{p.brand}</p>
          <h1 className="headline mt-2 text-4xl">{p.title}</h1>
          <div className="mt-3 flex items-center gap-2"><Stars value={Number(p.rating)} /><span className="text-sm text-muted-foreground">({p.review_count} avis)</span></div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{mad(pr.price)}</span>
            {pr.compareAt && <span className="text-lg text-muted-foreground line-through">{mad(pr.compareAt)}</span>}
            {pr.percentOff > 0 && <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">-{pr.percentOff}%</span>}
          </div>
          <p className={`mt-2 text-sm ${out ? "text-destructive" : p.stock_quantity <= p.low_stock_threshold ? "text-gold" : "text-muted-foreground"}`}>
            {out ? "Rupture de stock" : p.stock_quantity <= p.low_stock_threshold ? `Plus que ${p.stock_quantity} en stock` : "En stock"}
          </p>
          {p.flavors.length > 0 && (
            <div className="mt-6"><p className="text-sm font-medium">Saveur</p>
              <div className="mt-2 flex flex-wrap gap-2">{p.flavors.map((f) => <button key={f} onClick={() => setFlavor(f)} className={`rounded-full border px-3 py-1 text-sm ${flavor === f ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{f}</button>)}</div>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <div className="flex items-center rounded-md border border-border">
              <button className="p-3" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins"><Minus className="size-4" /></button>
              <span className="w-8 text-center">{qty}</span>
              <button className="p-3" onClick={() => setQty(Math.min(p.stock_quantity, qty + 1))} aria-label="Plus"><Plus className="size-4" /></button>
            </div>
            <Button size="lg" className="flex-1" disabled={out} onClick={() => add({ productId: p.id, slug: p.slug, title: p.title, brand: p.brand, image: img, unitPrice: pr.price, ...(flavor ? { flavor } : {}), maxQty: p.stock_quantity }, qty)}>Ajouter au panier</Button>
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><Truck className="size-4 text-primary" />Livraison partout au Maroc, gratuite dès 500 MAD</p>
            <p className="flex items-center gap-2"><Banknote className="size-4 text-primary" />Paiement à la livraison</p>
          </div>
          {p.description && <p className="mt-8 whitespace-pre-line text-sm leading-relaxed">{p.description}</p>}
          {p.nutrition_facts?.length > 0 && (
            <table className="mt-6 w-full text-sm"><tbody>{p.nutrition_facts.map((n) => <tr key={n.label} className="border-b border-border"><td className="py-2">{n.label}</td><td className="py-2 text-right font-mono">{n.value}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
      {data.reviews.length > 0 && (
        <section className="mt-16"><h2 className="headline text-3xl">Avis clients</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">{data.reviews.map((r) => <div key={r.id} className="rounded-xl border border-border bg-card p-5"><Stars value={r.rating} /><p className="mt-2 text-sm">{r.comment}</p><p className="mt-2 text-xs text-muted-foreground">{r.author_name}</p></div>)}</div>
        </section>
      )}
    </main>
  );
}
