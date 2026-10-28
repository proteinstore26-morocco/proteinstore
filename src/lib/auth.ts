import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncMyAccount } from "@/lib/account.functions";
import type { Account } from "@/lib/account-types";
import { roleAtLeast } from "@/lib/account-types";
import { STATIC_MODE } from "./static-mode";
import { staticSessionUser, staticTopRole } from "./static-backend";

/** "admin1" style logins map to the store's email domain. */
export const loginToEmail = (login: string) =>
  login.includes("@") ? login.trim() : `${login.trim().toLowerCase()}@proteinestore.ma`;

export function useAuth() {
  const sync = useServerFn(syncMyAccount);
  const syncRef = useRef(sync);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    if (STATIC_MODE) {
      // Backend local (localStorage) : session + rôle depuis static-backend.
      const load = () => {
        const su = staticSessionUser();
        if (su) {
          const role = staticTopRole(su.id);
          setUser({
            id: su.id,
            email: su.email,
            user_metadata: { full_name: su.fullName },
          } as unknown as User);
          setAccount({
            userId: su.id,
            email: su.email,
            fullName: su.fullName,
            role,
            status: "active",
            createdAt: su.createdAt,
            updatedAt: su.createdAt,
            lastSeenAt: su.createdAt,
          });
        } else {
          setUser(null);
          setAccount(null);
        }
        setLoading(false);
      };
      void load();
      window.addEventListener("ps-static-auth", load);
      return () => window.removeEventListener("ps-static-auth", load);
    }

    let alive = true;

    const load = async (nextUser: User | null) => {
      setUser(nextUser);
      if (!nextUser) {
        if (alive) {
          setAccount(null);
          setLoading(false);
        }
        return;
      }
      try {
        const result = await syncRef.current({ data: undefined });
        if (alive) setAccount(result.account);
      } catch (error) {
        console.error("[auth] account sync failed", error);
        if (alive) setAccount(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void supabase.auth.getUser().then(({ data }) => void load(data.user));
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        void load(session?.user ?? null);
      }
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const role = account?.role ?? "customer";
  const active = account?.status === "active";

  return {
    user,
    account,
    role,
    loading,
    isSuspended: account?.status === "suspended",
    isManager: active && roleAtLeast(role, "manager"),
    isAdmin: active && roleAtLeast(role, "admin"),
    isRoot: active && role === "root",
    /** Backwards-compatible name used by the store page. */
    isSuperAdmin: active && role === "root",
  };
}
