import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { unitPrice, shippingFor, type Campaign } from "./pricing";

const PHONE = /^(\+212|0)[5-7]\d{8}$/;

const orderSchema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  customer_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  customer_phone: z.string().trim().regex(PHONE),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  postal: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1).max(20),
        flavor: z.string().max(60).optional(),
      }),
    )
    .min(1)
    .max(30),
});

const CHECKOUT_UNAVAILABLE =
  "Le paiement à la livraison est momentanément indisponible. Commandez sur WhatsApp au +212 776 566 089.";
const STOCK_RACE = "Un produit vient d'être épuisé. Actualisez votre panier et réessayez.";

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    const { takeToken } = await import("./rate-limit");
    const { clientKey } = await import("./rate-limit.server");
    const limited = takeToken(`order:${clientKey()}`, 8, 10 * 60_000);
    if (!limited.ok) {
      return {
        ok: false as const,
        error: `Trop de tentatives. Réessayez dans ${limited.retryAfterSeconds} s ou commandez sur WhatsApp.`,
      };
    }

    // The `orders` table has no INSERT policy for anon/authenticated: order creation
    // is a server-only write and therefore requires the service role key.
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      console.error("[orders] SUPABASE_SERVICE_ROLE_KEY is not set — COD checkout is disabled.");
      return { ok: false as const, error: CHECKOUT_UNAVAILABLE };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    const auth = getRequestHeader("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
      userId = u.user?.id ?? null;
    }

    const ids = [...new Set(data.items.map((i) => i.productId))];
    const [{ data: products, error: productsError }, { data: campaigns }] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id,title,price,sale_price,flavors,category_id,stock_quantity,status")
        .in("id", ids),
      supabaseAdmin.from("campaigns").select("*").eq("is_active", true),
    ]);
    if (productsError) {
      console.error("[orders] product lookup failed", productsError);
      return {
        ok: false as const,
        error: "Impossible de vérifier le catalogue. Réessayez dans un instant.",
      };
    }

    const lines: {
      p: NonNullable<typeof products>[number];
      qty: number;
      flavor?: string;
      price: number;
    }[] = [];
    for (const it of data.items) {
      const p = products?.find((x) => x.id === it.productId);
      if (!p || p.status !== "published")
        return { ok: false as const, error: "Un produit n'est plus disponible." };
      if (p.stock_quantity < it.qty)
        return { ok: false as const, error: `Stock insuffisant pour « ${p.title} ».` };
      if (it.flavor && p.flavors.length > 0 && !p.flavors.includes(it.flavor)) {
        return {
          ok: false as const,
          error: `La saveur « ${it.flavor} » n'est plus disponible pour « ${p.title} ».`,
        };
      }
      lines.push({
        p,
        qty: it.qty,
        ...(it.flavor ? { flavor: it.flavor } : {}),
        price: unitPrice(p, (campaigns ?? []) as Campaign[]).price,
      });
    }

    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const shipping = shippingFor(subtotal);
    const order_number =
      "PS" + Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number,
        user_id: userId,
        customer_name: data.customer_name,
        customer_email: data.customer_email || null,
        customer_phone: data.customer_phone,
        shipping_address: { address: data.address, city: data.city, postal: data.postal ?? "" },
        subtotal,
        shipping_cost: shipping,
        total: subtotal + shipping,
        payment_method: "cod",
        notes: data.notes || null,
      })
      .select("id")
      .single();
    if (error || !order) {
      console.error("[orders] insert failed", error);
      return { ok: false as const, error: "Impossible d'enregistrer la commande. Réessayez." };
    }

    const items = await supabaseAdmin.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.p.id,
        product_title: l.p.title,
        variant_name: l.flavor ?? null,
        quantity: l.qty,
        price_at_purchase: l.price,
      })),
    );
    if (items.error) {
      console.error("[orders] items insert failed", items.error);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      return { ok: false as const, error: "Impossible d'enregistrer la commande. Réessayez." };
    }

    // Optimistic concurrency: only decrement if the stock is still the value we read.
    // A zero-row update means another order won the race, so the whole order rolls back.
    const decremented: typeof lines = [];
    for (const l of lines) {
      const { data: updated, error: stockError } = await supabaseAdmin
        .from("products")
        .update({ stock_quantity: l.p.stock_quantity - l.qty })
        .eq("id", l.p.id)
        .eq("stock_quantity", l.p.stock_quantity)
        .select("id");
      if (stockError || !updated || updated.length === 0) {
        console.error("[orders] stock update failed", stockError ?? "no rows matched");
        for (const d of decremented) {
          await supabaseAdmin
            .from("products")
            .update({ stock_quantity: d.p.stock_quantity })
            .eq("id", d.p.id);
        }
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        return { ok: false as const, error: STOCK_RACE };
      }
      decremented.push(l);
    }

    return { ok: true as const, order_number, phone: data.customer_phone };
  });

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        order_number: z.string().trim().min(3).max(30),
        phone: z.string().trim().min(6).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { takeToken } = await import("./rate-limit");
    const { clientKey } = await import("./rate-limit.server");
    const limited = takeToken(`track:${clientKey()}`, 20, 10 * 60_000);
    if (!limited.ok) throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number,customer_name,customer_phone,shipping_address,subtotal,shipping_cost,total,status,created_at,order_items(product_title,variant_name,quantity,price_at_purchase)",
      )
      .eq("order_number", data.order_number.toUpperCase())
      .maybeSingle();
    const norm = (s: string) => s.replace(/\D/g, "").slice(-9);
    if (!o || norm(o.customer_phone) !== norm(data.phone)) return null;
    const { customer_phone: _p, ...rest } = o;
    return rest;
  });
