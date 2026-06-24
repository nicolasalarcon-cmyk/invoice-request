import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Acceso · Recibos UdeCataluña" },
      { name: "description", content: "Inicia sesión en la plataforma." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const redirectByRole = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    if (list.includes("admin")) navigate({ to: "/admin", replace: true });
    else navigate({ to: "/mis-recibos", replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectByRole();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) redirectByRole();
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      {/* Fondo decorativo suave */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-blue-500/20"
            style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}>
            <FileText className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tracking-tight text-slate-900">Recibos</p>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">UdeCataluña</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-md">
          <h1 className="text-xl font-bold text-slate-900">Bienvenido</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa tus credenciales para acceder a la plataforma.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-500">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 rounded-xl border-slate-200 bg-slate-50/30 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-500">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 rounded-xl border-slate-200 bg-slate-50/30 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white shadow-md shadow-blue-500/10 transition-all hover:shadow-lg disabled:opacity-60"
              style={{ background: "linear-gradient(to right, #3B82F6, #6366F1)" }}
            >
              {busy ? "Verificando…" : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Corporación Universitaria de Cataluña © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
