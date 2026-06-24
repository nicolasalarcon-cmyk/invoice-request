import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  nombre_completo: string | null;
  email: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isComercial, setIsComercial] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialSessionChecked = false;

    const hydrate = (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        setTimeout(async () => {
          try {
            const [{ data: roles }, { data: prof }] = await Promise.all([
              supabase.from("user_roles").select("role").eq("user_id", s.user.id),
              supabase
                .from("profiles")
                .select("nombre_completo,email")
                .eq("user_id", s.user.id)
                .maybeSingle(),
            ]);
            if (!mounted) return;
            const list = (roles ?? []).map((r) => r.role as string);
            setIsAdmin(list.includes("admin"));
            setIsComercial(list.includes("comercial") || list.includes("admin"));
            setProfile(prof ?? { nombre_completo: s.user.email ?? null, email: s.user.email ?? null });
            setLoading(false);
          } catch {
            if (mounted) setLoading(false);
          }
        }, 0);
      } else {
        setIsAdmin(false);
        setIsComercial(false);
        setProfile(null);
        setLoading(false);
      }
    };

    let lastUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!s && !initialSessionChecked) return;
      // Evita re-hidratar (y refetch en cascada) cuando Supabase re-emite eventos
      // al recuperar foco de la pestaña (TOKEN_REFRESHED, USER_UPDATED, SIGNED_IN
      // con el mismo usuario, INITIAL_SESSION repetido, etc.).
      const nextId = s?.user?.id ?? null;
      if (initialSessionChecked && nextId === lastUserId && event !== "SIGNED_OUT") {
        return;
      }

      lastUserId = nextId;
      hydrate(s);
    });

    supabase.auth.getSession().then(({ data }) => {
      initialSessionChecked = true;
      lastUserId = data.session?.user?.id ?? null;
      hydrate(data.session);
    }).catch(() => {
      initialSessionChecked = true;
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, isAdmin, isComercial, profile, loading };
}
