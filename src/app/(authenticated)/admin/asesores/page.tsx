"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { listAsesores, type Asesor } from "@/lib/asesores";

export default function AsesoresPage() {
  const { canManagePrograms: isAdmin, loading } = useAuth();
  const [items, setItems] = useState<Asesor[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => listAsesores(false).then(setItems).catch((e) => toast.error(e.message));

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;

  const agregar = async () => {
    if (!nuevoNombre.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("asesores").insert({ nombre: nuevoNombre.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Asesor agregado");
    setNuevoNombre("");
    load();
  };

  const toggleActivo = async (a: Asesor) => {
    const { error } = await supabase.from("asesores").update({ activo: !a.activo }).eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (a: Asesor) => {
    if (!confirm(`¿Eliminar a "${a.nombre}" del catálogo de asesores?`)) return;
    const { error } = await supabase.from("asesores").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Asesor eliminado");
    load();
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-muted-foreground">
        Estos nombres aparecen en el selector "Asesor Comercial" al crear una solicitud.
        Los jefes de área deben quedar incluidos aquí también, para poder asignarse a sí mismos
        cuando la solicitud no corresponde a un asesor en particular.
      </p>

      <div className="mt-6 flex gap-2">
        <Input
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          placeholder="Nombre completo del asesor"
          onKeyDown={(e) => e.key === "Enter" && agregar()}
        />
        <Button onClick={agregar} disabled={busy || !nuevoNombre.trim()}>
          <Plus className="mr-2 h-4 w-4" /> Agregar
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{a.nombre}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleActivo(a)}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.activo ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                  >
                    {a.activo ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove(a)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Aún no hay asesores. Agrega el primero arriba.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
