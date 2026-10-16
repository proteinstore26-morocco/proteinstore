import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/partners")({
  head: () => ({ meta: [{ title: "partners — PROTEIN STORE®" }, { name: "description", content: "PROTEIN STORE® Kénitra — partners" }, { property: "og:title", content: "partners — PROTEIN STORE®" }, { property: "og:description", content: "Compléments 100% authentiques au Maroc." }] }),
  component: () => <main className="container-ps section-ps"><h1 className="headline text-5xl capitalize">partners</h1><p className="mt-4 text-muted-foreground">Page en cours de construction.</p></main>,
});
