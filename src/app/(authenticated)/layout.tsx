"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePendingCount } from "@/lib/use-pending-count";
import { useIdleLogout } from "@/lib/use-idle-logout";
import {
  LogOut, LayoutDashboard, ClipboardList,
  FilePlus, Users, LayoutTemplate, Hash, BookOpen,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SuperAdmin",
  admin: "Administrador",
  financiera: "Financiera",
  cartera: "Cartera",
  comercial: "Comercial",
};

function NavTab({
  href, icon, label, badge, small,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  small?: boolean;
}) {
  const pathname = usePathname();
  const active =
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`relative flex items-center gap-1.5 px-3.5 py-3 font-medium transition-all duration-150 select-none
        ${small ? "text-sm" : "text-[15px]"}
        ${active
          ? "text-blue-700"
          : "text-slate-500 hover:text-slate-800"
        }`}
    >
      {icon}
      {label}
      {badge && (
        <span className="ml-0.5 rounded-full bg-blue-700 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
          {badge}
        </span>
      )}
      {/* active underline */}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-700" />
      )}
    </Link>
  );
}

function NavDivider() {
  return <div className="mx-1 my-auto h-4 w-px self-center bg-slate-200" />;
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const {
    user, role, profile, loading,
    isAdmin, canViewDashboard, canViewNumeracion,
    canManageTemplates, canManagePrograms, canManageUsers,
    canViewAllRequests,
  } = useAuth();
  const router = useRouter();
  const pendingCount = usePendingCount(canViewAllRequests);
  useIdleLogout(!!user);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, oklch(0.15 0.06 260), oklch(0.22 0.08 260))" }}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/60">Cargando…</p>
        </div>
      </div>
    );
  }

  const badgeCount = pendingCount > 0 ? (pendingCount > 99 ? "99+" : String(pendingCount)) : undefined;

  const hasConfigTabs = canViewNumeracion || canManagePrograms || canManageTemplates || canManageUsers;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-slate-200 shadow-sm bg-white/95 backdrop-blur-sm">
        {/* Top bar */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href={canViewAllRequests ? "/admin" : "/mis-recibos"} className="flex items-center gap-3">
            <span className="text-2xl font-bold leading-none" style={{ color: "#000b7b" }}>UdeCataluña</span>
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            <span className="hidden sm:block text-sm font-medium leading-none text-slate-500">Solicitudes</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                {(profile?.nombre_completo ?? user.email ?? "U")[0].toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <span className="block text-xs font-semibold leading-none text-slate-800">
                  {profile?.nombre_completo ?? user.email}
                </span>
                {role && (
                  <span className="mt-0.5 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    {ROLE_LABELS[role] ?? role}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
              className="rounded-xl p-2 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mx-auto max-w-7xl px-4">
          <nav className="flex items-center gap-0.5">

            {/* ── Tabs operativas (orden por frecuencia de uso) ── */}
            {canViewAllRequests && (
              <NavTab href="/admin" icon={<ClipboardList className="h-4 w-4" />} label="Solicitudes" badge={badgeCount} />
            )}
            <NavTab href="/solicitar" icon={<FilePlus className="h-4 w-4" />} label="Crear" />
            {!canViewAllRequests && (
              <NavTab href="/mis-recibos" icon={<ClipboardList className="h-4 w-4" />} label="Mis recibos" />
            )}
            {canViewDashboard && (
              <NavTab href="/admin/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
            )}

            {/* ── Separador ── */}
            {hasConfigTabs && <NavDivider />}

            {/* ── Tabs de configuración ── */}
            {canViewNumeracion && (
              <NavTab href="/admin/numeracion" icon={<Hash className="h-3.5 w-3.5" />} label="Numeración" small />
            )}
            {canManagePrograms && (
              <NavTab href="/admin/programas" icon={<BookOpen className="h-3.5 w-3.5" />} label="Programas" small />
            )}
            {canManagePrograms && (
              <NavTab href="/admin/asesores" icon={<Users className="h-3.5 w-3.5" />} label="Asesores" small />
            )}
            {canManageTemplates && (
              <NavTab href="/admin/plantillas" icon={<LayoutTemplate className="h-3.5 w-3.5" />} label="Plantillas" small />
            )}
            {canManageUsers && (
              <NavTab href="/admin/usuarios" icon={<Users className="h-3.5 w-3.5" />} label="Usuarios" small />
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
