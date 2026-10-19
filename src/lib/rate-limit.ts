// Pure fixed-window limiter. Kept free of server-only imports so it is unit-testable.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 20_000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Count one hit for `key` and report whether it is still inside the allowance.
 * Expired buckets are pruned opportunistically so the map cannot grow unbounded.
 */
export function takeToken(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [storedKey, stored] of buckets) {
      if (stored.resetAt <= now) buckets.delete(storedKey);
    }
  }

  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** Test hook: clear all buckets between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
