import { supabase } from "@/integrations/supabase/client";

import type { Json } from "@/integrations/supabase/types";

export type TemplateDocType = "orden_matricula" | "factura_usa";

export function getTemplateDocType(t: InvoiceTemplate): TemplateDocType {
  const layout = t.layout as Record<string, unknown> | null | undefined;
  if (layout?.document_type === "factura_usa") return "factura_usa";
  return "orden_matricula";
}

export interface InvoiceTemplate {
  id?: string;
  nombre: string;
  is_default: boolean;
  default_for: string | null;
  institucion_nombre: string;
  nit: string;
  descripcion_legal: string;
  medios_pago: string;
  nota_retencion: string;
  nota_legal: string;
  recargo_pct: number;
  dias_limite: number;
  dias_extraordinario: number;
  layout?: Json;
}

const FALLBACK: InvoiceTemplate = {
  nombre: "Plantilla principal",
  is_default: true,
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
};

const cache = new Map<string, InvoiceTemplate>();
let defaultsLoaded = false;
const defaults = new Map<string, InvoiceTemplate>(); // key: tipo_programa or "_any"

export async function listTemplates(): Promise<InvoiceTemplate[]> {
  const { data } = await supabase.from("invoice_template").select("*").order("nombre");
  return (data ?? []) as InvoiceTemplate[];
}

export async function getInvoiceTemplate(idOrTipo?: string | null): Promise<InvoiceTemplate> {
  // by id
  if (idOrTipo && idOrTipo.length === 36) {
    if (cache.has(idOrTipo)) return cache.get(idOrTipo)!;
    const { data } = await supabase.from("invoice_template").select("*").eq("id", idOrTipo).maybeSingle();
    if (data) {
      cache.set(idOrTipo, data as InvoiceTemplate);
      return data as InvoiceTemplate;
    }
  }
  // by tipo_programa → default
  if (!defaultsLoaded) {
    const { data } = await supabase.from("invoice_template").select("*").eq("is_default", true);
    for (const t of (data ?? []) as InvoiceTemplate[]) {
      defaults.set(t.default_for ?? "_any", t);
    }
    defaultsLoaded = true;
  }
  const tipo = idOrTipo ?? "_any";
  return defaults.get(tipo) ?? defaults.get("_any") ?? [...defaults.values()][0] ?? FALLBACK;
}

export function clearTemplateCache() {
  cache.clear();
  defaults.clear();
  defaultsLoaded = false;
}
