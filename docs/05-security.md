# Phase 4 — Security Review (Security Expert)

## 1. Assets and data classification

| Asset                                | Classification             | Where                                          |
| ------------------------------------ | -------------------------- | ---------------------------------------------- |
| Catalogue                            | Public                     | Managed Supabase-compatible Postgres           |
| Customer name, phone, email, address | **Personal data (GDPR)**   | `data/proteinstore.db` (local) + WhatsApp chat |
| Orders, invoices, events             | Confidential business data | `data/proteinstore.db`                         |
| `user_roles` (legacy)                | Security-critical          | Managed Postgres, RLS                          |
| Local accounts & roles               | Security-critical          | `data/proteinstore.db` (`accounts`)            |
| `SUPABASE_SERVICE_ROLE_KEY`          | Optional secret            | server env; **not used by the order path**     |
| Supabase JWT                         | Session secret             | browser localStorage                           |
| DB backups                           | **Personal data copy**     | `data/backups/`                                |

## 2. STRIDE threat model

| Threat                     | Vector                                        | Control                                                                                          | Residual                  |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| **S**poofing               | Forged JWT on admin APIs                      | `requireSupabaseAuth` verifies the token; `requireStoreAdmin` re-reads `user_roles` per call     | Low                       |
| **S**poofing               | Someone pretends to be the shop on WhatsApp   | Customers use the published number; shop replies from its Business account                       | Medium (business process) |
| **T**ampering              | Customer edits the prefilled WhatsApp message | Shop confirms price/stock in chat before dispatch; COD                                           | Medium — accepted         |
| **T**ampering              | SQL injection in the local store              | Every statement is prepared; status/invoice enums validated                                      | Low                       |
| **R**epudiation            | No record of who changed an order             | `order_events.actor` + `whatsapp_messages.sent_by` record the admin user id                      | Low–Medium                |
| **I**nformation disclosure | Anon reads admin data                         | Admin server functions reject unauthenticated calls (verified)                                   | Low                       |
| **I**nformation disclosure | DB file leak                                  | File is outside the web root, root-only, server modules only; Caddy serves only `.output/public` | Medium (host compromise)  |
| **I**nformation disclosure | Service key in client bundle                  | Loaded only via `process.env` in server modules; not part of the order path                      | Low                       |
| **I**nformation disclosure | Backup leak                                   | Backups contain PII; directory root-only, retention 14                                           | Medium — encrypt/offsite  |
| **D**enial of service      | Checkout spam                                 | 8 orders / 10 min / IP + 20 tracking lookups / 10 min / IP                                       | Low                       |
| **D**enial of service      | Local SQLite growth                           | WAL + indexes, 300-order admin cap, 14 backups                                                   | Low                       |
| **E**levation of privilege | Customer grants themselves admin              | `setStaff` requires `super_admin`; RLS blocks role writes                                        | Low                       |
| **E**levation of privilege | CSRF on admin server functions                | TanStack CSRF middleware (`Sec-Fetch-Site`/Origin); verified with a browser-style request        | Low                       |

## 3. Findings

