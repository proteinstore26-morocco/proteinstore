import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({ meta: [{ title: "Produit — PROTEIN STORE®" }, { name: "description", content: "Fiche produit PROTEIN STORE®" }, { property: "og:title", content: "Produit — PROTEIN STORE®" }, { property: "og:description", content: "Compléments 100% authentiques au Maroc." }] }),
  component: () => <main className="container-ps section-ps"><h1 className="headline text-5xl">Produit</h1><p className="mt-4 text-muted-foreground">Page en cours de construction.</p></main>,
});
