// Storefront image URL mapping (pure, testable).
// Imported catalogue photos live on the source shop's domain, which usually
// sends `Cross-Origin-Resource-Policy: same-origin` — browsers refuse to
// display them directly. Absolute http(s) image URLs are therefore served
// through our same-origin proxy instead.
export function proxiedImage(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/public/img?url=${encodeURIComponent(url)}`;
}