| ID     | Severity   | Finding                                                                                                                                 | Status                                                             |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| SEC-01 | High (was) | COD creation required a service-role key.                                                                                               | **CLOSED** — local SQLite store; no Supabase write.                |
| SEC-02 | Medium     | CSP needs `script-src 'unsafe-inline'` for TanStack hydration and JSON-LD.                                                              | Mitigated (documented)                                             |
| SEC-03 | Medium     | No global admin audit trail (only per-order events).                                                                                    | **OPEN** — per-order actor is recorded; global auth log pending    |
| SEC-04 | Medium     | The customer can edit the prefilled WhatsApp message.                                                                                   | Accepted — shop verifies before dispatch                           |
| SEC-05 | Medium     | Customer PII is stored unencrypted in SQLite and its backups.                                                                           | **OPEN** — root-only perms today; recommend LUKS/encrypted backups |
| SEC-06 | Low        | `.env` was committed upstream (publishable key only).                                                                                   | Mitigated; rotate if desired                                       |
| SEC-07 | Low        | No MFA on admin accounts.                                                                                                               | **OPEN** — enable Supabase TOTP                                    |
| SEC-08 | Low        | Dependency audit is non-blocking in CI.                                                                                                 | **OPEN**                                                           |
| SEC-09 | Low        | No privacy notice; WhatsApp/Meta and local DB process PII.                                                                              | **OPEN** — legal content needed                                    |
| SEC-10 | Info       | `orders` in the managed backend has no INSERT policy. Intentional.                                                                      | Accepted                                                           |
| SEC-11 | Fixed      | Security headers (HSTS, nosniff, frame denial, referrer, permissions) live via Caddy.                                                   | ✅ verified                                                        |
| SEC-12 | Fixed      | Editor telemetry, preview-auth broker and branding removed.                                                                             | ✅                                                                 |
| SEC-13 | Fixed      | Public order/tracking endpoints rate-limited; admin endpoints authenticated.                                                            | ✅ verified                                                        |
| SEC-14 | Fixed      | Local DB never exposed by the web server; server-only imports.                                                                          | ✅                                                                 |
| SEC-15 | Info       | Order writes are ACID; counters block duplicate order/invoice numbers.                                                                  | ✅                                                                 |
| SEC-16 | Medium     | Local role demotion does not revoke a legacy Supabase `admin`/`super_admin` row; direct REST calls would keep RLS privileges.           | **OPEN** — also remove the Supabase role in the backend dashboard  |
| SEC-17 | Medium     | Local accounts/invitations store e-mail addresses in SQLite and backups.                                                                | Covered by `SEC-05` (encrypt backups)                              |
| SEC-18 | Fixed      | Root self-demotion, self-suspension and last-root removal are blocked; role changes are audited.                                        | ✅ verified on staging                                             |
| SEC-22 | Fixed      | Partner logo upload is admin-only, magic-byte/size validated, UUID-named, and `logo_url` accepts only HTTPS or `/uploads/partners/...`. | ✅ verified                                                        |

## 4. OWASP Top 10 (2021)

| Category                      | Assessment                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| A01 Broken access control     | RLS for catalogue; server-side role checks for admin; unauthenticated admin calls rejected. |
| A02 Cryptographic failures    | TLS/HSTS; managed auth; local DB unencrypted (`SEC-05`).                                    |
| A03 Injection                 | Prepared statements; zod validation on every write; enum checks for statuses.               |
| A04 Insecure design           | WhatsApp messages are advisory; the shop confirms before dispatch.                          |
| A05 Security misconfiguration | Headers set; `Server` removed; DB outside web root.                                         |
| A06 Vulnerable components     | Audit non-blocking (`SEC-08`).                                                              |
| A07 Auth failures             | Managed password auth; MFA pending (`SEC-07`).                                              |
| A08 Integrity failures        | Lockfile builds; append-only event log.                                                     |
| A09 Logging failures          | journald + per-order events; no global audit (`SEC-03`).                                    |
| A10 SSRF                      | No user-controlled URL fetching.                                                            |

## 5. GDPR / privacy

- **Data minimisation:** only what delivery needs (name, phone, optional email, city, address).
- **Storage:** now local SQLite (previously nothing). Retention: 13 months for financial records.
- **Processors:** managed backend (catalogue/auth), WhatsApp/Meta (messages), hosting provider.
- **Missing:** privacy notice, deletion procedure, encrypted backups (`SEC-05`, `SEC-09`).
- **No trackers**; Supabase session token in localStorage.

## 6. Pre-release checklist

| Check                                   | Result      |
| --------------------------------------- | ----------- |
| No secret in client bundle              | ✅          |
| `.env` ignored, `.env.example` provided | ✅          |
| Admin APIs reject unauthenticated calls | ✅ verified |
| All writes zod-validated                | ✅          |
| SQL prepared statements only            | ✅          |
| DB file outside web root                | ✅          |
| Rate limits on public endpoints         | ✅          |
| Security headers + TLS                  | ✅ verified |
| Third-party telemetry                   | ✅ none     |
| Dependency audit                        | ❌          |
| MFA / global audit log / privacy notice | ❌          |

## 7. Release decision

**CONDITIONAL GO.** No critical or high finding is open. Storefront, orders, tracking, invoices and admin
are releasable. Conditions: encrypted backups and privacy notice (`SEC-05`, `SEC-09`), MFA (`SEC-07`), and the
QA gates still open in `06-qa.md`.
