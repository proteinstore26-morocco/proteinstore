export const SHIPPING_COST = 30;
export const SHIPPING_KENITRA = 20;
export const FREE_SHIPPING_THRESHOLD = 500;

export type PricedProduct = { id: string; price: number; sale_price: number | null; category_id: string | null };
export type Campaign = {
  id: string; name: string; discount_type: string; discount_value: number; applies_to_type: string;
  category_ids: string[]; product_ids: string[]; start_date: string; end_date: string; priority: number; is_active: boolean;
};

export function activeCampaignFor(p: PricedProduct, campaigns: Campaign[], now = new Date()): Campaign | null {
  const t = now.getTime();
  const list = campaigns.filter((c) => {
    if (!c.is_active || new Date(c.start_date).getTime() > t || new Date(c.end_date).getTime() < t) return false;
    if (c.applies_to_type === "all") return true;
    if (c.applies_to_type === "categories") return !!p.category_id && c.category_ids.includes(p.category_id);
    if (c.applies_to_type === "products") return c.product_ids.includes(p.id);
    return false;
  });
  list.sort((a, b) => b.priority - a.priority);
  return list[0] ?? null;
}

/** Final unit price in whole MAD, plus the crossed-out price when discounted. */
export function unitPrice(p: PricedProduct, campaigns: Campaign[], now = new Date()) {
  const base = p.sale_price != null && p.sale_price < p.price ? p.sale_price : p.price;
  const c = activeCampaignFor(p, campaigns, now);
  let final = base;
  if (c) final = c.discount_type === "fixed" ? Math.max(0, base - c.discount_value) : Math.round(base * (1 - c.discount_value / 100));
  return { price: final, compareAt: final < p.price ? p.price : null, percentOff: final < p.price ? Math.round((1 - final / p.price) * 100) : 0 };
}

/** Livraison : gratuite dès 500 MAD, 20 MAD à Kénitra, 30 MAD ailleurs. */
export function shippingFor(subtotal: number, city?: string | null) {
  if (subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0) return 0;
  const c = (city ?? "").trim().toLowerCase();
  return c === "kénitra" || c === "kenitra" ? SHIPPING_KENITRA : SHIPPING_COST;
}

export const mad = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;
