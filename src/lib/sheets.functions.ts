import { supabase } from "@/integrations/supabase/client";

export interface CohorteRow {
  codigo: string;          // ej. ACT28
  fecha_inicio: string;
  fecha_finalizacion: string | null;
  convocatoria: string;
}

export async function listCohortesByNemonico(nemonico: string): Promise<CohorteRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (supabase as any).from("cohortes")
    .select("programa_cohorte, fecha_inicio, fecha_finalizacion, convocatoria")
    .ilike("programa_cohorte", `${nemonico.trim().toUpperCase()}%`)
    .order("programa_cohorte");
  const { data, error } = await q;

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    codigo: r.programa_cohorte,
    fecha_inicio: r.fecha_inicio ?? "",
    fecha_finalizacion: r.fecha_finalizacion ?? null,
    convocatoria: r.convocatoria ?? "",
  }));
}
