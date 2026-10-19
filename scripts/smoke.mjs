#!/usr/bin/env node
// Read-only production smoke test. Safe to run against the live store: it never
// writes to the database, never authenticates, and never places an order.
// Usage: node scripts/smoke.mjs https://proteinstore.example.com
const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "http://127.0.0.1:5077").replace(/\/+$/, "");

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok, detail });

async function get(path) {
  const started = Date.now();
  const res = await fetch(base + path, { headers: { "accept-encoding": "identity" }, redirect: "manual" });
  const body = await res.text();
  return { status: res.status, body, ms: Date.now() - started, headers: res.headers };
}

const home = await get("/");
add("home 200", home.status === 200, `status=${home.status} ${home.ms}ms`);
add("home renders brand", home.body.includes("PROTEIN STORE"));
add("home renders live catalogue", /MAD/.test(home.body));
add("home SSR under 3s", home.ms < 3000, `${home.ms}ms`);

const shop = await get("/shop");
add("shop 200", shop.status === 200, `status=${shop.status}`);
add("shop lists products", shop.body.includes("Boutique") && shop.body.includes("produit(s)"));
add("shop SSR under 3s", shop.ms < 3000, `${shop.ms}ms`);

const checkout = await get("/checkout");
add("checkout 200", checkout.status === 200, `status=${checkout.status}`);
add("checkout offers COD", checkout.body.includes("Paiement à la livraison"));

const track = await get("/track-order");
add("track-order 200", track.status === 200, `status=${track.status}`);

const missing = await get("/this-route-does-not-exist");
add("unknown route 404", missing.status === 404, `status=${missing.status}`);

if (base.startsWith("https://")) {
  add("HSTS header", /max-age=\d+/.test(home.headers.get("strict-transport-security") ?? ""), home.headers.get("strict-transport-security") ?? "missing");
  add("nosniff header", home.headers.get("x-content-type-options") === "nosniff");
  add("frame-ancestors / X-Frame-Options", (home.headers.get("x-frame-options") ?? "").toUpperCase().includes("DENY"));
  add("CSP header", /frame-ancestors 'none'/.test(home.headers.get("content-security-policy") ?? ""));
}

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
