// Mode statique (Cloudflare Pages) : build SPA sans backend.
// VITE_STATIC_MODE=1 à la génération.
export const STATIC_MODE = import.meta.env["VITE_STATIC_MODE"] === "1";
