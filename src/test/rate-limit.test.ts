import { describe, it, expect, beforeEach } from "vitest";
import { takeToken, resetRateLimits } from "@/lib/rate-limit";

const MINUTE = 60_000;
const t0 = new Date("2026-10-19T12:00:00Z").getTime();

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit and rejects the next one", () => {
    expect(takeToken("ip", 2, MINUTE, t0).ok).toBe(true);
    expect(takeToken("ip", 2, MINUTE, t0).ok).toBe(true);
    const third = takeToken("ip", 2, MINUTE, t0);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate buckets per key", () => {
    expect(takeToken("a", 1, MINUTE, t0).ok).toBe(true);
    expect(takeToken("a", 1, MINUTE, t0).ok).toBe(false);
    expect(takeToken("b", 1, MINUTE, t0).ok).toBe(true);
  });

  it("resets once the window has elapsed", () => {
    expect(takeToken("ip", 1, MINUTE, t0).ok).toBe(true);
    expect(takeToken("ip", 1, MINUTE, t0 + MINUTE - 1).ok).toBe(false);
    expect(takeToken("ip", 1, MINUTE, t0 + MINUTE).ok).toBe(true);
  });

  it("reports a wait in seconds, not milliseconds", () => {
    takeToken("ip", 1, 30_000, t0);
    const blocked = takeToken("ip", 1, 30_000, t0);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBe(30);
  });
});
