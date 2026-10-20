// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeImportHost } from "@/lib/import-hosts";
import { OrderStore } from "@/lib/order-store.server";

let store: OrderStore;

beforeEach(() => {
  store = new OrderStore(":memory:");
});

afterEach(() => store.close());

describe("import host validation", () => {
  it("normalizes a public domain", () => {
    expect(normalizeImportHost(" Example.COM. ")).toBe("example.com");
    expect(normalizeImportHost("shop.example.org")).toBe("shop.example.org");
  });

  it("rejects protocols, paths, ports and credentials", () => {
    for (const value of [
      "https://example.com",
      "example.com/path",
      "example.com:443",
      "user@example.com",
    ]) {
      expect(() => normalizeImportHost(value)).toThrow();
    }
  });

  it("rejects IPs and local names", () => {
    for (const value of [
      "127.0.0.1",
      "192.168.1.10",
      "localhost",
      "shop.local",
      "intranet.internal",
      "x.test",
    ]) {
      expect(() => normalizeImportHost(value)).toThrow();
    }
  });
});

describe("import host storage", () => {
  it("adds, lists and removes custom hosts idempotently", () => {
    store.addImportHost("shop.example.org", "admin-1");
    store.addImportHost("shop.example.org", "admin-1");
    expect(store.listImportHosts()).toHaveLength(1);
    expect(store.listImportHosts()[0]).toMatchObject({
      host: "shop.example.org",
      createdBy: "admin-1",
    });
    store.removeImportHost("shop.example.org");
    expect(store.listImportHosts()).toHaveLength(0);
  });
});
