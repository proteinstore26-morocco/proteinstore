import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits, takeToken } from "@/lib/rate-limit";

const MINUTE = 60_000;
const t0 = new Date("2026-10-19T12:00:00Z").getTime();

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit then blocks", () => {
    expect(takeToken("ip", 2, MINUTE, t0).ok).toBe(true);
    expect(takeToken("ip", 2, MINUTE, t0).ok).toBe(true);
    expect(takeToken("ip", 2, MINUTE, t0).ok).toBe(false);
  });

  it("resets when the window elapses", () => {
    expect(takeToken("ip", 1, MINUTE, t0).ok).toBe(true);
    expect(takeToken("ip", 1, MINUTE, t0 + MINUTE).ok).toBe(true);
  });

  it("isolates keys", () => {
    expect(takeToken("a", 1, MINUTE, t0).ok).toBe(true);
    expect(takeToken("a", 1, MINUTE, t0).ok).toBe(false);
    expect(takeToken("b", 1, MINUTE, t0).ok).toBe(true);
  });
});
