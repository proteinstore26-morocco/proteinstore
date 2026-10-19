// Server-only helpers on top of the pure limiter.
import { getRequest } from "@tanstack/react-start/server";

/** Best-effort client identity. Caddy sets X-Forwarded-For; never trust it blindly. */
export function clientKey(): string {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request?.headers.get("x-real-ip") || "unknown";
}
