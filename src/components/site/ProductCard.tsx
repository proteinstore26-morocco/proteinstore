import { Link } from "@tanstack/react-router";
import { Star, Plus } from "lucide-react";
import type { Catalog, Product } from "@/lib/catalog";
import { priceOf } from "@/lib/catalog";
import { productImage } from "@/lib/images";
import { mad } from "@/lib/pricing";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-gold text-gold" : "text-muted-foreground"} />)}
    </div>
  );
}

export function ProductCard({ p, campaigns }: { p: Product; campaigns: Catalog["campaigns"] }) {
  const { add } = useCart();
  const { t } = useI18n();
  const pr = priceOf(p, campaigns);
  const img = productImage(p);
  const out = p.stock_quantity <= 0;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/60">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-background">
        <img src={img} alt={p.title} loading="lazy" className={`size-full object-cover transition-transform duration-700 group-hover:scale-105 ${out ? "grayscale" : ""}`} />
        {pr.percentOff > 0 && !out && <span className="absolute start-3 top-3 animate-pulse rounded-full bg-primary px-2.5 py-1 font-mono text-xs font-bold">-{pr.percentOff}%</span>}
        {out && <span className="absolute inset-0 grid place-items-center bg-background/60"><span className="rounded-full border bg-background px-3 py-1 text-xs font-bold uppercase">{t("Indisponible")}</span></span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{p.brand}</p>
        <Link to="/product/$slug" params={{ slug: p.slug }} className="mt-1 line-clamp-2 min-h-10 text-sm font-medium hover:text-primary">{p.title}</Link>
        <div className="mt-2 flex items-center gap-1.5"><Stars value={Number(p.rating)} size={12} /><span className="text-xs text-muted-foreground">({p.review_count})</span></div>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className={`font-mono text-lg font-bold ${pr.compareAt ? "text-primary" : ""}`}>{mad(pr.price)}</p>
            {pr.compareAt && <p className="font-mono text-xs text-muted-foreground line-through">{mad(pr.compareAt)}</p>}
          </div>
          {!out && (
            <button aria-label="Ajouter au panier" onClick={() => add({ productId: p.id, slug: p.slug, title: p.title, brand: p.brand, image: img, unitPrice: pr.price, maxQty: p.stock_quantity })}
              className="grid size-10 place-items-center rounded-full bg-primary transition-transform hover:scale-110 md:opacity-0 md:group-hover:opacity-100">
              <Plus className="size-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
