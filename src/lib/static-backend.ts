// Backend local (mode statique Cloudflare) : comptes, sessions, rôles.
// Uniquement pour la démo statique — en production, Supabase Auth remplace tout ceci.
export type StaticRole = "customer" | "manager" | "admin" | "root";
export type StaticUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  roles: StaticRole[];
  provider: "email" | "google";
  createdAt: string;
};

export type StaticSession = {
  token: string;
  user: { id: string; email: string; fullName: string; roles: StaticRole[] };
};

const USERS_KEY = "ps_static_users";
const SESSION_KEY = "ps_static_session";

const SEED: StaticUser[] = [
  { id: "u-root", email: "admin1@proteinestore.ma", password: "Protein@321123", fullName: "Super Admin", roles: ["root"], provider: "email", createdAt: "2026-10-28" },
  { id: "u-admin", email: "admin@proteinstore.pro", password: "admin123", fullName: "Admin Store", roles: ["admin"], provider: "email", createdAt: "2026-10-28" },
  { id: "u-client", email: "client@demo.ma", password: "client123", fullName: "Client Démo", roles: ["customer"], provider: "email", createdAt: "2026-10-28" },
];

function users(): StaticUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as StaticUser[];
  } catch {}
  localStorage.setItem(USERS_KEY, JSON.stringify(SEED));
  return [...SEED];
}

function saveUsers(users: StaticUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function staticRoleRank(role: StaticRole): number {
  return { customer: 0, manager: 1, admin: 2, root: 3 }[role];
}

export function staticTopRole(userId: string): StaticRole {
  const user = users().find((u) => u.id === userId);
  if (!user) return "customer";
  return [...user.roles].sort((a, b) => staticRoleRank(b) - staticRoleRank(a))[0] ?? "customer";
}

export function staticSession(): StaticSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StaticSession;
    return users().some((u) => u.id === session.user.id) ? session : null;
  } catch {
    return null;
  }
}

export function staticSessionUser() {
  const session = staticSession();
  if (!session) return null;
  return users().find((u) => u.id === session.user.id) ?? null;
}

export function staticSignIn(
  login: string,
  password: string,
): { ok: boolean; error?: string; session?: StaticSession } {
  const email = login.includes("@") ? login.trim().toLowerCase() : `${login.trim().toLowerCase()}@proteinestore.ma`;
  const user = users().find((u) => u.email.toLowerCase() === email);
  if (!user || user.password !== password) return { ok: false, error: "bad_credentials" };
  const token = "static-" + btoa(`${user.id}:${Date.now()}`);
  const session: StaticSession = {
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, roles: user.roles },
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function staticSignUp(
  email: string,
  password: string,
  fullName: string,
): { ok: boolean; error?: string } {
  email = email.trim().toLowerCase();
  if (!email.includes("@") || password.length < 6) return { ok: false, error: "E-mail ou mot de passe invalide (6 caractères min)." };
  if (users().find((u) => u.email.toLowerCase() === email)) return { ok: false, error: "Un compte existe déjà avec cet e-mail." };
  const list = users();
  list.push({
    id: "u-" + Math.random().toString(36).slice(2, 10),
    email,
    password,
    fullName: fullName || email.split("@")[0] || email,
    roles: ["customer"],
    provider: "email",
    createdAt: new Date().toISOString().slice(0, 10),
  });
  saveUsers(list);
  return { ok: true };
}

export function staticSignOut(): void {
  localStorage.removeItem(SESSION_KEY);
}
