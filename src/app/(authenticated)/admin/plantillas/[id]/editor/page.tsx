"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { clearTemplateCache, getTemplateDocType, type InvoiceTemplate } from "@/lib/invoice-template";
import { cn } from "@/lib/utils";
import { ArrowLeft, Save, RefreshCw } from "lucide-react";

const USA_SAMPLE = {
  recibo_numero: 2026001,
  recibo_fecha: "2026-06-18",
  nombre: "John Smith",
  identificacion: "PA 987654321",
  empresa: "Acme International Corp",
  cliente_nit: "98-7654321",
  direccion: "123 Business Ave",
  ciudad: "Miami",
  pais: "USA",
  telefono: "+1 (305) 555-0123",
  email: "john.smith@acme.com",
  programa: "Especialización en Gestión Empresarial",
  nemonico: "EGE-2026",
  plan_estudio: "Gerencia Comercial con IA",
  periodo: "2026-I",
  tipo_programa: "factura_usa",
  document_type: "factura_usa",
  matricula: 3500,
  valor_total: 3500,
  descuento: 0,
  descuento_pct: 0,
  descuento_bono: 0,
  recargo_total: 0,
  fecha_limite_pago: "2026-07-18",
  fecha_pago_extraordinario: null,
  codigo_estudiante: null,
  codigo_snies: null,
  cohorte: null,
  fecha_inicio: null,
  fecha_fin: null,
  horas_programa: null,
  duracion: null,
  convocatoria: null,
  concepto: "Matrícula",
  observaciones: null,
  template_id: null,
};

