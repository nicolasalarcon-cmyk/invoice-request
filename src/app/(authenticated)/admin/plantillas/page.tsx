"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { clearTemplateCache, getTemplateDocType, type InvoiceTemplate } from "@/lib/invoice-template";
import { Plus, Copy, Trash2, Star, LayoutTemplate, Pencil } from "lucide-react";

export default function PlantillasPage() {
  const { canManageTemplates: isAdmin, loading, user } = useAuth();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);

  const load = async () => {
    const { data } = await supabase.from("invoice_template").select("*").order("nombre");
    setTemplates((data ?? []) as InvoiceTemplate[]);
    clearTemplateCache();
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading || !user) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;

  const duplicate = async (t: InvoiceTemplate) => {
    const { id: _id, ...rest } = t;
    void _id;
    const { error } = await supabase
      .from("invoice_template")
      .insert({ ...rest, nombre: `${t.nombre} (copia)`, is_default: false });
    if (error) return toast.error(error.message);
    toast.success("Plantilla duplicada");
    load();
  };

  const remove = async (t: InvoiceTemplate) => {
    if (!t.id) return;
    if (!confirm(`¿Eliminar plantilla "${t.nombre}"?`)) return;
    const { error } = await supabase.from("invoice_template").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Plantilla eliminada");
    load();
  };

  const newTemplate = async (docType: "orden_matricula" | "factura_usa") => {
    const blank = {
      nombre: docType === "factura_usa" ? "Nueva plantilla Factura USA" : "Nueva plantilla",
      is_default: false,
      default_for: null,
      institucion_nombre: "Corporación Universitaria de Cataluña",
      nit: "NIT: 901.032.802-6",
      descripcion_legal: "",
      medios_pago: "",
      nota_retencion: "",
      nota_legal: "",
      recargo_pct: 10,
      dias_limite: 4,
      dias_extraordinario: 7,
      layout: docType === "factura_usa" ? { document_type: "factura_usa" } : null,
    };
    const { data, error } = await supabase.from("invoice_template").insert(blank).select().single();
    if (error || !data) return toast.error(error?.message ?? "Error creando plantilla");
    toast.success("Plantilla creada — editándola ahora");
    window.location.href = `/admin/plantillas/${(data as InvoiceTemplate).id}/editor`;
  };

  const DOC_LABELS: Record<string, string> = {
    orden_matricula: "Orden de Matrícula",
    factura_usa: "Factura USA",
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6" /> Plantillas de factura
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Haz clic en <strong>Editar</strong> para ajustar los textos y ver la vista previa en tiempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => newTemplate("factura_usa")}>
            <Plus className="mr-2 h-4 w-4" /> Nueva · Factura USA
          </Button>
          <Button onClick={() => newTemplate("orden_matricula")}>
            <Plus className="mr-2 h-4 w-4" /> Nueva · Orden de Matrícula
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {templates.map((t) => {
          const docType = getTemplateDocType(t);
          return (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{t.nombre}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {DOC_LABELS[docType]}
                    </Badge>
                    {t.is_default && (
                      <Badge variant="default">
                        <Star className="mr-1 h-3 w-3" /> Default {t.default_for ?? "general"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recargo {t.recargo_pct}% · Límite {t.dias_limite}d · Extra {t.dias_extraordinario}d
                  </p>
                  {t.medios_pago ? (
                    <p className="mt-2 text-xs text-muted-foreground truncate max-w-lg">
                      💳 {t.medios_pago.slice(0, 90)}{t.medios_pago.length > 90 ? "…" : ""}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-600">⚠ Sin texto de medios de pago</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {t.id && (
                    <Button size="sm" asChild>
                      <Link href={`/admin/plantillas/${t.id}/editor`}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                      </Link>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicate(t)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Eliminar" onClick={() => remove(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aún no hay plantillas.
          </p>
        )}
      </div>
    </main>
  );
}
