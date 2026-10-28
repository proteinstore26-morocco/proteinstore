import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canRevokeStaff,
  orderStatusSchema,
  productEditSchema,
  partnerEditSchema,
} from "./admin-rules";

type AdminContext = { supabase: SupabaseClient<Database>; userId: string; claims?: unknown };

async function authorize(context: AdminContext, staff = false) {
  const { requireStoreAdmin } = await import("./admin-guard.server");
  const account = await requireStoreAdmin(
    context.supabase,
    context.userId,
    staff ? "root" : "admin",
    context.claims,
  );
  return { userId: account.userId, isSuperAdmin: account.role === "root" };
}

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await authorize(context);
    const [orders, products, partners, categories] = await Promise.all([
      context.supabase
        .from("orders")
        .select("*,order_items(*)")
        .order("created_at", { ascending: false })
        .limit(1000),
      context.supabase.from("products").select("*").order("title").limit(1000),
      context.supabase.from("partners").select("*").order("display_order").limit(1000),
      context.supabase.from("categories").select("*").order("display_order"),
    ]);
    if (orders.error || products.error || partners.error || categories.error)
      throw new Error("Impossible de charger les données du magasin.");
    return {
      ...access,
      orders: orders.data ?? [],
      products: products.data ?? [],
      partners: partners.data ?? [],
      categories: categories.data ?? [],
    };
  });

export const saveOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: orderStatusSchema,
        admin_notes: z.string().trim().max(3000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await authorize(context);
    const { id, ...values } = data;
    const result = await context.supabase
      .from("orders")
      .update(values)
      .eq("id", id)
      .select("id")
      .single();
    if (result.error) throw new Error("Impossible d’enregistrer la commande.");
    return { ok: true };
  });

export const saveProductAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productEditSchema.parse(d))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const { id, ...values } = data;
    const result = await context.supabase
      .from("products")
      .update(values)
      .eq("id", id)
      .select("id")
      .single();
    if (result.error) throw new Error("Impossible d’enregistrer le produit.");
    return { ok: true };
  });

export const savePartnerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => partnerEditSchema.parse(d))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const { id, discount_percent, ...rest } = data;
    const values = {
      ...rest,
      ...(discount_percent === undefined ? {} : { discount_percent }),
    };
    const result = id
      ? await context.supabase.from("partners").update(values).eq("id", id).select("id").single()
      : await context.supabase.from("partners").insert(values).select("id").single();
    if (result.error) throw new Error("Impossible d’enregistrer le partenaire.");
    return { ok: true };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("role", ["admin", "super_admin"]);
    if (error) throw new Error("Impossible de charger les accès.");
    const map = new Map<string, { id: string; email: string; roles: string[] }>();
    for (const r of roles ?? []) {
      let entry = map.get(r.user_id);
      if (!entry) {
        const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(
          r.user_id,
        );
        if (userError) throw new Error("Impossible de charger un compte.");
        entry = { id: r.user_id, email: user.user?.email ?? "Compte sans e-mail", roles: [] };
        map.set(r.user_id, entry);
      }
      entry.roles.push(r.role);
    }
    return [...map.values()];
  });

export const setStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().min(3).max(255),
        password: z.string().min(8).max(72).optional(),
        action: z.enum(["grant", "revoke"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await authorize(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = z
      .string()
      .email()
      .parse(
        data.email.includes("@")
          ? data.email.toLowerCase()
          : `${data.email.toLowerCase()}@proteinestore.ma`,
      );
    let user;
    for (let page = 1; ; page++) {
      const result = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (result.error) throw new Error("Impossible de rechercher le compte.");
      user = result.data.users.find((u) => u.email?.toLowerCase() === email);
      if (user || result.data.users.length < 1000) break;
    }
    if (data.action === "revoke") {
      if (!user) return { ok: false, error: "Compte introuvable." };
      const roles = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
      if (roles.error) throw new Error("Impossible de vérifier les accès.");
      if (
        !canRevokeStaff(
          context.userId,
          user.id,
          (roles.data ?? []).map((r) => r.role),
        )
      )
        return { ok: false, error: "Votre accès et les comptes Super Admin sont protégés." };
      const result = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (result.error) throw new Error("Impossible de retirer l’accès.");
      return { ok: true };
    }
    if (!user) {
      if (!data.password)
        return { ok: false, error: "Mot de passe requis pour un nouveau compte." };
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: false,
      });
      if (created.error || !created.data.user)
        return {
          ok: false,
          error: "Création impossible. Vérifiez l’identifiant et le mot de passe.",
        };
      user = created.data.user;
    }
    const result = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    if (result.error) throw new Error("Impossible d’attribuer l’accès.");
    return { ok: true };
  });
