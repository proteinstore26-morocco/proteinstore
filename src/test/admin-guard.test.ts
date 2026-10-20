// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { OrderStore, setOrderStoreForTests } from "@/lib/order-store.server";
import { requireStoreAdmin } from "@/lib/admin-guard.server";
import { roleAtLeast } from "@/lib/account-types";

let store: OrderStore;

beforeEach(() => {
  store = new OrderStore(":memory:");
  setOrderStoreForTests(store);
  store.ensureAccount({ userId: "root-1", email: "root@example.ma", seedRole: "root" });
  store.ensureAccount({ userId: "admin-1", email: "admin@example.ma", seedRole: "admin" });
  store.ensureAccount({ userId: "manager-1", email: "manager@example.ma", seedRole: "manager" });
  store.ensureAccount({ userId: "customer-1", email: "client@example.ma", seedRole: "customer" });
});

afterAll(() => {
  setOrderStoreForTests(undefined);
  store.close();
});

const client = {} as SupabaseClient<Database>;

describe("local admin guard", () => {
  it("orders roles root > admin > manager > customer", () => {
    expect(roleAtLeast("root", "admin")).toBe(true);
    expect(roleAtLeast("admin", "manager")).toBe(true);
    expect(roleAtLeast("manager", "admin")).toBe(false);
    expect(roleAtLeast("customer", "manager")).toBe(false);
  });

  it("allows admins and roots for store administration", async () => {
    await expect(requireStoreAdmin(client, "admin-1", "admin")).resolves.toMatchObject({
      role: "admin",
    });
    await expect(requireStoreAdmin(client, "root-1", "root")).resolves.toMatchObject({
      role: "root",
    });
  });

  it("allows managers for operations but not administration", async () => {
    await expect(requireStoreAdmin(client, "manager-1", "manager")).resolves.toMatchObject({
      role: "manager",
    });
    await expect(requireStoreAdmin(client, "manager-1", "admin")).rejects.toThrow(
      "Accès insuffisant",
    );
  });

  it("rejects customers and suspended accounts", async () => {
    await expect(requireStoreAdmin(client, "customer-1", "manager")).rejects.toThrow(
      "Accès insuffisant",
    );
    store.setAccountStatus("admin-1", "suspended", "root-1");
    await expect(requireStoreAdmin(client, "admin-1", "admin")).rejects.toThrow("suspendu");
  });
});
