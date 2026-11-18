import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(".output/public");
const destination = resolve("dist");

if (existsSync(source)) {
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
  console.log("[build] Copied public assets to dist/ for Lovable deployment.");
} else if (existsSync(destination)) {
  console.log("[build] Vite static assets are already available in dist/.");
} else {
  throw new Error("Build produced neither .output/public nor dist/.");
}