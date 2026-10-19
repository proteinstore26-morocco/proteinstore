# Phase 4 — Security Review (Security Expert)

## 1. Assets and data classification

| Asset | Classification | Where |
|---|---|---|
| Product/catalogue data | Public | Managed Supabase-compatible Postgres |
| Customer name, phone, address | **Personal data (GDPR)** | WhatsApp chat (store phone), not stored by the app |
| Order composition | Business data | Encoded in the WhatsApp message |
| `user_roles` | Security-critical | Postgres, RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Optional secret** | server environment only; not required by checkout |
| Supabase JWT | Session secret | browser localStorage (Supabase SDK) |

## 2. STRIDE threat model

| Threat | Vector | Control | Residual |
|---|---|---|---|
| **S**poofing | Forged JWT on admin server functions | `requireSupabaseAuth` verifies signature/claims; role re-read from `user_roles` per call | Low |
| **S**poofing | Someone poses as the shop on WhatsApp | Customers use the published number; the shop replies from its verified Business account | Medium (business process) |
| **T**ampering | Customer edits the prefilled WhatsApp message (price, quantity, total) | Shop re-checks prices/stock in the chat before dispatch; delivery is COD | Medium — accepted |
| **T**ampering | Client sends fake catalogue data to admin | Admin writes are zod-validated and RLS-gated | Low |
| **R**epudiation | No record of who changed an admin record | No audit log | **Medium — open** |
| **I**nformation disclosure | anon reads orders | RLS denies; admin reads gated by role | Low |
| **I**nformation disclosure | Service key leaks into client bundle | Loaded only in server modules via `process.env`; optional and unused by the storefront | Low (verified) |
| **I**nformation disclosure | Customer address exposed in a shared WhatsApp chat | Shop device/session hygiene; WhatsApp e2e encryption | Medium — accepted |
| **D**enial of service | Checkout abuse | Client-side redirect only; no server endpoint, no DB write | None on our infrastructure |
| **D**enial of service | Admin/catalogue API abuse | Managed backend rate limits + RLS | Low |
| **E**levation of privilege | Customer grants themselves `admin` | `setStaff` requires `super_admin`; `canRevokeStaff` protects self and super admins; RLS blocks role writes | Low |
| **E**levation of privilege | Admin escalates to super admin | No API grants `super_admin` | Low |

## 3. Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-01 | High (was) | COD order creation needed a service-role key. | **CLOSED** — checkout is now a WhatsApp handoff; no server order write. |
| SEC-02 | Medium | CSP uses `script-src 'unsafe-inline'` because TanStack Start hydration injects inline scripts; no nonce support wired. | Mitigated (documented) |
| SEC-03 | Medium | No audit log of admin/order mutations. | **OPEN** — next step |
| SEC-04 | Medium | The customer can edit the prefilled WhatsApp message before sending (price, quantity). | Accepted — shop verifies before dispatch |
| SEC-05 | Medium | No database record of WhatsApp orders → no analytics, no order queue, no reconciliation. | Accepted (owner decision); archive process recommended |
| SEC-06 | Low | `.env` was committed upstream (publishable key only). Now git-ignored and untracked. | Mitigated; rotate if desired |
| SEC-07 | Low | No MFA on admin accounts. | **OPEN** — enable Supabase TOTP |
| SEC-08 | Low | Dependency scanning not enforced in CI (`npm audit` non-blocking). | **OPEN** |
| SEC-09 | Low | No privacy notice; WhatsApp/Meta processes customer address and phone. | **OPEN** — legal content needed |
| SEC-10 | Info | `orders` has no INSERT policy for anon/authenticated. This is intentional and must stay. | Accepted |
| SEC-11 | Fixed | Security headers (HSTS, nosniff, frame denial, referrer, permissions) live via Caddy. | ✅ verified |
| SEC-12 | Fixed | Third-party editor telemetry, preview-auth broker and branding removed; no external error reporting remains. | ✅ |
| SEC-13 | Info | In-memory rate limiter and server order writer removed with the COD path; no public write endpoint remains. | ✅ reduced surface |

## 4. OWASP Top 10 (2021) mapping

| Category | Assessment |
|---|---|
| A01 Broken access control | Strong: RLS + per-call role checks; admin routes client-guarded for UX, server-enforced for truth. |
| A02 Cryptographic failures | TLS via Caddy, HSTS; crypto delegated to the managed auth provider. |
| A03 Injection | No raw SQL in app code; PostgREST parameterises; zod validates admin input. |
| A04 Insecure design | WhatsApp ordering removes the unauthenticated write; message integrity relies on manual confirmation. |
| A05 Security misconfiguration | Headers fixed; `Server` removed; no debug in prod. |
| A06 Vulnerable components | 500+ transitive packages; CI audit recommended (`SEC-08`). |
| A07 Auth failures | Managed password auth, no MFA yet (`SEC-07`), generic login errors. |
| A08 Integrity failures | Build from `package-lock.json`. |
| A09 Logging failures | Server logs to journald; no audit trail (`SEC-03`). |
| A10 SSRF | No user-controlled URL fetching. |

## 5. GDPR / privacy

- **Lawful basis:** contract (order fulfilment). Data minimisation is **better than before**: the app
  no longer stores names, phones or addresses; they go straight to the shop's WhatsApp.
- **Third party:** WhatsApp/Meta processes the message content and phone numbers. A privacy notice
  must name it as a processor (`SEC-09`).
- **No cookies/trackers** are set by the app; Supabase auth stores a session token in localStorage.
- **Retention:** the WhatsApp chat is now the order record; define a retention/export policy.

## 6. Pre-release security checklist

| Check | Result |
|---|---|
| No secret in `src/` or client bundle | ✅ |
| `.env` ignored, `.env.example` provided | ✅ |
| All admin writes validated by zod | ✅ |
| All admin reads/writes role-checked server-side | ✅ |
| RLS enabled on every table | ✅ |
| No public database writes | ✅ |
| Security headers | ✅ verified live |
| TLS + HSTS | ✅ verified live |
| Third-party telemetry | ✅ none |
| Dependency audit | ❌ not enforced |
| Audit log | ❌ |
| MFA for admins | ❌ |
| Privacy policy | ❌ |

## 7. Release decision

**CONDITIONAL GO.** No critical or high finding remains open. The storefront, WhatsApp checkout,
tracking handoff and admin reads are releasable. Conditions: accessibility/coverage gates in
`06-qa.md` are still uncertified, and `SEC-03`, `SEC-07`, `SEC-09` are post-launch hardening.
