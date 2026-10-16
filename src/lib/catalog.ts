import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCatalog } from "./catalog.functions";
import { unitPrice } from "./pricing";

export const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog(), staleTime: 60_000 });

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;
export type Product = Catalog["products"][number];

export function useCatalog() {
  return useSuspenseQuery(catalogQuery).data;
}

export function priceOf(p: Product, campaigns: Catalog["campaigns"]) {
  return unitPrice(p, campaigns);
}
