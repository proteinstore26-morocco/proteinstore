import { describe, expect, it } from "vitest";
import { normalizeMoroccanPhone, samePhone, waNumber } from "@/lib/phone";

describe("Moroccan phone helpers", () => {
  it("normalizes local, international and spaced numbers", () => {
    expect(normalizeMoroccanPhone("0612345678")).toBe("0612345678");
    expect(normalizeMoroccanPhone("+212 612 34 56 78")).toBe("0612345678");
    expect(normalizeMoroccanPhone("00212612345678")).toBe("0612345678");
    expect(normalizeMoroccanPhone("612345678")).toBe("0612345678");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeMoroccanPhone("0212345678")).toBeNull();
    expect(normalizeMoroccanPhone("06123")).toBeNull();
  });

  it("returns WhatsApp international digits", () => {
    expect(waNumber("0612345678")).toBe("212612345678");
  });

  it("matches by the last nine digits", () => {
    expect(samePhone("0612345678", "+212612345678")).toBe(true);
    expect(samePhone("0612345678", "0712345678")).toBe(false);
  });
});
