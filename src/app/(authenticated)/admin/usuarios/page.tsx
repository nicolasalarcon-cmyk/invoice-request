"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, KeyRound, Trash2, ShieldCheck } from "lucide-react";

interface AppUser { id: string; email: string; nombre: string; roles: string[]; created_at: string; }

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiUsers(token: string): Promise<AppUser[]> {
  const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
  return res.json() as Promise<AppUser[]>;
}

type AppRoleOption = "super_admin" | "admin" | "financiera" | "cartera" | "comercial";
const ROLE_OPTIONS: { value: AppRoleOption; label: string }[] = [
  { value: "super_admin",  label: "SuperAdministrador" },
  { value: "admin",        label: "Administrador" },
  { value: "financiera",   label: "Financiera" },
  { value: "cartera",      label: "Cartera" },
  { value: "comercial",    label: "Comercial" },
];

async function apiCreateUser(token: string, data: { email: string; password: string; nombre: string; role: AppRoleOption }) {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

async function apiUpdatePassword(token: string, userId: string, password: string) {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "password", password }),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

async function apiUpdateRole(token: string, userId: string, role: AppRoleOption) {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "role", role }),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

async function apiDeleteUser(token: string, userId: string) {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

export default function UsersPage() {
  const { canManageUsers: isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pwUser, setPwUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", role: "comercial" as AppRoleOption });
  const [newPw, setNewPw] = useState("");

  const load = async () => {
    setLoadingList(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesión");
      setUsers(await apiUsers(token));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    setLoadingList(false);
  };
  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [isAdmin]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (!isAdmin) return <main className="mx-auto max-w-md py-16 text-center"><h1 className="text-2xl font-bold">Acceso restringido</h1></main>;

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.nombre) { toast.error("Completa todos los campos"); return; }
    if (form.password.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesión");
      await apiCreateUser(token, form);
      toast.success("Usuario creado");
      setCreating(false);
      setForm({ nombre: "", email: "", password: "", role: "comercial" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handlePw = async () => {
    if (!pwUser || newPw.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesión");
      await apiUpdatePassword(token, pwUser.id, newPw);
      toast.success("Contraseña actualizada");
      setPwUser(null); setNewPw("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleRole = async (u: AppUser, role: AppRoleOption) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesión");
      await apiUpdateRole(token, u.id, role);
      toast.success("Rol actualizado");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`¿Eliminar definitivamente a ${u.email}?`)) return;
    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesión");
      await apiDeleteUser(token, u.id);
      toast.success("Usuario eliminado");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={() => setCreating(true)}><UserPlus className="mr-2 h-4 w-4" /> Nuevo usuario</Button>
      </div>

      <div className="mt-6 space-y-2">
        {loadingList ? <p className="text-sm text-muted-foreground">Cargando…</p> :
          users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div>
                <p className="font-medium">{u.nombre || u.email}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <div className="mt-1 flex gap-1">
                  {u.roles.length === 0 && <Badge variant="outline">sin rol</Badge>}
                  {u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={(u.roles.find((r) => ROLE_OPTIONS.some((o) => o.value === r)) ?? "comercial") as AppRoleOption}
                  onValueChange={(v) => handleRole(u, v as AppRoleOption)}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.value === "super_admin" && <ShieldCheck className="mr-2 inline h-3 w-3" />}
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setPwUser(u)}><KeyRound className="mr-2 h-4 w-4" /> Contraseña</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(u)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre completo</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div><Label>Correo</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Contraseña inicial</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRoleOption })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Se enviará un correo al usuario con sus accesos.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cambiar contraseña</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Usuario: {pwUser?.email}</p>
          <Input type="text" placeholder="Nueva contraseña" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>Cancelar</Button>
            <Button onClick={handlePw}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
