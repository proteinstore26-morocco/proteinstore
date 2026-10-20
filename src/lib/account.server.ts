import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Account, AccountRole } from "./account-types";
import { roleAtLeast } from "./account-types";

export type AuthLike = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims?: unknown;
};

type Claims = { email?: unknown; user_metadata?: { full_name?: unknown } };

function claimEmail(claims: unknown): string | undefined {
  const email = (claims as Claims | undefined)?.email;
  return typeof email === "string" && email.includes("@") ? email : undefined;
}

function claimName(claims: unknown): string | undefined {
  const name = (claims as Claims | undefined)?.user_metadata?.full_name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

/**
 * Return the local account for this Supabase user, creating it on first login.
 * The initial role is derived from the legacy Supabase `user_roles` (super_admin → root,
 * admin → admin) or from a pending invitation, then the local store is authoritative.
 */
export async function ensureLocalAccount(context: AuthLike): Promise<Account> {
  const { orderStore } = await import("./order-store.server");
  const store = orderStore();
  const existing = store.getAccount(context.userId);
  const email = claimEmail(context.claims);
  const fullName = claimName(context.claims);

  if (existing) {
    if (fullName && !existing.fullName) {
      store.ensureAccount({
        userId: context.userId,
        email: existing.email,
        fullName,
        seedRole: existing.role,
      });
    }
    store.touchAccount(context.userId);
    return store.getAccount(context.userId) ?? existing;
  }

  let roles: string[] = [];
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error("Impossible de vérifier les droits d’accès. Réessayez.");
  roles = (data ?? []).map((row) => String(row.role));
  const seedRole: AccountRole = roles.includes("super_admin")
    ? "root"
    : roles.includes("admin")
      ? "admin"
      : "customer";

  return store.ensureAccount({
    userId: context.userId,
    email: email ?? "",
    fullName: fullName ?? null,
    seedRole,
  });
}

export async function requireAccount(
  context: AuthLike,
  minimum: AccountRole = "customer",
): Promise<Account> {
  const account = await ensureLocalAccount(context);
  if (account.status !== "active") throw new Error("Compte suspendu. Contactez un administrateur.");
  if (!roleAtLeast(account.role, minimum)) throw new Error("Accès insuffisant pour cette action.");
  return account;
}
