import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { shippingFor, unitPrice, type Campaign } from "./pricing";
import { normalizeMoroccanPhone } from "./phone";
import { buildOrderMessage, waUrlTo } from "./whatsapp";
import type { Order } from "./order-types";

const orderSchema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  customer_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  customer_phone: z.string().trim().min(9).max(20),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(300),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(200),
        qty: z.number().int().min(1).max(20),
        flavor: z.string().trim().max(60).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => orderSchema.parse(data))
  .handler(async ({ data }) => {
    const { takeToken } = await import("./rate-limit");
    const { clientKey } = await import("./rate-limit.server");
    const limited = takeToken(`order:${clientKey()}`, 8, 10 * 60_000);
    if (!limited.ok) {
      return {
        ok: false as const,
        error: `Trop de tentatives. Réessayez dans ${limited.retryAfterSeconds} s ou écrivez-nous sur WhatsApp.`,
      };
    }

    const phone = normalizeMoroccanPhone(data.customer_phone);
    if (!phone) {
      return { ok: false as const, error: "Numéro marocain invalide (ex. 0612345678)." };
    }

    try {
      const { publicServerClient } = await import("./supabase-public.server");
      const { orderStore } = await import("./order-store.server");
      const supabase = publicServerClient();
      const slugs = [...new Set(data.items.map((item) => item.slug))];
      const [{ data: products, error: productsError }, { data: campaigns }] = await Promise.all([
        supabase
          .from("products")
          .select("id,title,slug,price,sale_price,flavors,category_id,stock_quantity,status")
          .in("slug", slugs),
        supabase.from("campaigns").select("*").eq("is_active", true),
      ]);
      if (productsError) throw productsError;

      const lines: {
        product: NonNullable<typeof products>[number];
        qty: number;
        flavor?: string;
        price: number;
      }[] = [];
      for (const item of data.items) {
        const product = products?.find((entry) => entry.slug === item.slug);
        if (!product || product.status !== "published") {
          return { ok: false as const, error: "Un produit n'est plus disponible." };
        }
        if (product.stock_quantity < item.qty) {
          return { ok: false as const, error: `Stock insuffisant pour « ${product.title} ».` };
        }
        if (item.flavor && product.flavors.length > 0 && !product.flavors.includes(item.flavor)) {
          return {
            ok: false as const,
            error: `La saveur « ${item.flavor} » n'est plus disponible.`,
          };
        }
        lines.push({
          product,
          qty: item.qty,
          ...(item.flavor ? { flavor: item.flavor } : {}),
          price: unitPrice(product, (campaigns ?? []) as Campaign[]).price,
        });
      }

      const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
      const shipping = shippingFor(subtotal);
      const order: Order = orderStore().createOrder({
        customerName: data.customer_name,
        customerPhone: phone,
        customerPhoneNorm: phone,
        customerEmail: data.customer_email || null,
        city: data.city,
        address: data.address,
        notes: data.notes || null,
        subtotal,
        shipping,
        total: subtotal + shipping,
        items: lines.map((line) => ({
          productSlug: line.product.slug,
          productTitle: line.product.title,
          variant: line.flavor ?? null,
          quantity: line.qty,
          unitPrice: line.price,
        })),
      });

      const message = buildOrderMessage({
        orderNumber: order.orderNumber,
        name: data.customer_name,
        phone,
        ...(data.customer_email ? { email: data.customer_email } : {}),
        city: data.city,
        address: data.address,
        ...(data.notes ? { notes: data.notes } : {}),
        items: lines.map((line) => ({
          title: line.product.title,
          qty: line.qty,
          unitPrice: line.price,
          ...(line.flavor ? { flavor: line.flavor } : {}),
        })),
        subtotal,
        shipping,
        total: subtotal + shipping,
      });

      orderStore().recordWhatsApp({
        phone,
        orderId: order.id,
        template: "order_created",
        body: message,
      });

      return {
        ok: true as const,
        orderNumber: order.orderNumber,
        orderId: order.id,
        total: order.total,
        whatsappUrl: waUrlTo(phone, message),
      };
    } catch (error) {
      console.error("[orders] create failed", error);
      return {
        ok: false as const,
        error: "La commande n'a pas pu être enregistrée. Réessayez ou écrivez-nous sur WhatsApp.",
      };
    }
  });

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        order_number: z.string().trim().min(3).max(40),
        phone: z.string().trim().min(6).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { takeToken } = await import("./rate-limit");
    const { clientKey } = await import("./rate-limit.server");
    const limited = takeToken(`track:${clientKey()}`, 20, 10 * 60_000);
    if (!limited.ok) throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
    const { orderStore } = await import("./order-store.server");
    return orderStore().tracking(data.order_number, data.phone);
  });
