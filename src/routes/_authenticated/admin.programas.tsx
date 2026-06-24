import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { listProgramas, type Programa } from "@/lib/programas";

export const Route = createFileRoute("/_authenticated/admin/programas")({
  component: ProgramasPage,
  head: () => ({ meta: [{ title: "Programas · Admin" }] }),
});

const EMPTY: Omit<Programa, "id"> = {
  nombre: "", nemonico: "", tipo_programa: "Diplomado", codigo_snies: "", duracion: "",
};

function ProgramasPage() {
  const { isAdmin, loading } = useAuth();
  const [items, setItems] = useState<Programa[]>([]);
  const [editing, setEditing] = useState<(Omit<Programa, "id"> & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => listProgramas().then(setItems).catch((e) => toast.error(e.message));

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const payload = {
      nombre: editing.nombre,
      nemonico: editing.nemonico || null,
      tipo_programa: editing.tipo_programa || null,
      codigo_snies: editing.codigo_snies || null,
      duracion: editing.duracion || null,
    };
    const { error } = editing.id
      ? await supabase.from("programas").update(payload).eq("id", editing.id)
      : await supabase.from("programas").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Programa guardado");
    setEditing(null);
    load();
  };

  const remove = async (p: Programa) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    const { error } = await supabase.from("programas").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Programa eliminado");
    load();
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de programas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Estos programas autocompletan el formulario de solicitud.</p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}><Plus className="mr-2 h-4 w-4" /> Nuevo programa</Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nemónico</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">SNIES</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Duración</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{p.nemonico ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{p.nombre}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.codigo_snies ?? "—"}</td>
                <td className="px-3 py-2">{p.tipo_programa ?? "—"}</td>
                <td className="px-3 py-2">{p.duracion ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aún no hay programas. Crea el primero con "Nuevo programa".</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar programa" : "Nuevo programa"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Row label="Nombre completo *"><Input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} placeholder="Ej: Diplomado Finanzas con Inteligencia Artificial" /></Row>
              </div>
              <Row label="Nemónico"><Input value={editing.nemonico ?? ""} onChange={(e) => setEditing({ ...editing, nemonico: e.target.value.toUpperCase() })} placeholder="Ej: DFINIA" /></Row>
              <Row label="Tipo"><Input value={editing.tipo_programa ?? ""} onChange={(e) => setEditing({ ...editing, tipo_programa: e.target.value })} placeholder="Diplomado / Especialización" /></Row>
              <div className="sm:col-span-2">
                <Row label="SNIES"><Input value={editing.codigo_snies ?? ""} onChange={(e) => setEditing({ ...editing, codigo_snies: e.target.value })} placeholder="Ej: Administración de Empresas Código SNIES 108572" /></Row>
              </div>
              <div className="sm:col-span-2">
                <Row label="Duración"><Input value={editing.duracion ?? ""} onChange={(e) => setEditing({ ...editing, duracion: e.target.value })} placeholder="Ej: 14 semanas / 3 cuatrimestres" /></Row>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={busy || !editing?.nombre}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
