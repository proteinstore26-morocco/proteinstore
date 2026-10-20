import { describe, expect, it } from "vitest";
import {
  detectImageExtension,
  isAllowedProductImageUrl,
  MAX_PRODUCT_IMAGES,
} from "@/lib/image-upload";
import { productEditSchema } from "@/lib/admin-rules";

const base = {
  id: "5336e9b8-a711-4f1c-8eb1-8c41b61c4029",
  title: "Test Whey",
  brand: "Test",
  description: "Description",
  category_id: null,
  price: 100,
  sale_price: null,
  stock_quantity: 1,
  low_stock_threshold: 5,
  status: "draft" as const,
  is_featured: false,
  flavors: [],
};

describe("image upload helpers", () => {
  it("detects JPEG, PNG and WebP magic bytes", () => {
    expect(
      detectImageExtension(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
    ).toBe("jpg");
    expect(
      detectImageExtension(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
      ),
    ).toBe("png");
    expect(
      detectImageExtension(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("webp");
    expect(detectImageExtension(new TextEncoder().encode("not an image"))).toBeNull();
  });

  it("accepts HTTPS and uploaded paths only", () => {
    expect(isAllowedProductImageUrl("https://cdn.example.com/whey.jpg")).toBe(true);
    expect(isAllowedProductImageUrl("/uploads/products/abc.jpg")).toBe(true);
    expect(isAllowedProductImageUrl("http://cdn.example.com/whey.jpg")).toBe(false);
    expect(isAllowedProductImageUrl("/etc/passwd")).toBe(false);
    expect(isAllowedProductImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedProductImageUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("enforces a maximum of five photos per product", () => {
    const urls = Array.from(
      { length: MAX_PRODUCT_IMAGES },
      (_, index) => `https://cdn.example.com/${index}.jpg`,
    );
    expect(productEditSchema.safeParse({ ...base, image_urls: urls }).success).toBe(true);
    expect(
      productEditSchema.safeParse({
        ...base,
        image_urls: [...urls, "https://cdn.example.com/6.jpg"],
      }).success,
    ).toBe(false);
    expect(productEditSchema.safeParse({ ...base, image_urls: [...urls, urls[0]] }).success).toBe(
      false,
    );
  });
});
