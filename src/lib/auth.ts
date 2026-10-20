import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncMyAccount } from "@/lib/account.functions";
import type { Account } from "@/lib/account-types";
import { roleAtLeast } from "@/lib/account-types";

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
        const result = await syncRef.current();
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
