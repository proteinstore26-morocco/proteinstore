import { createFileRoute } from "@tanstack/react-router";
import { isSameOrSubdomain } from "@/lib/import-hosts";

const MAX_BYTES = 8 * 1024 * 1024;
const DENIED = new Response("Hôte non autorisé.", { status: 403 });

// Same-origin proxy for catalogue product photos. The URL must point at a host
// the admin already approved for imports (IMPORT_ALLOWED_HOSTS + custom hosts),
// which keeps this endpoint from becoming an open SSRF relay.
export const Route = createFileRoute("/api/public/img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url");
        let target: URL;
        try {
          target = new URL(raw ?? "");
        } catch {
          return new Response("URL invalide.", { status: 400 });
        }
        if (target.protocol !== "https:" && target.protocol !== "http:") {
          return new Response("Schéma non autorisé.", { status: 400 });
        }

        const { importHostEntries } = await import("@/lib/import-hosts.server");
        const allowed = await importHostEntries();
        if (!allowed.some((entry) => isSameOrSubdomain(target.hostname, entry.host))) return DENIED;

        const upstream = await fetch(target, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ProteinStoreBot/1.0; +https://proteinestore.pro)",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          },
        });
        // Redirects must not be used to escape the allowlist.
        if (!new URL(upstream.url).hostname.endsWith("." + "" , 0) && !allowed.some((entry) => isSameOrSubdomain(new URL(upstream.url).hostname, entry.host))) {
          return DENIED;
        }

        const type = upstream.headers.get("content-type") ?? "";
        if (!upstream.ok || !type.startsWith("image/")) {
          return new Response("Image indisponible.", { status: 502 });
        }
        if (Number(upstream.headers.get("content-length") ?? 0) > MAX_BYTES) {
          return new Response("Image trop volumineuse.", { status: 413 });
        }

        const body = await upstream.arrayBuffer();
        if (body.byteLength > MAX_BYTES) {
          return new Response("Image trop volumineuse.", { status: 413 });
        }
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
