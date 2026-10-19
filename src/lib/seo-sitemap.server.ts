import { existsSync } from "node:fs";
import { join } from "node:path";

/** True when the sitemap was generated for dev or for the production build. */
export function sitemapExists(): boolean {
  return (
    existsSync(join(process.cwd(), "public", "sitemap.xml")) ||
    existsSync(join(process.cwd(), ".output", "public", "sitemap.xml"))
  );
}
