import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { catalogQuery, useCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/partners")({
  head: () => ({ meta: [
    { title: "Salles partenaires — PROTEIN STORE® Kénitra" },
    { name: "description", content: "Les salles de sport partenaires de Kénitra et leurs avantages membres." },
    { property: "og:title", content: "Salles partenaires — PROTEIN STORE®" },
    { property: "og:description", content: "Avantages exclusifs pour les membres des salles partenaires." },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Partners,
});

function Partners() {
  const { partners } = useCatalog();
  return (
    <main className="container-ps section-ps">
      <h1 className="headline text-5xl">Salles partenaires</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Membre d'une de ces salles à Kénitra ? Présentez votre carte ou mentionnez votre salle lors de la commande pour profiter de votre avantage.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {partners.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-6">
            <h2 className="headline text-2xl">{p.name}</h2>
            {(p.address || p.location) && <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{p.address || p.location}</p>}
            {p.description && <p className="mt-3 text-sm">{p.description}</p>}
          </div>
        ))}
      </div>
    </main>
  );
}
