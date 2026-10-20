import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AccountRole } from "./account-types";
import { requireAccount } from "./account.server";

/**
 * Local role gate for administration APIs.
 * `minimum` is inclusive: manager < admin < root.
 */
export async function requireStoreAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
  minimum: AccountRole = "admin",
  claims?: unknown,
) {
  return requireAccount({ supabase, userId, claims }, minimum);
}
