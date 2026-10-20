// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrderStore } from "@/lib/order-store.server";

let store: OrderStore;

beforeEach(() => {
  store = new OrderStore(":memory:");
});

afterEach(() => store.close());

describe("local accounts & invitations", () => {
  it("creates an account once and keeps the seed role", () => {
    const created = store.ensureAccount({
      userId: "u1",
      email: "Manager@Example.ma",
      seedRole: "manager",
    });
    expect(created.role).toBe("manager");
    expect(created.email).toBe("Manager@Example.ma");
    expect(
      store.ensureAccount({ userId: "u1", email: "manager@example.ma", seedRole: "customer" }).role,
    ).toBe("manager");
    expect(store.listAccounts()).toHaveLength(1);
  });

  it("applies a pending invitation at first login", () => {
    const invitation = store.createInvitation({
      email: "new@example.ma",
      role: "admin",
      invitedBy: "root-1",
    });
    const account = store.ensureAccount({
      userId: "u2",
      email: "new@example.ma",
      seedRole: "customer",
    });
    expect(account.role).toBe("admin");
    const accepted = store.listInvitations().find((entry) => entry.id === invitation.id);
    expect(accepted?.status).toBe("accepted");
    expect(store.listAccountEvents().some((event) => event.action === "invitation.accepted")).toBe(
      true,
    );
  });

  it("refuses duplicate pending invitations and existing accounts", () => {
    store.createInvitation({ email: "new@example.ma", role: "manager", invitedBy: "root-1" });
    expect(() =>
      store.createInvitation({ email: "NEW@example.ma", role: "admin", invitedBy: "root-1" }),
    ).toThrow("déjà en attente");
    store.ensureAccount({ userId: "u3", email: "existing@example.ma", seedRole: "customer" });
    expect(() =>
      store.createInvitation({ email: "existing@example.ma", role: "admin", invitedBy: "root-1" }),
    ).toThrow("compte existe déjà");
  });

  it("changes roles and status with an audit trail", () => {
    store.ensureAccount({ userId: "u4", email: "user@example.ma", seedRole: "customer" });
    store.setAccountRole("u4", "admin", "root-1");
    store.setAccountStatus("u4", "suspended", "root-1");
    expect(store.getAccount("u4")).toMatchObject({ role: "admin", status: "suspended" });
    const actions = store.listAccountEvents().map((event) => event.action);
    expect(actions).toContain("account.role");
    expect(actions).toContain("account.status");
  });

  it("counts roles and pending invitations for the dashboard", () => {
    store.ensureAccount({ userId: "r", email: "root@example.ma", seedRole: "root" });
    store.ensureAccount({ userId: "c", email: "client@example.ma", seedRole: "customer" });
    store.createInvitation({ email: "pending@example.ma", role: "manager", invitedBy: "r" });
    const dashboard = store.usersDashboard();
    expect(dashboard.counts.root).toBe(1);
    expect(dashboard.counts.customer).toBe(1);
    expect(dashboard.pendingInvitations).toBe(1);
    expect(store.activeRootCount()).toBe(1);
  });

  it("revokes a pending invitation", () => {
    const invitation = store.createInvitation({
      email: "revoke@example.ma",
      role: "admin",
      invitedBy: "root-1",
    });
    store.revokeInvitation(invitation.id, "root-1");
    expect(store.listInvitations()[0]?.status).toBe("revoked");
    expect(() => store.revokeInvitation(invitation.id, "root-1")).toThrow("plus en attente");
  });
});
