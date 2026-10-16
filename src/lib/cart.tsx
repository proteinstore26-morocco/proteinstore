import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = { productId: string; slug: string; title: string; brand: string | null; image: string; unitPrice: number; flavor?: string; qty: number; maxQty: number };

type Ctx = {
  items: CartItem[]; open: boolean; setOpen: (o: boolean) => void;
  add: (i: Omit<CartItem, "qty">, qty?: number) => void; setQty: (key: string, q: number) => void; remove: (key: string) => void; clear: () => void;
  count: number; subtotal: number;
};
const CartCtx = createContext<Ctx | null>(null);
export const itemKey = (i: { productId: string; flavor?: string }) => `${i.productId}:${i.flavor ?? ""}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem("ps-cart") || "[]")); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem("ps-cart", JSON.stringify(items)); }, [items, loaded]);

  const add: Ctx["add"] = (i, qty = 1) => {
    setItems((prev) => {
      const k = itemKey(i);
      const ex = prev.find((p) => itemKey(p) === k);
      if (ex) return prev.map((p) => (itemKey(p) === k ? { ...p, qty: Math.min(p.maxQty, p.qty + qty) } : p));
      return [...prev, { ...i, qty: Math.min(i.maxQty, qty) }];
    });
    setOpen(true);
  };
  const setQty = (k: string, q: number) => setItems((prev) => prev.map((p) => (itemKey(p) === k ? { ...p, qty: Math.max(1, Math.min(p.maxQty, q)) } : p)));
  const remove = (k: string) => setItems((prev) => prev.filter((p) => itemKey(p) !== k));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  return <CartCtx.Provider value={{ items, open, setOpen, add, setQty, remove, clear, count, subtotal }}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
