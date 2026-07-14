import { supabase } from "@/integrations/supabase/client";

export interface FormConfig {
  conceptos: string[];
  tipos_programa: string[];
  fields: Record<string, { visible: boolean; label: string }>;
}

const DEFAULT: FormConfig = {
  conceptos: ["Matrícula", "Matrícula parcial", "Inscripción", "Derecho de grado", "Certificado", "Otro"],
  tipos_programa: ["Diplomado", "Especialización"],
  fields: {
    email_estudiante: { visible: true, label: "Correo" },
    fecha_fin: { visible: true, label: "Fecha de finalización" },
    horas_programa: { visible: true, label: "Horas / Duración" },
    observaciones: { visible: true, label: "Observaciones" },
  },
};

let cached: FormConfig | null = null;

const GARBLED = /[\xc0-\xdf][\x80-\xbf]/;

export async function getFormConfig(): Promise<FormConfig> {
  if (cached) return cached;
  const { data } = await supabase.from("form_config").select("config").limit(1).maybeSingle();
  const merged = { ...DEFAULT, ...((data?.config ?? {}) as Partial<FormConfig>) };
  // Si tipos_programa contiene encoding roto (ej. "EspecializaciÃ³n"), usar DEFAULT
  if (merged.tipos_programa.some((t) => GARBLED.test(t))) {
    merged.tipos_programa = DEFAULT.tipos_programa;
  }
  // Sanitizar etiquetas de campos con encoding roto
  for (const key of Object.keys(merged.fields)) {
    if (GARBLED.test(merged.fields[key].label)) {
      merged.fields[key].label = DEFAULT.fields[key as keyof typeof DEFAULT.fields]?.label ?? merged.fields[key].label;
    }
  }
  cached = merged;
  return cached;
}

