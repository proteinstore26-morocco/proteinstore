import { describe, it, expect } from "vitest";
import { unitPrice, shippingFor, type Campaign } from "@/lib/pricing";

const p = { id: "p1", price: 1000, sale_price: 849, category_id: "c1" };
const now = new Date("2026-10-16T12:00:00Z");
const camp = (o: Partial<Campaign>): Campaign => ({
  id: "x", name: "x", discount_type: "percent", discount_value: 10, applies_to_type: "all", category_ids: [], product_ids: [],
  start_date: "2026-10-01T00:00:00Z", end_date: "2026-10-30T00:00:00Z", priority: 5, is_active: true, ...o,
});

describe("pricing", () => {
  it("uses sale price when no campaign", () => expect(unitPrice(p, [], now).price).toBe(849));
  it("applies percent campaign on top of sale price, rounded to whole MAD", () => expect(unitPrice(p, [camp({})], now).price).toBe(764));
  it("ignores expired campaigns", () => expect(unitPrice(p, [camp({ end_date: "2026-10-10T00:00:00Z" })], now).price).toBe(849));
  it("fixed campaign subtracts MAD", () => expect(unitPrice(p, [camp({ discount_type: "fixed", discount_value: 50 })], now).price).toBe(799));
  it("shipping is free from 500 MAD, else 30 MAD", () => {
    expect(shippingFor(499)).toBe(30);
    expect(shippingFor(500)).toBe(0);
  });
});
