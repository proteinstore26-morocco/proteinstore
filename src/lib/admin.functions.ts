import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuper(supabase: { rpc: (...a: never[]) => unknown }, userId: string) {
  const { data } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: boolean | null }>)("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Accès réservé au Super Admin.");
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role").in("role", ["admin", "super_admin"]);
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const map = new Map<string, { id: string; email: string; roles: string[] }>();
    for (const r of roles ?? []) {
      const u = users.users.find((x) => x.id === r.user_id);
      const e = map.get(r.user_id) ?? { id: r.user_id, email: u?.email ?? "?", roles: [] };
      e.roles.push(r.role);
      map.set(r.user_id, e);
    }
    return [...map.values()];
  });

export const setStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().min(3).max(255), password: z.string().min(8).max(72).optional(), action: z.enum(["grant", "revoke"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.includes("@") ? data.email.toLowerCase() : `${data.email.toLowerCase()}@proteinestore.ma`;
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    let user = users.users.find((u) => u.email?.toLowerCase() === email);
    if (data.action === "revoke") {
      if (!user) return { ok: false, error: "Compte introuvable." };
      if (user.id === context.userId) return { ok: false, error: "Vous ne pouvez pas retirer votre propre accès." };
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id).eq("role", "admin");
      return { ok: true };
    }
    if (!user) {
      if (!data.password) return { ok: false, error: "Mot de passe requis pour un nouveau compte." };
      const c = await supabaseAdmin.auth.admin.createUser({ email, password: data.password, email_confirm: true });
      if (c.error || !c.data.user) return { ok: false, error: c.error?.message ?? "Création impossible." };
      user = c.data.user;
    }
    await supabaseAdmin.from("user_roles").upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    return { ok: true };
  });
