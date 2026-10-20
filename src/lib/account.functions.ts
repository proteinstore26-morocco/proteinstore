import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccountRole } from "./account-types";

type AuthContext = { supabase: SupabaseClient<Database>; userId: string; claims?: unknown };

const roleSchema = z.enum(["customer", "manager", "admin", "root"]);

async function requireRoot(context: AuthContext) {
  const { requireStoreAdmin } = await import("./admin-guard.server");
  return requireStoreAdmin(context.supabase, context.userId, "root", context.claims);
}

/** Called after login: creates the local account on first visit and returns it. */
export const syncMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureLocalAccount } = await import("./account.server");
    const account = await ensureLocalAccount({
      supabase: context.supabase,
      userId: context.userId,
      claims: context.claims,
    });
    return { account, suspended: account.status !== "active" };
  });

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureLocalAccount } = await import("./account.server");
    return ensureLocalAccount({
      supabase: context.supabase,
      userId: context.userId,
      claims: context.claims,
    });
  });

export const getUsersDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRoot(context);
    const { orderStore } = await import("./order-store.server");
    return orderStore().usersDashboard();
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        fullName: z.string().trim().max(120).optional(),
        role: roleSchema,
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const actor = await requireRoot(context);
    const { orderStore } = await import("./order-store.server");
    const invitation = orderStore().createInvitation({
      email: data.email,
      fullName: data.fullName ?? null,
      role: data.role as AccountRole,
      invitedBy: actor.userId,
    });
    return { invitation };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const actor = await requireRoot(context);
    const { orderStore } = await import("./order-store.server");
    const store = orderStore();
    const target = store.getAccount(data.userId);
    if (!target) throw new Error("Compte introuvable.");
    if (target.userId === actor.userId && data.role !== "root") {
      throw new Error("Vous ne pouvez pas retirer votre propre rôle root.");
    }
    if (
      target.role === "root" &&
      data.role !== "root" &&
      target.status === "active" &&
      store.activeRootCount() <= 1
    ) {
      throw new Error("Impossible de retirer le dernier compte root actif.");
    }
    return { account: store.setAccountRole(data.userId, data.role as AccountRole, actor.userId) };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const actor = await requireRoot(context);
    const { orderStore } = await import("./order-store.server");
    const store = orderStore();
    const target = store.getAccount(data.userId);
    if (!target) throw new Error("Compte introuvable.");
    if (target.userId === actor.userId && data.status === "suspended") {
      throw new Error("Vous ne pouvez pas suspendre votre propre compte.");
    }
    if (target.role === "root" && data.status === "suspended" && store.activeRootCount() <= 1) {
      throw new Error("Impossible de suspendre le dernier compte root actif.");
    }
    return { account: store.setAccountStatus(data.userId, data.status, actor.userId) };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const actor = await requireRoot(context);
    const { orderStore } = await import("./order-store.server");
    orderStore().revokeInvitation(data.id, actor.userId);
    return { ok: true as const };
  });
