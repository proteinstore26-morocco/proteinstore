import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { canManageStaff, canManageStore } from "./admin-rules";

/** Throws unless the authenticated user has the `admin` or `super_admin` role. */
export async function requireStoreAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Impossible de vérifier les droits d’accès.");
  const roles = (data ?? []).map((row) => String(row.role));
  if (!canManageStore(roles)) throw new Error("Accès réservé aux administrateurs.");
  return { userId, roles, isSuperAdmin: canManageStaff(roles) };
}
