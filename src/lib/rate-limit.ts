// Pure fixed-window limiter for public server functions (single Node process).
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 20_000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

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
    for (const [storedKey, stored] of buckets) if (stored.resetAt <= now) buckets.delete(storedKey);
  }
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

export function resetRateLimits(): void {
  buckets.clear();
}
