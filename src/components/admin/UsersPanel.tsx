import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, MailPlus, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  getUsersDashboard,
  inviteUser,
  revokeInvitation,
  setUserRole,
  setUserStatus,
} from "@/lib/account.functions";
import { useAuth } from "@/lib/auth";
import {
  ACCOUNT_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Account,
  type AccountRole,
} from "@/lib/account-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const date = (iso: string) =>
  new Date(iso).toLocaleString("fr-MA", { dateStyle: "medium", timeStyle: "short" });

const roleTone = (role: AccountRole) =>
  role === "root"
    ? "text-destructive border-destructive/30"
    : role === "admin"
      ? "text-primary border-primary/30"
      : role === "manager"
        ? "text-warning border-warning/30"
        : "text-muted-foreground";

export function UsersPanel() {
  const dashboardFn = useServerFn(getUsersDashboard);
  const inviteFn = useServerFn(inviteUser);
  const roleFn = useServerFn(setUserRole);
  const statusFn = useServerFn(setUserStatus);
  const revokeFn = useServerFn(revokeInvitation);
  const queryClient = useQueryClient();
  const { account: me } = useAuth();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<AccountRole>("manager");
  const [draftRoles, setDraftRoles] = useState<Record<string, AccountRole>>({});
  const [inviteText, setInviteText] = useState("");
  const [busy, setBusy] = useState(false);

  const dashboard = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => dashboardFn(),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await inviteFn({
        data: {
          email,
          role: inviteRole,
          ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
        },
      });
      const link = `${window.location.origin}/auth`;
      const text = `Bonjour${fullName.trim() ? ` ${fullName.trim()}` : ""},\n\ncréez votre compte PROTEIN STORE® avec l'e-mail ${result.invitation.email} : ${link}\nVotre accès « ${ROLE_LABELS[result.invitation.role]} » sera activé automatiquement à la première connexion.\n\nL'équipe PROTEIN STORE® — Kénitra`;
      setInviteText(text);
      setEmail("");
      setFullName("");
      await refresh();
      toast.success("Invitation créée. Copiez le message et envoyez-le.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invitation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(account: Account, role: AccountRole) {
    setBusy(true);
    try {
      await roleFn({ data: { userId: account.userId, role } });
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[account.userId];
        return next;
      });
      await refresh();
      toast.success(`Rôle de ${account.email} : ${ROLE_LABELS[role]}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Changement de rôle impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(account: Account) {
    setBusy(true);
    try {
      const status = account.status === "active" ? "suspended" : "active";
      await statusFn({ data: { userId: account.userId, status } });
      await refresh();
      toast.success(status === "suspended" ? "Compte suspendu." : "Compte réactivé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await revokeFn({ data: { id } });
      await refresh();
      toast.success("Invitation révoquée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Révocation impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (dashboard.isPending)
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">Chargement des comptes…</p>
    );
  if (dashboard.isError || !dashboard.data) {
    return (
      <p className="py-12 text-center text-sm text-destructive">
        Accès réservé au super admin (root).
      </p>
    );
  }

  const data = dashboard.data;
  const pending = data.invitations.filter((invitation) => invitation.status === "pending");

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {ACCOUNT_ROLES.map((role) => (
          <div key={role} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{data.counts[role]}</p>
          </div>
        ))}
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Invitations en attente</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-warning">
            {data.pendingInvitations}
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="size-5 text-primary" />
          <h2 className="font-semibold">Inviter un compte</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          L'invitation ne crée pas le mot de passe. La personne s'inscrit sur{" "}
          <span className="font-mono">/auth</span> et confirme son e-mail ; son rôle est appliqué à
          la première connexion.
        </p>
        <form onSubmit={submitInvite} className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_auto]">
          <div>
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nouveau.manager@exemple.ma"
            />
          </div>
          <div>
            <Label htmlFor="invite-name">Nom (optionnel)</Label>
            <Input
              id="invite-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Rôle</Label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as AccountRole)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ACCOUNT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>
              <MailPlus /> Inviter
            </Button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[inviteRole]}</p>
        {inviteText && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="whitespace-pre-line text-sm">{inviteText}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteText);
                toast.success("Message copié.");
              }}
            >
              <Copy /> Copier le message
            </Button>
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Invitations en attente
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-y text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">E-mail</th>
                  <th className="px-3 py-2 font-medium">Rôle prévu</th>
                  <th className="px-3 py-2 font-medium">Créée le</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pending.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="px-3 py-3">
                      <p>{invitation.fullName ?? "—"}</p>
                      <p className="font-mono text-xs text-muted-foreground">{invitation.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {date(invitation.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void revoke(invitation.id)}
                      >
                        Révoquer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Comptes ({data.accounts.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-y text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Compte</th>
                <th className="px-3 py-2 font-medium">Rôle</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Dernière connexion</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.accounts.map((account) => {
                const self = account.userId === me?.userId;
                const draft = draftRoles[account.userId] ?? account.role;
                const changed = draft !== account.role;
                return (
                  <tr
                    key={account.userId}
                    className={account.status === "suspended" ? "opacity-60" : ""}
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {account.fullName ?? "Sans nom"}{" "}
                        {self && <span className="text-xs text-primary">(vous)</span>}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{account.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={draft}
                        disabled={self || busy}
                        onChange={(event) =>
                          setDraftRoles((current) => ({
                            ...current,
                            [account.userId]: event.target.value as AccountRole,
                          }))
                        }
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                        aria-label={`Rôle de ${account.email}`}
                      >
                        {ACCOUNT_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      {changed && (
                        <Button
                          size="sm"
                          className="ml-2"
                          disabled={busy}
                          onClick={() => void changeRole(account, draft)}
                        >
                          <Check /> OK
                        </Button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className={
                          account.status === "active"
                            ? "text-success border-success/30"
                            : "text-destructive border-destructive/30"
                        }
                      >
                        {account.status === "active" ? "Actif" : "Suspendu"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{date(account.lastSeenAt)}</td>
                    <td className="px-3 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={self || busy}
                        onClick={() => void toggleStatus(account)}
                      >
                        {account.status === "active" ? <UserMinus /> : <ShieldCheck />}
                        {account.status === "active" ? "Suspendre" : "Réactiver"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.accounts.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun compte local pour l'instant.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Journal des comptes
        </h2>
        <ol className="mt-3 space-y-2 text-sm">
          {data.events.map((event) => (
            <li key={event.id} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <div>
                <p>
                  <span className="font-mono text-xs text-muted-foreground">{event.action}</span>{" "}
                  {event.detail ?? ""}
                </p>
                <p className="text-xs text-muted-foreground">{date(event.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
