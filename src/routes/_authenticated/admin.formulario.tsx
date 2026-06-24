import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getFormConfig, saveFormConfig, type FormConfig } from "@/lib/form-config";
import { Save, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/formulario")({
  component: FormularioPage,
  head: () => ({ meta: [{ title: "Formulario · Admin" }] }),
});

const TOGGLEABLE = [
  { key: "email_estudiante", defaultLabel: "Correo del estudiante" },
  { key: "fecha_fin", defaultLabel: "Fecha de finalización" },
  { key: "horas_programa", defaultLabel: "Horas / Duración" },
  { key: "observaciones", defaultLabel: "Observaciones" },
];

function FormularioPage() {
  const { isAdmin } = useAuth();
  const [cfg, setCfg] = useState<FormConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [newConcepto, setNewConcepto] = useState("");
  const [newTipo, setNewTipo] = useState("");

  useEffect(() => {
    if (isAdmin) getFormConfig().then(setCfg);
  }, [isAdmin]);

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;
  if (!cfg) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;

  const save = async () => {
    setBusy(true);
    try {
      await saveFormConfig(cfg);
      toast.success("Formulario actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
    setBusy(false);
  };

  const setField = (key: string, patch: Partial<{ visible: boolean; label: string }>) => {
    const current = cfg.fields[key] ?? { visible: true, label: "" };
    setCfg({ ...cfg, fields: { ...cfg.fields, [key]: { ...current, ...patch } } });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editor de formulario</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controla qué campos ven los comerciales y las listas de selección.</p>
        </div>
        <Button onClick={save} disabled={busy}><Save className="mr-2 h-4 w-4" /> {busy ? "Guardando…" : "Guardar"}</Button>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Campos opcionales</h2>
        <div className="mt-4 space-y-3">
          {TOGGLEABLE.map(({ key, defaultLabel }) => {
            const f = cfg.fields[key] ?? { visible: true, label: defaultLabel };
            return (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={f.visible}
                  onChange={(e) => setField(key, { visible: e.target.checked })}
                />
                <Input
                  className="flex-1"
                  value={f.label}
                  onChange={(e) => setField(key, { label: e.target.value })}
                  placeholder={defaultLabel}
                />
                <span className="w-44 text-xs text-muted-foreground">{key}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Conceptos disponibles</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {cfg.conceptos.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
              {c}
              <button onClick={() => setCfg({ ...cfg, conceptos: cfg.conceptos.filter((x) => x !== c) })} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Input value={newConcepto} onChange={(e) => setNewConcepto(e.target.value)} placeholder="Nuevo concepto" />
          <Button variant="outline" onClick={() => {
            if (newConcepto && !cfg.conceptos.includes(newConcepto)) {
              setCfg({ ...cfg, conceptos: [...cfg.conceptos, newConcepto] });
              setNewConcepto("");
            }
          }}><Plus className="h-4 w-4" /></Button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tipos de programa</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {cfg.tipos_programa.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
              {c}
              <button onClick={() => setCfg({ ...cfg, tipos_programa: cfg.tipos_programa.filter((x) => x !== c) })} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Input value={newTipo} onChange={(e) => setNewTipo(e.target.value)} placeholder="Nuevo tipo" />
          <Button variant="outline" onClick={() => {
            if (newTipo && !cfg.tipos_programa.includes(newTipo)) {
              setCfg({ ...cfg, tipos_programa: [...cfg.tipos_programa, newTipo] });
              setNewTipo("");
            }
          }}><Plus className="h-4 w-4" /></Button>
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        <Label className="sr-only">tip</Label>
        Los cambios afectan el formulario que ve el comercial al crear o editar solicitudes.
      </p>
    </main>
  );
}
