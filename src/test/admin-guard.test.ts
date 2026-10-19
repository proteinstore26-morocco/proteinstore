import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireStoreAdmin } from "@/lib/admin-guard.server";

function clientWithRoles(roles: string[]): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: roles.map((role) => ({ role })), error: null }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("admin guard", () => {
  it("accepts admins and super admins", async () => {
    await expect(requireStoreAdmin(clientWithRoles(["admin"]), "u1")).resolves.toMatchObject({
      isSuperAdmin: false,
    });
    await expect(
      requireStoreAdmin(clientWithRoles(["super_admin", "admin"]), "u2"),
    ).resolves.toMatchObject({
      isSuperAdmin: true,
    });
  });

  it("rejects customers", async () => {
    await expect(requireStoreAdmin(clientWithRoles(["customer"]), "u3")).rejects.toThrow(
      "administrateurs",
    );
  });
});
