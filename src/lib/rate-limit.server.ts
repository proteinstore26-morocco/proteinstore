import { getRequest } from "@tanstack/react-start/server";

/** Best-effort client identity behind Caddy. */
export function clientKey(): string {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request?.headers.get("x-real-ip") || "unknown";
}
