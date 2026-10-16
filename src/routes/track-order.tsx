import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/track-order")({
  head: () => ({ meta: [{ title: "track order — PROTEIN STORE®" }, { name: "description", content: "PROTEIN STORE® Kénitra — track order" }, { property: "og:title", content: "track order — PROTEIN STORE®" }, { property: "og:description", content: "Compléments 100% authentiques au Maroc." }] }),
  component: () => <main className="container-ps section-ps"><h1 className="headline text-5xl capitalize">track order</h1><p className="mt-4 text-muted-foreground">Page en cours de construction.</p></main>,
});
