import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

import { resolveRole } from './roles';
export { roleHome } from './roles';
export type { AppRole } from './roles';
import type { AppRole } from './roles';

export type SessionState = {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
  fullName: string;
  trust: number;
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    user: null,
    role: null,
    fullName: "",
    trust: 50,
  });

  useEffect(() => {
    let alive = true;
    let revision = 0;

    async function load(user: User | null) {
      const currentRevision = ++revision;
      if (!user) {
        if (alive) setState({ loading: false, user: null, role: null, fullName: "", trust: 50 });
        return;
      }
      const [{ data: roleRows }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("full_name, trust_score").eq("id", user.id).maybeSingle(),
      ]);
      if (!alive || currentRevision !== revision) return;
      setState({
        loading: false,
        user,
        role: resolveRole(roleRows ?? []),
        fullName: profile?.full_name || user.email || "Account",
        trust: profile?.trust_score ?? 50,
      });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => { void load(session?.user ?? null); }, 0);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
