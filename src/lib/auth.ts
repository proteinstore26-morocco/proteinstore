import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** "admin1" style logins map to the store's email domain. */
export const loginToEmail = (login: string) => (login.includes("@") ? login.trim() : `${login.trim().toLowerCase()}@proteinestore.ma`);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async (u: User | null) => {
      setUser(u);
      if (u) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
        const roles = (data ?? []).map((r) => r.role as string);
        if (alive) { setIsSuperAdmin(roles.includes("super_admin")); setIsAdmin(roles.includes("admin") || roles.includes("super_admin")); }
      } else { setIsAdmin(false); setIsSuperAdmin(false); }
      if (alive) setLoading(false);
    };
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void load(s?.user ?? null); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return { user, isAdmin, isSuperAdmin, loading };
}
