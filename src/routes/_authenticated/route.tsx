import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { STATIC_MODE } from "@/lib/static-mode";
import { staticSessionUser } from "@/lib/static-backend";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (STATIC_MODE) {
      if (!staticSessionUser()) throw redirect({ to: "/auth" });
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
