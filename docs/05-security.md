# Phase 4 — Security Review (Security Expert)

## 1. Assets and data classification

| Asset | Classification | Where |
|---|---|---|
| Product/catalogue data | Public | Lovable Cloud, PostgREST |
| Customer name, phone, email, address | **Personal data (GDPR)** | `orders`, `profiles` |
| Order history and totals | Confidential business data | `orders`, `order_items` |
| `user_roles` | Security-critical | Postgres, RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret, RLS-bypassing** | server environment only |
| Supabase JWT | Session secret | browser localStorage (Supabase SDK) |

## 2. STRIDE threat model

| Threat | Vector | Control | Residual |
|---|---|---|---|
| **S**poofing | Forged JWT on admin server functions | `requireSupabaseAuth` verifies signature/claims via `getClaims`; role re-read from `user_roles` per call | Low |
| **S**poofing | Customer claims another user's order | `trackOrder` requires order number **and** matching phone last 9 digits | Medium (enumeration, rate-limited) |
| **T**ampering | Client sends fake prices, shipping, totals | Server recomputes `unitPrice`, `shippingFor`, reads stock from DB; zod validates shape | Low |
| **T**ampering | Oversell via concurrent carts | Optimistic stock predicate + rollback (`STOCK_RACE`) | Low |
| **R**epudiation | Admin changes an order with no audit trail | `admin_notes`, `updated_at` only; no actor log | **Medium — open** |
| **I**nformation disclosure | anon reads orders | RLS returns nothing without `service_role`; admin reads gated by role | Low |
| **I**nformation disclosure | Service key leaks into client bundle | Loaded only via dynamic import inside handlers in `*.functions.ts`/`.server.ts`; never referenced by client code | Low (verify at build) |
| **I**nformation disclosure | Verbose errors reveal DB internals | Handlers log server-side, return generic French messages; h3 errors normalised to an HTML error page | Low |
| **D**enial of service | Order/tracking spam | In-memory limiter: 8 orders / 10 min / IP, 20 lookups / 10 min / IP | Medium (single-process, XFF spoofable behind a permissive proxy) |
| **D**enial of service | Memory growth of limiter | Map pruned past 20 000 keys / expired windows | Low |
| **E**levation of privilege | Customer grants themselves `admin` | `setStaff` requires `super_admin`; `canRevokeStaff` protects self and all super admins; RLS blocks role writes for authenticated | Low |
| **E**levation of privilege | Admin escalates to super admin | No API grants `super_admin`; only SQL/owner can | Low |

## 3. Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-01 | **High (operational)** | `SUPABASE_SERVICE_ROLE_KEY` absent → COD checkout returns a 200/`ok:false` "unavailable" instead of creating orders. | **OPEN — owner must provide the key** |
| SEC-02 | Medium | CSP uses `script-src 'unsafe-inline'` because TanStack Start hydration injects inline scripts; no nonce support wired. | Mitigated (documented) |
| SEC-03 | Medium | No audit log of admin/order mutations (who changed status, when). | **OPEN** — next step |
| SEC-04 | Medium | Order lookup only needs order number + phone; no CAPTCHA, limited by IP rate limit. | Mitigated |
| SEC-05 | Medium | No idempotency key on order creation; double submit can create duplicate COD orders. | **OPEN** — client disables submit, server key pending |
| SEC-06 | Low | `.env` was committed upstream (contains only the publishable key). Now git-ignored and untracked locally; the publishable key is public by design. | Mitigated; recommend rotation anyway |
| SEC-07 | Low | No MFA on admin accounts. | **OPEN** — Supabase supports TOTP; enable |
| SEC-08 | Low | Dependency scanning not in CI (`npm audit` not run on install). | **OPEN** — CI step proposed |
| SEC-09 | Low | No privacy policy / cookie notice; personal data collected for delivery. | **OPEN** — legal content needed |
| SEC-10 | Info | `orders` INSERT intentionally has no policy: only service role can create orders. This is the correct design and must not be "fixed" with a permissive policy. | Accepted |
| SEC-11 | Fixed | Missing security headers (HSTS, nosniff, frame denial, referrer, permissions). | ✅ Caddy snippet |
| SEC-12 | Fixed | Unbounded public order/tracking endpoints. | ✅ `rate-limit.server.ts` |
| SEC-13 | Fixed | Stock oversell race (read-then-write). | ✅ optimistic predicate + rollback |
| SEC-14 | Fixed | Flavour value not validated against the product. | ✅ server-side check |

## 4. OWASP Top 10 (2021) mapping

| Category | Assessment |
|---|---|
| A01 Broken access control | Strong: RLS + per-call role checks. Admin routes are client-guarded for UX, server-enforced for truth. |
| A02 Cryptographic failures | TLS via Caddy, HSTS; crypto delegated to Supabase (bcrypt/Argon2, JWT). |
| A03 Injection | No raw SQL in app code; PostgREST parameterises; zod validates input. |
| A04 Insecure design | COD is inherently trust-based; order confirmation by phone is the business control. |
| A05 Security misconfiguration | Headers fixed; `X-Powered-By`/`Server` hidden; no debug in prod. |
| A06 Vulnerable components | 300+ transitive packages; CI audit recommended (`SEC-08`). |
| A07 Auth failures | Supabase password auth, no MFA yet (`SEC-07`), generic login errors. |
| A08 Integrity failures | Build from lockfile (`package-lock.json` committed). |
| A09 Logging failures | Server logs to journald; no alerting or audit trail (`SEC-03`). |
| A10 SSRF | No user-controlled URL fetching. |

## 5. GDPR / privacy

- **Lawful basis:** contract (order fulfilment). Data minimisation is good: no birth date, no
  card data (COD).
- **Missing:** privacy notice, retention policy, deletion procedure. `profiles` and `orders` can be
  deleted by the owner in the Supabase dashboard; no self-service deletion UI.
- **Sub-processors:** Lovable Cloud (hosting), WhatsApp (manual contact), Google Fonts (IP leak to
  a third party). Recommend self-hosting the fonts or accepting the disclosure.

## 6. Pre-release security checklist

| Check | Result |
|---|---|
| No secret in `src/` or client bundle | ✅ (service key only via `process.env` in server modules) |
| `.env` ignored, `.env.example` provided | ✅ |
| All writes validated by zod | ✅ |
| All admin reads/writes role-checked server-side | ✅ |
| RLS enabled on every table | ✅ (per upstream migrations) |
| Rate limiting on unauthenticated writes | ✅ |
| Security headers | ✅ via Caddy |
| TLS + HSTS | ✅ (pending deployment verification) |
| Dependency audit | ❌ not automated |
| Audit log | ❌ |
| MFA for admins | ❌ |
| Privacy policy | ❌ |

## 7. Release decision

**CONDITIONAL — cannot sign off as production-complete yet.**

- **Blocks:** SEC-01 (COD checkout unavailable without the service-role key) and deployment
  verification of SEC-11/TLS.
- **Does not block** browsing, catalogue, product pages, SEO, tracking UI, admin reads.
- **Post-launch hardening (2 weeks):** SEC-03 audit log, SEC-05 idempotency, SEC-07 MFA,
  SEC-08 dependency audit in CI, SEC-09 privacy notice.
