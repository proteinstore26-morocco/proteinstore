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
  promo_code: z.string().trim().max(50).optional(),
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

/** Vérifie un code promo salle partenaire : {ok, label, percent} ou {ok:false}. */
export const validatePromo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(3).max(50) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { takeToken } = await import("./rate-limit");
    const { clientKey } = await import("./rate-limit.server");
    if (!takeToken(`promo:${clientKey()}`, 20, 10 * 60_000).ok) {
      return { ok: false as const, error: "Trop de tentatives." };
    }
    const code = data.code.toUpperCase();
    const { publicServerClient } = await import("./supabase-public.server");
    const { data: partners, error } = await publicServerClient()
      .from("partners")
      .select("name,discount_code,discount_percent,is_active")
      .eq("discount_code", code)
      .eq("is_active", true)
      .limit(1);
    if (error) return { ok: false as const, error: "Code promo indisponible." };
    const partner = (partners ?? [])[0];
    if (!partner) return { ok: false as const, error: "Code promo inconnu ou expiré." };
    const percent = Number(partner.discount_percent ?? 10);
    return {
      ok: true as const,
      code,
      label: `Club ${partner.name} (-${percent} %)`,
      percent,
    };
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

      // Code promo salle partenaire (remise sur le sous-total)
      let discount = 0;
      let promoCode: string | null = null;
      let promoLabel: string | null = null;
      if (data.promo_code) {
        const { publicServerClient: promoClient } = await import("./supabase-public.server");
        const { data: partners } = await promoClient()
          .from("partners")
          .select("name,discount_code,discount_percent,is_active")
          .eq("discount_code", data.promo_code.toUpperCase())
          .eq("is_active", true)
          .limit(1);
        const partner = (partners ?? [])[0];
        if (partner) {
          const percent = Math.min(90, Math.max(0, Number(partner.discount_percent ?? 10)));
          discount = Math.round(subtotal * (percent / 100));
          promoCode = String(partner.discount_code).toUpperCase();
          promoLabel = `Club ${partner.name} (-${percent} %)`;
        }
      }

      const shipping = shippingFor(subtotal, data.city);
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
        total: Math.max(0, subtotal - discount) + shipping,
        promoCode,
        promoLabel,
        discount,
        items: lines.map((line) => ({
          productSlug: line.product.slug,
          productTitle: line.product.title,
          variant: line.flavor ?? null,
          quantity: line.qty,
          unitPrice: line.price,
        })),
      });

      // Miroir best-effort vers Supabase : l'admin boutique lit les commandes
      // depuis Supabase. En cas d'indisponibilité, le store local reste la vérité.
      try {
        await publicServerClient().from("orders").insert({
          id: order.id,
          order_number: order.orderNumber,
          customer_name: data.customer_name,
          customer_phone: phone,
          customer_email: data.customer_email || null,
          shipping_address: {
            address: data.address,
            city: data.city,
            notes: data.notes || null,
          },
          notes: data.notes || null,
          subtotal,
          shipping_cost: shipping,
          discount,
          promo_code: promoCode,
          total: order.total,
          status: "pending",
          payment_method: "cod",
          created_at: order.createdAt,
          updated_at: order.updatedAt,
        });
        await publicServerClient().from("order_items").insert(
          lines.map((line) => ({
            order_id: order.id,
            product_id: line.product.id,
            product_title: line.product.title,
            variant_name: line.flavor ?? null,
            quantity: line.qty,
            price_at_purchase: line.price,
          })),
        );
      } catch (mirrorError) {
        console.warn("[orders] miroir Supabase indisponible", mirrorError);
      }

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
        total: order.total,
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
        order_number: z.string().trim().max(40).optional(),
        phone: z.string().trim().max(30).optional(),
      })
      .refine((d) => (d.order_number ?? "").length >= 3 || (d.phone ?? "").length >= 6, {
        message: "Renseignez le numéro de commande ou votre téléphone.",
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { takeToken } = await import("./rate-limit");
    const { clientKey } = await import("./rate-limit.server");
    const limited = takeToken(`track:${clientKey()}`, 20, 10 * 60_000);
    if (!limited.ok) throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
    const { orderStore } = await import("./order-store.server");
    const store = orderStore();

    // Numéro + téléphone : correspondance exacte.
    if ((data.order_number ?? "").length >= 3 && (data.phone ?? "").length >= 6) {
      const order = store.tracking(data.order_number!, data.phone!);
      return { orders: order ? [order] : [] };
    }
    // Téléphone seul : toutes les commandes récentes de ce numéro.
    if ((data.phone ?? "").length >= 6) {
      return { orders: store.listByPhone(data.phone!) };
    }
    // Numéro seul : refusé (le téléphone est requis pour éviter les regardages).
    return { orders: [] };
  });
