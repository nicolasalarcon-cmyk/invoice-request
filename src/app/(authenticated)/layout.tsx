"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePendingCount } from "@/lib/use-pending-count";
import {
  FileText, LogOut, LayoutDashboard, ClipboardList,
  FilePlus, Users, LayoutTemplate, Hash, BookOpen,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SuperAdmin",
  admin: "Administrador",
  financiera: "Financiera",
  cartera: "Cartera",
  comercial: "Comercial",
};

function NavTab({ href, icon, label, badge }: { href: string; icon: React.ReactNode; label: string; badge?: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? "border-blue-600 bg-white text-blue-600 shadow-sm"
          : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
      {badge && (
        <span className="ml-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-slate-100 shadow-sm" style={{ background: "linear-gradient(to right, rgba(239,246,255,0.95), rgba(240,249,255,0.6), white)", backdropFilter: "blur(8px)" }}>
        {/* Top bar */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/login" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}>
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="block text-base font-bold leading-none text-slate-900">Recibos</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">UdeCataluña</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-white/80 px-3 py-1.5 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
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
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-1">
            {canViewDashboard && (
              <NavTab href="/admin/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
            )}
            {canViewAllRequests && (
              <NavTab href="/admin" icon={<ClipboardList className="h-4 w-4" />} label="Solicitudes" badge={badgeCount} />
            )}
            {/* Crear: todos los roles */}
            <NavTab href="/solicitar" icon={<FilePlus className="h-4 w-4" />} label="Crear" />
            {/* Mis recibos: solo comercial (no ve la bandeja completa) */}
            {!canViewAllRequests && (
              <NavTab href="/mis-recibos" icon={<ClipboardList className="h-4 w-4" />} label="Mis recibos" />
            )}
            {canViewNumeracion && (
              <NavTab href="/admin/numeracion" icon={<Hash className="h-4 w-4" />} label="Numeración" />
            )}
            {canManagePrograms && (
              <NavTab href="/admin/programas" icon={<BookOpen className="h-4 w-4" />} label="Programas" />
            )}
            {canManageTemplates && (
              <NavTab href="/admin/plantillas" icon={<LayoutTemplate className="h-4 w-4" />} label="Plantillas" />
            )}
            {canManageUsers && (
              <NavTab href="/admin/usuarios" icon={<Users className="h-4 w-4" />} label="Usuarios" />
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
