"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "financiera" | "cartera" | "mini_financiera" | "comercial" | "user";

interface Profile {
  nombre_completo: string | null;
  email: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
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
            const list = (roles ?? []).map((r) => r.role as AppRole);
            // Priority: super_admin > admin > financiera > cartera > mini_financiera > comercial > user
            const priority: AppRole[] = ["super_admin", "admin", "financiera", "cartera", "mini_financiera", "comercial", "user"];
            const resolved = priority.find((r) => list.includes(r)) ?? null;
            setRole(resolved);
            setProfile(prof ?? { nombre_completo: s.user.email ?? null, email: s.user.email ?? null });
            setLoading(false);
          } catch {
            if (mounted) setLoading(false);
          }
        }, 0);
      } else {
        setRole(null);
        setProfile(null);
        setLoading(false);
      }
    };

    let lastUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!s && !initialSessionChecked) return;
      const nextId = s?.user?.id ?? null;
      if (initialSessionChecked && nextId === lastUserId && event !== "SIGNED_OUT") return;
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

  // ─── Permisos derivados del rol ───────────────────────────────────────────────
  const isAdmin         = role === "super_admin" || role === "admin";
  const canApprove      = role === "super_admin" || role === "admin" || role === "financiera";
  const canDelete       = role === "super_admin" || role === "admin";
  const canManageUsers  = role === "super_admin";
  // Mini Financiera solo tiene la Bandeja — sin Dashboard, Numeración ni Crear.
  const canViewDashboard     = role === "super_admin" || role === "admin" || role === "financiera";
  const canViewNumeracion    = role === "super_admin" || role === "admin" || role === "financiera" || role === "cartera";
  const canManageTemplates   = role === "super_admin" || role === "admin";
  const canManagePrograms    = role === "super_admin" || role === "admin";
  const canViewAllRequests   = role === "super_admin" || role === "admin" || role === "financiera" || role === "cartera" || role === "mini_financiera";
  const isCartera       = role === "cartera";
  const isMiniFinanciera = role === "mini_financiera";
  // Quiénes pueden marcar el sub-estado de Gestión de Pago (Aplicado/No Aplicado):
  // exclusivo de Mini Financiera, Admin y SuperAdmin.
  const canGestionarPago = role === "super_admin" || role === "admin" || role === "mini_financiera";
  const isComercial     = role !== null; // todos pueden crear solicitudes

  return {
    session, user, role, profile, loading,
    isAdmin, isComercial, isCartera, isMiniFinanciera,
    canApprove, canDelete, canManageUsers,
    canViewDashboard, canViewNumeracion,
    canManageTemplates, canManagePrograms,
    canViewAllRequests, canGestionarPago,
  };
}
