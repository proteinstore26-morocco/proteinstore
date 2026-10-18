import { describe, expect, it } from "vitest";
import { canManageStore, canManageStaff, canRevokeStaff } from "@/lib/admin-rules";

describe("Store administration permissions", () => {
  it("allows admins and super admins but not customers to manage the store", () => {
    expect(canManageStore(["admin"])).toBe(true);
    expect(canManageStore(["super_admin"])).toBe(true);
    expect(canManageStore(["customer"])).toBe(false);
  });
  it("reserves staff access management for super admins", () => {
    expect(canManageStaff(["super_admin"])).toBe(true);
    expect(canManageStaff(["admin"])).toBe(false);
    expect(canManageStaff(["customer"])).toBe(false);
  });
  it("prevents removing your own access", () => {
    expect(canRevokeStaff("actor", "actor", ["admin"])).toBe(false);
    expect(canRevokeStaff("actor", "other", ["admin"])).toBe(true);
  });
  it("prevents revoking super admin access through admin management", () => {
    expect(canRevokeStaff("actor", "other", ["super_admin", "admin"])).toBe(false);
  });
});