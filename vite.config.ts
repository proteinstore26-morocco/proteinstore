import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Dev-only helper so uploaded product photos are previewable locally.
function devUploads(): Plugin {
  return {
    name: "protein-store-dev-uploads",
    configureServer(server) {
      const root = resolve(process.env["UPLOAD_DIR"] ?? "data/uploads");
      server.middlewares.use("/uploads", (request, response, next) => {
        const relative = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "").replace(
          /^\/+/,
          "",
        );
        const file = resolve(root, relative);
        if (!file.startsWith(root + sep)) return next();
        try {
          if (!statSync(file).isFile()) return next();
        } catch {
          return next();
        }
        const types: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp",
        };
        response.setHeader(
          "content-type",
          types[extname(file).toLowerCase()] ?? "application/octet-stream",
        );
        response.setHeader("cache-control", "public, max-age=31536000, immutable");
        createReadStream(file).pipe(response);
      });
    },
  };
}

// Self-hosted build: plain Vite + TanStack Start, emitting a Node server
// (`.output/server/index.mjs`) that Caddy proxies on 127.0.0.1:5077.
export default defineConfig(({ command }) => ({
  server: { host: "127.0.0.1", port: 5173 },
  plugins: [
    devUploads(),
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Use src/server.ts (our SSR error wrapper) instead of the built-in entry.
      server: { entry: "server" },
    }),
    viteReact(),
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
  ],
}));
