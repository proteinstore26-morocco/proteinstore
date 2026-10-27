import { describe, expect, it } from "vitest";
import { proxiedImage } from "@/lib/image-proxy";

describe("proxiedImage", () => {
  it("routes external http(s) photos through the same-origin proxy", () => {
    const out = proxiedImage("https://maghrebnutrition.ma/wp-content/uploads/vitamin-d-3.webp");
    expect(out).toBe(
      "/api/public/img?url=" +
        encodeURIComponent("https://maghrebnutrition.ma/wp-content/uploads/vitamin-d-3.webp"),
    );
  });

  it("leaves locally served uploads and relative paths untouched", () => {
    expect(proxiedImage("/uploads/vitamin-d-3.webp")).toBe("/uploads/vitamin-d-3.webp");
    expect(proxiedImage("")).toBe("");
  });

  it("round-trips the encoded URL so the proxy receives the original", () => {
    const original = "https://maghrebnutrition.ma/a?b=1&c=2";
    const proxied = proxiedImage(original);
    expect(new URL("http://x" + proxied).searchParams.get("url")).toBe(original);
  });
});
