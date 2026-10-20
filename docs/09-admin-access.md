# Admin access & password reset

There is **no default password** and none is stored on this server. Authentication and password hashes live in
the managed Supabase-compatible backend. The account convention is `admin@proteinestore.ma`. Since the local role system was added, the app
authorizes from `data/proteinstore.db`; legacy Supabase roles are only used to seed the first root
(`super_admin → root`).

## Reset your password (self-service)

1. Open **https://proteinstore.46.225.2.52.sslip.io/auth** (or the test instance `/auth`).
2. Click **« Mot de passe oublié ? »**.
3. Enter the account e-mail — `admin@proteinestore.ma` or a full address.
4. Open the e-mail and follow the link. It lands on **`/auth/reset`**.
5. Choose a new password (8 characters minimum, confirmed twice).
6. You are signed in; open **`/admin`**.

The response is deliberately neutral (“si un compte existe…”), so the page never reveals whether an address is
registered. The link is valid for one hour.

## Required backend configuration (one-time)

In Lovable Cloud / Supabase → **Authentication → URL configuration**:

- **Site URL**: `https://proteinstore.46.225.2.52.sslip.io` (then `https://proteinestore.pro` when DNS is live)
- **Redirect URLs** (add all that apply):
  - `https://proteinstore.46.225.2.52.sslip.io/auth/reset`
  - `https://test.proteinstore.46.225.2.52.sslip.io/auth/reset`
  - `https://proteinestore.pro/auth/reset`
  - `http://localhost:5173/auth/reset` (local dev)

Also confirm **SMTP** is configured (Authentication → Emails). Without SMTP, reset e-mails are not delivered.

If you cannot change the redirect allowlist, reset the password from the backend dashboard instead
(Authentication → Users → user → reset password), then sign in at `/auth`.

## Grant the admin role

Roles are managed locally in **`/admin/users`** (root only). If the account exists but cannot open
`/admin`, check its local role there.

Legacy fallback for an account that has never logged in since the local role system was deployed:

```sql
-- Only used to seed the local account on first login; the local role then wins.
insert into public.user_roles (user_id, role)
select id, 'super_admin' from auth.users where lower(email) = lower('admin1@proteinestore.ma')
on conflict (user_id, role) do nothing;
```

Do not rely on Supabase roles for day-to-day management: use `/admin/users`.

## Verify

1. Sign in at `/auth` with the new password.
2. `/admin` loads the dashboard (overview, orders, customers, invoices, SEO).
3. `/admin/store` loads products, partners and staff (staff tab only for `super_admin`).

## Test instance

The test instance on `https://test.proteinstore.46.225.2.52.sslip.io` shares the same auth backend, so the same
account works there. Only orders/customers/invoices are separate.

## Security notes

- Passwords are never logged, stored in the repo, or written to the database by this app.
- Password recovery requires access to the mailbox configured on the account.
- If the admin mailbox is lost, recovery requires the backend dashboard or the service-role key.