export default function EditorPage() {
  const { isAdmin, loading, user } = useAuth();
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [savedTpl, setSavedTpl] = useState<InvoiceTemplate | null>(null);
  const [editing, setEditing] = useState<InvoiceTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDocType, setPreviewDocType] = useState<"orden_matricula" | "factura_usa">("orden_matricula");
  const blobUrlRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("invoice_template")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error("Plantilla no encontrada"); return; }
        const t = data as InvoiceTemplate;
        setSavedTpl(t);
        setEditing(t);
      });
  }, [id, isAdmin]);

  const generatePreview = useCallback(async (
    t: InvoiceTemplate,
    docType: "orden_matricula" | "factura_usa" = "orden_matricula",
  ) => {
    setPreviewLoading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const React = (await import("react")).default;
      let element: ReturnType<typeof React.createElement>;

      if (docType === "factura_usa") {
        const { FacturaUSADocument } = await import("@/lib/pdf-react/factura-usa");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        element = React.createElement(FacturaUSADocument, { data: USA_SAMPLE as any, _tpl: t });
      } else {
        const [{ OrdenMatriculaDocument }, { sampleData }] = await Promise.all([
          import("@/lib/pdf-react/orden-matricula"),
          import("@/lib/invoice-layout"),
        ]);
        element = React.createElement(OrdenMatriculaDocument, {
          data: sampleData() as Parameters<typeof OrdenMatriculaDocument>[0]["data"],
          tpl: t,
        });
      }

      const blob = await pdf(element).toBlob();
      const url = URL.createObjectURL(blob);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      console.error("Preview error:", e);
      toast.error("Error generando vista previa");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!savedTpl) return;
    const docType = getTemplateDocType(savedTpl);
    setPreviewDocType(docType);
    generatePreview(savedTpl, docType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTpl, generatePreview]);

  useEffect(() => {
    if (!editing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => generatePreview(editing, previewDocType), 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [editing, generatePreview, previewDocType]);

  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);

  if (loading || !user) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;
  if (!editing) return <p className="p-6 text-sm text-muted-foreground">Cargando plantilla…</p>;

  const update = <K extends keyof InvoiceTemplate>(k: K, v: InvoiceTemplate[K]) =>
    setEditing((t) => (t ? { ...t, [k]: v } : t));

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const { id: _id, ...rest } = editing;
    const { error } = await supabase
      .from("invoice_template")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    clearTemplateCache();
    setSavedTpl(editing);
    toast.success("Plantilla guardada");
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border flex-shrink-0 bg-card">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/plantillas")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver
        </Button>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-medium text-foreground truncate max-w-xs">{editing.nombre}</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => generatePreview(editing, previewDocType)} disabled={previewLoading}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", previewLoading && "animate-spin")} />
          Actualizar vista
        </Button>
        <Button size="sm" onClick={save} disabled={busy}>
          <Save className="mr-2 h-3.5 w-3.5" />
          {busy ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col bg-muted overflow-hidden">
          <div className="flex gap-1 px-3 py-2 border-b border-border bg-card flex-shrink-0">
            {(["orden_matricula", "factura_usa"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setPreviewDocType(type);
                  if (editing) generatePreview(editing, type);
                }}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  previewDocType === type
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {type === "orden_matricula" ? "Orden de Matrícula" : "Factura USA"}
              </button>
            ))}
          </div>
          <div className="flex-1 relative overflow-hidden">
            {previewLoading && !previewUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Generando vista previa…</span>
                </div>
              </div>
            )}
            {previewLoading && previewUrl && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow">
                <RefreshCw className="h-3 w-3 animate-spin" /> Actualizando…
              </div>
            )}
            {previewUrl && (
              <iframe key={previewUrl} src={previewUrl} className="w-full h-full border-0" title="Vista previa de la plantilla" />
            )}
          </div>
        </div>

        <div className="w-[380px] flex-shrink-0 border-l border-border overflow-y-auto bg-card">
          <div className="p-5 space-y-7">
            <Section title="Identificación">
              <Field label="Nombre de la plantilla">
                <Input value={editing.nombre} onChange={(e) => update("nombre", e.target.value)} />
              </Field>
              <Field label="Tipo de documento">
                <Select
                  value={getTemplateDocType(editing)}
                  onValueChange={(v: "orden_matricula" | "factura_usa") => {
                    const newLayout = { ...(editing.layout as object ?? {}), document_type: v };
                    update("layout", newLayout);
                    setPreviewDocType(v);
                    generatePreview({ ...editing, layout: newLayout }, v);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orden_matricula">Orden de Matrícula</SelectItem>
                    <SelectItem value="factura_usa">Factura USA</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Default para tipo de programa">
                <Select
                  value={editing.default_for ?? "_none"}
                  onValueChange={(v) => update("default_for", v === "_none" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sin asignar —</SelectItem>
                    <SelectItem value="Diplomado">Diplomado</SelectItem>
                    <SelectItem value="Especialización">Especialización</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={editing.is_default}
                  onChange={(e) => update("is_default", e.target.checked)}
                />
                Plantilla predeterminada
              </label>
            </Section>

            <Section title="Datos de la institución">
              <Field label="Nombre de la institución">
                <Input value={editing.institucion_nombre} onChange={(e) => update("institucion_nombre", e.target.value)} />
              </Field>
              <Field label="NIT">
                <Input value={editing.nit} onChange={(e) => update("nit", e.target.value)} />
              </Field>
              <Field label="Descripción legal (aparece en cabecera del PDF)">
                <Textarea rows={3} value={editing.descripcion_legal} onChange={(e) => update("descripcion_legal", e.target.value)} className="text-xs" />
              </Field>
            </Section>

            <Section title="Pie de página">
              <p className="text-xs text-muted-foreground -mt-3 mb-1">
                Estos textos aparecen en la parte inferior de la Orden de Matrícula.
              </p>
              <div className="space-y-1">
                <Field label="Medios de pago (texto en negrita)">
                  <Textarea rows={3} value={editing.medios_pago} onChange={(e) => update("medios_pago", e.target.value)} className="font-mono text-xs" placeholder="Bancolombia Cuenta Ahorros…" />
                </Field>
                {editing.medios_pago && <p className="text-right text-xs text-muted-foreground">{editing.medios_pago.length} caracteres</p>}
              </div>
              <div className="space-y-1">
                <Field label="Nota sobre retención en la fuente">
                  <Textarea rows={3} value={editing.nota_retencion} onChange={(e) => update("nota_retencion", e.target.value)} className="font-mono text-xs" placeholder="Favor NO HACER RETENCIÓN EN LA FUENTE…" />
                </Field>
                {editing.nota_retencion && <p className="text-right text-xs text-muted-foreground">{editing.nota_retencion.length} caracteres</p>}
              </div>
              <div className="space-y-1">
                <Field label="Nota legal final">
                  <Textarea rows={3} value={editing.nota_legal} onChange={(e) => update("nota_legal", e.target.value)} className="font-mono text-xs" placeholder="Régimen tributario especial…" />
                </Field>
                {editing.nota_legal && <p className="text-right text-xs text-muted-foreground">{editing.nota_legal.length} caracteres</p>}
              </div>
            </Section>

            <Section title="Fechas y recargos">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Field label="Recargo (%)">
                    <Input type="number" min={0} value={editing.recargo_pct} onChange={(e) => update("recargo_pct", Number(e.target.value))} />
                  </Field>
                  <p className="mt-1 text-xs text-muted-foreground">Por pago tardío</p>
                </div>
                <div>
                  <Field label="Días límite">
                    <Input type="number" min={0} value={editing.dias_limite} onChange={(e) => update("dias_limite", Number(e.target.value))} />
                  </Field>
                  <p className="mt-1 text-xs text-muted-foreground">Sin recargo</p>
                </div>
                <div>
                  <Field label="Días extra">
                    <Input type="number" min={0} value={editing.dias_extraordinario} onChange={(e) => update("dias_extraordinario", Number(e.target.value))} />
                  </Field>
                  <p className="mt-1 text-xs text-muted-foreground">Con recargo</p>
                </div>
              </div>
            </Section>

            <Button onClick={save} disabled={busy} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {busy ? "Guardando…" : "Guardar plantilla"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
