import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "À propos — PROTEIN STORE® Kénitra" },
    { name: "description", content: "Protein Store, votre boutique de nutrition sportive à Kénitra." },
    { property: "og:title", content: "À propos — PROTEIN STORE®" },
    { property: "og:description", content: "Votre boutique de nutrition sportive à Kénitra." },
  ] }),
  component: () => (
    <main className="container-ps section-ps max-w-3xl">
      <h1 className="headline text-5xl">À propos</h1>
      <div className="mt-8 space-y-4 text-lg text-muted-foreground">
        <p>PROTEIN STORE® est une boutique de nutrition sportive basée à Kénitra. Notre mission : proposer des compléments 100% authentiques aux sportifs de tout le Maroc.</p>
        <p>Whey, créatine, gainers, pré-workouts, acides aminés : nous sélectionnons les grandes marques et conseillons chaque client selon ses objectifs.</p>
        <p>Livraison partout au Maroc, paiement à la livraison, et conseils personnalisés sur WhatsApp.</p>
      </div>
    </main>
  ),
});
