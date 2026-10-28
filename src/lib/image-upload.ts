// Shared image validation rules for the product photo manager.
export const MAX_PRODUCT_IMAGES = 5;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_BASE64 = 6_000_000;

export type ImageExtension = "jpg" | "png" | "webp";

export function detectImageExtension(bytes: Uint8Array): ImageExtension | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  const riff = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  const webp = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

export const MIME_BY_EXTENSION: Record<ImageExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Accepts an external HTTPS image URL or an uploaded `/uploads/...` path. */
export function isAllowedProductImageUrl(value: string): boolean {
  const url = value.trim();
  if (url.length === 0 || url.length > 2000) return false;
  if (/^\/uploads\/products\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** Partner logos: external HTTPS or an uploaded `/uploads/partners/...` path. */
export function isAllowedPartnerLogoUrl(value: string): boolean {
  const url = value.trim();
  if (url.length === 0 || url.length > 2000) return false;
  if (/^\/uploads\/partners\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** Category images: external HTTPS or an uploaded `/uploads/categories/...` path. */
export function isAllowedCategoryImageUrl(value: string): boolean {
  const url = value.trim();
  if (url.length === 0 || url.length > 2000) return false;
  if (/^\/uploads\/categories\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
