import { Link } from "@tanstack/react-router";
import type { Catalog } from "@/lib/catalog";

function Logo({ name }: { name: string }) {
  return (
    <div className="mx-4 flex h-12 shrink-0 items-center rounded-full border px-6 grayscale opacity-50 transition-all duration-300 hover:scale-110 hover:border-primary hover:opacity-100 hover:grayscale-0 hover:drop-shadow-[0_0_12px_var(--color-primary)] md:h-16 md:px-8">
      <span className="headline whitespace-nowrap text-lg text-foreground md:text-2xl">{name}</span>
    </div>
  );
}

export function PartnerMarquee({ partners }: { partners: Catalog["partners"] }) {
  const half = Math.ceil(partners.length / 2);
  const rows = [partners.slice(0, half), partners.slice(half).concat(partners.slice(0, 2))];
  return (
    <section className="relative overflow-hidden section-ps">
      <div className="pointer-events-none absolute inset-0 grain opacity-60" />
      <div className="container-ps relative text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Trusted by Champions</p>
        <h2 className="headline mt-3 text-4xl md:text-6xl">Nos partenaires à Kénitra</h2>
      </div>
      <div className="relative mt-12 space-y-6 fade-edges">
        {rows.map((r, i) => (
          <div key={i} className="flex overflow-hidden">
            <div className={`flex w-max ${i === 0 ? "animate-marquee-left" : "animate-marquee-right"}`}>
              {[...r, ...r].map((p, j) => <Logo key={p.id + j} name={p.name} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-10 text-center">
        <Link to="/partners" className="text-sm font-semibold text-primary hover:underline">Membre d'un de ces clubs ? Débloquez vos remises partenaires →</Link>
      </div>
    </section>
  );
}
