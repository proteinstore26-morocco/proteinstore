import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { unitPrice, shippingFor, type Campaign } from "./pricing";

const orderSchema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  customer_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  customer_phone: z.string().trim().regex(/^(\+212|0)[5-7]\d{8}$/),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  postal: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(20), flavor: z.string().max(60).optional() })).min(1).max(30),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    const auth = getRequestHeader("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
      userId = u.user?.id ?? null;
    }
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const [{ data: products }, { data: campaigns }] = await Promise.all([
      supabaseAdmin.from("products").select("id,title,price,sale_price,category_id,stock_quantity,status").in("id", ids),
      supabaseAdmin.from("campaigns").select("*").eq("is_active", true),
    ]);
    const lines = [];
    for (const it of data.items) {
      const p = products?.find((x) => x.id === it.productId);
      if (!p || p.status !== "published") return { ok: false as const, error: "Un produit n'est plus disponible." };
      if (p.stock_quantity < it.qty) return { ok: false as const, error: `Stock insuffisant pour « ${p.title} ».` };
      lines.push({ p, qty: it.qty, flavor: it.flavor, price: unitPrice(p, (campaigns ?? []) as Campaign[]).price });
    }
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const shipping = shippingFor(subtotal);
    const order_number = "PS" + Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10);
    const { data: order, error } = await supabaseAdmin.from("orders").insert({
      order_number, user_id: userId, customer_name: data.customer_name, customer_email: data.customer_email || null,
      customer_phone: data.customer_phone, shipping_address: { address: data.address, city: data.city, postal: data.postal ?? "" },
      subtotal, shipping_cost: shipping, total: subtotal + shipping, payment_method: "cod", notes: data.notes || null,
    }).select("id").single();
    if (error || !order) { console.error(error); return { ok: false as const, error: "Impossible d'enregistrer la commande." }; }
    await supabaseAdmin.from("order_items").insert(lines.map((l) => ({ order_id: order.id, product_id: l.p.id, product_title: l.p.title, variant_name: l.flavor ?? null, quantity: l.qty, price_at_purchase: l.price })));
    for (const l of lines) await supabaseAdmin.from("products").update({ stock_quantity: l.p.stock_quantity - l.qty }).eq("id", l.p.id);
    return { ok: true as const, order_number, phone: data.customer_phone };
  });

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ order_number: z.string().trim().min(3).max(30), phone: z.string().trim().min(6).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("orders")
      .select("order_number,customer_name,customer_phone,shipping_address,subtotal,shipping_cost,total,status,created_at,order_items(product_title,variant_name,quantity,price_at_purchase)")
      .eq("order_number", data.order_number.toUpperCase()).maybeSingle();
    const norm = (s: string) => s.replace(/\D/g, "").slice(-9);
    if (!o || norm(o.customer_phone) !== norm(data.phone)) return null;
    const { customer_phone: _p, ...rest } = o;
    return rest;
  });
