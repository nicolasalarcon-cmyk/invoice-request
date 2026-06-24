import { supabase } from "@/integrations/supabase/client";

export interface CohorteRow {
  codigo: string;          // ej. ACT28
  fecha_inicio: string;
  fecha_finalizacion: string | null;
  convocatoria: string;
}

export async function listCohortesByNemonico(nemonico: string): Promise<CohorteRow[]> {
  const { data, error } = await supabase
    .from("cohortes")
    .select("programa_cohorte, fecha_inicio, fecha_finalizacion, convocatoria")
    .ilike("programa_cohorte", `${nemonico.trim().toUpperCase()}%`)
    .order("programa_cohorte");

  if (error) throw error;

  return (data ?? []).map((r) => ({
    codigo: r.programa_cohorte,
    fecha_inicio: r.fecha_inicio ?? "",
    fecha_finalizacion: r.fecha_finalizacion ?? null,
    convocatoria: r.convocatoria ?? "",
  }));
}
