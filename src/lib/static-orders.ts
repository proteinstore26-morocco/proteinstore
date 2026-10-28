// Commandes simulées en mode statique (Cloudflare Pages) — stockées en localStorage.
import type { OrderStatus } from "./order-types";

export type StaticOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  total: number;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid";
  createdAt: string;
  items: { title: string; quantity: number; lineTotal: number }[];
};

const KEY = "ps_static_orders";

export function listStaticOrders(): StaticOrder[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as StaticOrder[];
  } catch {
    return [];
  }
}

export function saveStaticOrder(order: StaticOrder): void {
  const all = listStaticOrders();
  all.unshift(order);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 50)));
}

export function nextStaticOrderNumber(): string {
  const n = Number(localStorage.getItem("ps_static_order_seq") || "0") + 1;
  localStorage.setItem("ps_static_order_seq", String(n));
  return `PS-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
}

export function findStaticOrders({
  orderNumber,
  phone,
}: {
  orderNumber?: string | undefined;
  phone?: string | undefined;
}): StaticOrder[] {
  const all = listStaticOrders();
  const norm = (p: string) => p.replace(/\D/g, "").slice(-9);
  if (orderNumber && phone) {
    return all.filter(
      (o) =>
        o.orderNumber.toUpperCase() === orderNumber.toUpperCase() &&
        norm(o.customerPhone).endsWith(norm(phone)),
    );
  }
  if (phone) {
    return all.filter((o) => norm(o.customerPhone).endsWith(norm(phone)));
  }
  return [];
}
