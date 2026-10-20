// Local account & role model. Supabase remains the identity provider; this is the
// application's authorization source (root > admin > manager > customer).
export const ACCOUNT_ROLES = ["customer", "manager", "admin", "root"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ROLE_RANK: Record<AccountRole, number> = {
  customer: 0,
  manager: 1,
  admin: 2,
  root: 3,
};

export const ROLE_LABELS: Record<AccountRole, string> = {
  customer: "Client",
  manager: "Responsable boutique",
  admin: "Administrateur",
  root: "Super admin (root)",
};

export const ROLE_DESCRIPTIONS: Record<AccountRole, string> = {
  customer: "Boutique, commandes et suivi uniquement.",
  manager: "Tableau de bord : commandes, clients, factures.",
  admin: "Tout le magasin + SEO + catalogue/partenaires.",
  root: "Tout, plus la gestion des comptes et des rôles.",
};

export function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value);
}

export function roleAtLeast(role: AccountRole, minimum: AccountRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export type AccountStatus = "active" | "suspended";

export type Account = {
  userId: string;
  email: string;
  fullName: string | null;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type InvitationStatus = "pending" | "accepted" | "revoked";

export type Invitation = {
  id: string;
  email: string;
  fullName: string | null;
  role: AccountRole;
  status: InvitationStatus;
  invitedBy: string | null;
  createdAt: string;
  acceptedAt: string | null;
};

export type AccountEvent = {
  id: number;
  actorId: string | null;
  targetId: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

export type UsersDashboard = {
  accounts: Account[];
  invitations: Invitation[];
  events: AccountEvent[];
  counts: Record<AccountRole, number>;
  pendingInvitations: number;
};

export type SyncAccountResult = {
  account: Account;
  suspended: boolean;
};
