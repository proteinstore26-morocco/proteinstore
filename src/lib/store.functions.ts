import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildInvoiceMessage, buildPaymentMessage, buildStatusMessage, waUrlTo } from "./whatsapp";
import { normalizeMoroccanPhone } from "./phone";

type AdminContext = { supabase: SupabaseClient<Database>; userId: string };

async function guard(context: AdminContext) {
  const { requireStoreAdmin } = await import("./admin-guard.server");
  return requireStoreAdmin(context.supabase, context.userId);
}

const orderStatus = z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
const uuid = z.string().uuid();

export const getAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: orderStatus.optional(),
        q: z.string().trim().max(120).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await guard(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().listOrders({ status: data.status ?? "all", q: data.q ?? "", limit: 300 });
  });

export const getAdminOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    await guard(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().getOrder(data.id);
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid, status: orderStatus }).parse(data))
  .handler(async ({ context, data }) => {
    const admin = await guard(context);
    const { orderStore } = await import("./order-store.server");
    const store = orderStore();
    const order = store.updateStatus(data.id, data.status, admin.userId);
    const message = buildStatusMessage(order, data.status);
    store.recordWhatsApp({
      phone: order.customerPhone,
      orderId: order.id,
      template: `status_${data.status}`,
      body: message,
      sentBy: admin.userId,
    });
    return {
      order,
      whatsapp: { phone: order.customerPhone, message, url: waUrlTo(order.customerPhone, message) },
    };
  });

export const addOrderNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: uuid, note: z.string().trim().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const admin = await guard(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().addNote(data.id, data.note, admin.userId);
  });

export const createOrderInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const admin = await guard(context);
    const { orderStore } = await import("./order-store.server");
    const store = orderStore();
    const invoice = store.createInvoice(data.orderId, admin.userId);
    const message = buildInvoiceMessage({
      customerName: invoice.customerName,
      invoiceNumber: invoice.number,
      orderNumber: invoice.orderNumber,
      total: invoice.total,
    });
    store.recordWhatsApp({
      phone: invoice.customerPhone,
      orderId: invoice.orderId,
      template: "invoice",
      body: message,
      sentBy: admin.userId,
    });
    return {
      invoice,
      whatsapp: {
        phone: invoice.customerPhone,
        message,
        url: waUrlTo(invoice.customerPhone, message),
      },
    };
  });

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: uuid, status: z.enum(["paid", "void"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const admin = await guard(context);
    const { orderStore } = await import("./order-store.server");
    const store = orderStore();
    const invoice = store.setInvoiceStatus(data.invoiceId, data.status, admin.userId);
    const message =
      data.status === "paid"
        ? buildPaymentMessage({
            customerName: invoice.customerName,
            orderNumber: invoice.orderNumber,
            total: invoice.total,
          })
        : `Bonjour ${invoice.customerName.split(" ")[0] || invoice.customerName},\n\nla facture ${invoice.number} a été annulée. Contactez-nous pour toute question.\n\nL'équipe PROTEIN STORE® — Kénitra`;
    store.recordWhatsApp({
      phone: invoice.customerPhone,
      orderId: invoice.orderId,
      template: data.status === "paid" ? "payment_received" : "invoice_void",
      body: message,
      sentBy: admin.userId,
    });
    return {
      invoice,
      whatsapp: {
        phone: invoice.customerPhone,
        message,
        url: waUrlTo(invoice.customerPhone, message),
      },
    };
  });

export const sendCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().trim().min(6).max(30),
        body: z.string().trim().min(1).max(2000),
        orderId: uuid.optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const admin = await guard(context);
    const phone = normalizeMoroccanPhone(data.phone);
    if (!phone) throw new Error("Numéro de téléphone invalide.");
    const { orderStore } = await import("./order-store.server");
    orderStore().recordWhatsApp({
      phone,
      orderId: data.orderId ?? null,
      template: "custom",
      body: data.body,
      sentBy: admin.userId,
    });
    return { phone, message: data.body, url: waUrlTo(phone, data.body) };
  });

export const getAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().trim().max(120).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await guard(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().listCustomers(data.q ?? "");
  });

export const getAdminCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ phoneNorm: z.string().trim().min(6).max(20) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().getCustomer(data.phoneNorm);
  });

export const getAdminInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().listInvoices();
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().stats();
  });
