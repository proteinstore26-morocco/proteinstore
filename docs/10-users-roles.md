# Users, roles and the root dashboard

## Role hierarchy

| Role       | Label                | Access                                                                 |
| ---------- | -------------------- | ---------------------------------------------------------------------- |
| `root`     | Super admin (root)   | Everything + `/admin/users` (accounts, roles, invitations, suspension) |
| `admin`    | Administrateur       | Store: orders, customers, invoices, SEO, catalogue, partners           |
| `manager`  | Responsable boutique | Orders, customers, invoices, overview                                  |
| `customer` | Client               | Storefront, account, order tracking                                    |

Legacy Supabase roles are mapped **once**, on first login: `super_admin → root`, `admin → admin`,
otherwise `customer`. After that, the **local account store** (`data/proteinstore.db`) is authoritative.
A pending invitation takes precedence over the legacy mapping.

## Root dashboard

`/admin/users` (visible only to `root`):

- **Invite** an e-mail with a role (manager/admin/root/customer). The dashboard generates a message to
  copy; the person signs up at `/auth`, confirms their e-mail, and the role is applied on first login.
- **Change role** of any existing account (except removing your own root role).
- **Suspend / reactivate** an account (self-suspension and last-root suspension are refused).
- **Revoke** pending invitations.
- **Audit**: every role/status/invitation change is appended to `account_events`.

Accounts appear after their first login. Customers who only ordered as guests are visible in the
**Clients** panel (from orders), not here until they create an account.

## Invitation flow

1. Root enters `email` + role and copies the generated message.
2. The person opens `/auth`, signs up with that e-mail, confirms the e-mail.
3. On first login, `ensureLocalAccount` finds the pending invitation, assigns the invited role, marks it
   accepted and logs `invitation.accepted`.
4. The app navigates to `/admin` for manager/admin/root, `/account` for customers.

## Hard limits (no service-role key on this host)

- The dashboard **cannot create Supabase Auth users**, delete them, or reset their passwords. Supabase
  remains the identity provider; sign-up + e-mail confirmation is required.
- Role changes are **local**. They immediately control this application, but they do **not** revoke a
  user's legacy Supabase `user_roles` row. For a user who already has Supabase `admin`, also remove that
  role in the backend dashboard if you demote them.
- If the root account is lost, recovery requires the backend dashboard or the service-role key.
- Suspension blocks dashboard access; the storefront is public and remains browsable/orderable.

## Bootstrap

The first login of a Supabase `super_admin` creates the local `root` account. With the current backend
that is `admin1@proteinestore.ma`. There is no seeded password.

## Data

- `accounts`: user_id, email, name, role, status, timestamps.
- `invitations`: email, role, status, invited_by, timestamps.
- `account_events`: actor, target, action, detail, timestamp.

All three live in `data/proteinstore.db` and are included in `scripts/backup-orders.mjs`.
