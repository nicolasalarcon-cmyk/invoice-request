import { supabase } from "@/integrations/supabase/client";

export interface Asesor {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
}

export async function listAsesores(soloActivos = true): Promise<Asesor[]> {
  let query = supabase.from("asesores").select("*").order("nombre");
  if (soloActivos) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Asesor[];
}
