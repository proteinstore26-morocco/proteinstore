import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, ShieldCheck, Banknote, MessageCircle } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { catalogQuery, useCatalog } from "@/lib/catalog";
import { categoryImages } from "@/lib/images";
import { ProductCard, Stars } from "@/components/site/ProductCard";
import { PartnerMarquee } from "@/components/site/PartnerMarquee";
import { Countdown } from "@/components/site/Countdown";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";
import { useI18n } from "@/lib/i18n";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "PROTEIN STORE® Kénitra — Whey, créatine & compléments authentiques" },
      {
        name: "description",
        content:
          "La boutique de nutrition sportive de Kénitra. Produits 100% authentiques, livraison partout au Maroc, paiement à la livraison.",
      },
      { property: "og:title", content: "PROTEIN STORE® Kénitra" },
      {
        property: "og:description",
        content: "Compléments authentiques, livraison au Maroc, paiement à la livraison.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Home,
});

function Home() {
  const { t } = useI18n();
  const { products, categories, campaigns, partners, reviews } = useCatalog();
  const now = Date.now();
  const camp = campaigns.find(
    (c) => new Date(c.end_date).getTime() > now && new Date(c.start_date).getTime() < now,
  );
  const top = [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 8);
  const featured = products.filter((p) => p.is_featured).slice(0, 4);
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <section className="hero-animated relative overflow-hidden">
        <img
          src={hero}
          alt="Athlète Protein Store"
          className="hero-zoom absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div aria-hidden className="steam pointer-events-none absolute inset-0 overflow-hidden">
          <span className="steam-puff" style={{ left: "8%", bottom: "-20%", animationDelay: "0s", animationDuration: "11s" }} />
          <span className="steam-puff" style={{ left: "30%", bottom: "-25%", animationDelay: "3.5s", animationDuration: "14s" }} />
          <span className="steam-puff" style={{ left: "55%", bottom: "-18%", animationDelay: "1.8s", animationDuration: "12s" }} />
          <span className="steam-puff" style={{ left: "76%", bottom: "-22%", animationDelay: "5.2s", animationDuration: "15s" }} />
        </div>
        <div className="container-ps relative py-24 md:py-36">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            {t("Kénitra · Depuis le Maroc")}
          </p>
          <h1 className="headline mt-4 max-w-3xl text-5xl md:text-7xl">
            {t("Nutrition sportive")}{" "}
            <span className="text-primary">{t("100% authentique.")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            {t("Whey, créatine, gainers, pré-workouts. Livraison partout au Maroc et paiement à la livraison.")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/shop">{t("Voir la boutique")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href={whatsappUrl("Bonjour PROTEIN STORE® 👋 Je souhaite un conseil produit.")}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-2 size-4" />
                Conseil WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="container-ps grid gap-6 py-8 md:grid-cols-3">
          {[
            [Truck, "Livraison au Maroc", "Gratuite dès 500 MAD"],
            [Banknote, "Paiement à la livraison", "Payez en espèces à réception"],
            [ShieldCheck, "100% authentique", "Produits originaux garantis"],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Truck;
            return (
              <div key={t as string} className="flex items-center gap-4">
                <Icon className="size-8 text-primary" />
                <div>
                  <p className="font-semibold">{t as string}</p>
                  <p className="text-sm text-muted-foreground">{d as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {camp && (
        <section className="container-ps pt-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest">Offre limitée</p>
              <h2 className="headline mt-2 text-4xl">
                {camp.name} : -{camp.discount_value}
                {camp.discount_type === "fixed" ? " MAD" : "%"}
              </h2>
            </div>
            <Countdown to={camp.end_date} />
          </div>
        </section>
      )}

      <section className="container-ps section-ps">
        <h2 className="headline text-4xl">Catégories</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/shop"
              search={{ cat: c.slug }}
              className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-card"
            >
              <img
                src={c.image_url || categoryImages[c.slug] || categoryImages.whey}
                alt={c.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
              <p className="headline absolute bottom-4 left-4 text-xl">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-ps pb-16">
        <div className="flex items-end justify-between">
          <h2 className="headline text-4xl">Meilleures ventes</h2>
          <Link to="/shop" className="text-sm text-primary hover:underline">
            Tout voir →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {top.map((p) => (
            <ProductCard key={p.id} p={p} campaigns={campaigns} />
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="container-ps pb-16">
          <h2 className="headline text-4xl">Sélection du coach</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} campaigns={campaigns} />
            ))}
          </div>
        </section>
      )}

      <PartnerMarquee partners={partners} />

      {reviews.length > 0 && (
        <section className="container-ps section-ps">
          <h2 className="headline text-4xl">Ils nous font confiance</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-6">
                <Stars value={r.rating} />
                <p className="mt-3 text-sm">« {r.comment} »</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  {r.author_name}
                  {r.city ? ` · ${r.city}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
