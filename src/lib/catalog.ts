import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCatalog } from "./catalog.functions";
import { STATIC_MODE } from "./static-mode";
import { unitPrice } from "./pricing";

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    if (STATIC_MODE) {
      const res = await fetch("/catalog-data.json");
      if (!res.ok) throw new Error("Catalogue indisponible");
      return (await res.json()) as Catalog;
    }
    return getCatalog();
  },
  staleTime: 60_000,
});

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;
export type Product = Catalog["products"][number];

export function useCatalog() {
  return useSuspenseQuery(catalogQuery).data;
}

export function priceOf(p: Product, campaigns: Catalog["campaigns"]) {
  return unitPrice(p, campaigns);
}
