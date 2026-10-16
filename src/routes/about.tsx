import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "about — PROTEIN STORE®" }, { name: "description", content: "PROTEIN STORE® Kénitra — about" }, { property: "og:title", content: "about — PROTEIN STORE®" }, { property: "og:description", content: "Compléments 100% authentiques au Maroc." }] }),
  component: () => <main className="container-ps section-ps"><h1 className="headline text-5xl capitalize">about</h1><p className="mt-4 text-muted-foreground">Page en cours de construction.</p></main>,
});
