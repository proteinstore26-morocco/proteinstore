import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Self-hosted build: plain Vite + TanStack Start, emitting a Node server
// (`.output/server/index.mjs`) that Caddy proxies on 127.0.0.1:5077.
export default defineConfig(({ command }) => ({
  server: { host: "127.0.0.1", port: 5173 },
  plugins: [
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
