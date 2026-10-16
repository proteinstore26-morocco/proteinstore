import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "shop — PROTEIN STORE®" }, { name: "description", content: "PROTEIN STORE® Kénitra — shop" }, { property: "og:title", content: "shop — PROTEIN STORE®" }, { property: "og:description", content: "Compléments 100% authentiques au Maroc." }] }),
  component: () => <main className="container-ps section-ps"><h1 className="headline text-5xl capitalize">shop</h1><p className="mt-4 text-muted-foreground">Page en cours de construction.</p></main>,
});
