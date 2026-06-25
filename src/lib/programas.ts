import { supabase } from "@/integrations/supabase/client";

export interface Programa {
  id: string;
  nombre: string;
  nemonico: string | null;
  tipo_programa: string | null;
  codigo_snies: string | null;
}

export async function listProgramas(): Promise<Programa[]> {
  const { data, error } = await supabase
    .from("programas")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as Programa[];
}
