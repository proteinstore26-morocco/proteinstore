import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { catalogQuery, useCatalog, priceOf } from "@/lib/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { Input } from "@/components/ui/input";

const search = z.object({ cat: z.string().optional(), q: z.string().optional() });

export const Route = createFileRoute("/shop")({
  validateSearch: search,
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { title: "Boutique — PROTEIN STORE® Kénitra" },
    { name: "description", content: "Tous nos compléments : whey, gainers, créatine, pré-workout, acides aminés, brûleurs et santé." },
    { property: "og:title", content: "Boutique — PROTEIN STORE®" },
    { property: "og:description", content: "Compléments 100% authentiques au Maroc." },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Shop,
});

function Shop() {
  const { products, categories, campaigns } = useCatalog();
  const { cat, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("pop");
  const [query, setQuery] = useState(q ?? "");
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort() as string[], [products]);
  const list = useMemo(() => {
    let l = products.filter((p) => (!cat || p.category?.slug === cat) && (!brand || p.brand === brand) && (!query || `${p.title} ${p.brand}`.toLowerCase().includes(query.toLowerCase())));
    const pr = (p: (typeof l)[number]) => priceOf(p, campaigns).price;
    if (sort === "asc") l = [...l].sort((a, b) => pr(a) - pr(b));
    else if (sort === "desc") l = [...l].sort((a, b) => pr(b) - pr(a));
    else l = [...l].sort((a, b) => b.sold_count - a.sold_count);
    return l;
  }, [products, cat, brand, query, sort, campaigns]);

  const chip = (active: boolean) => `rounded-full border px-4 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`;
  return (
    <main className="container-ps section-ps">
      <h1 className="headline text-5xl">Boutique</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        <button className={chip(!cat)} onClick={() => navigate({ search: { q } })}>Tout</button>
        {categories.map((c) => <button key={c.id} className={chip(cat === c.slug)} onClick={() => navigate({ search: { cat: c.slug, q } })}>{c.name}</button>)}
      </div>
      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <Input placeholder="Rechercher un produit…" value={query} onChange={(e) => setQuery(e.target.value)} className="md:max-w-sm" />
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Toutes les marques</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="pop">Popularité</option><option value="asc">Prix croissant</option><option value="desc">Prix décroissant</option>
        </select>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{list.length} produit(s)</p>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">{list.map((p) => <ProductCard key={p.id} p={p} campaigns={campaigns} />)}</div>
    </main>
  );
}
