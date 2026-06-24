-- 1) Ampliar invoice_template para soportar múltiples plantillas
ALTER TABLE public.invoice_template
  ADD COLUMN IF NOT EXISTS nombre text NOT NULL DEFAULT 'Plantilla principal',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_for text;

-- Quitar restricción de singleton si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_template_singleton_key'
  ) THEN
    ALTER TABLE public.invoice_template DROP CONSTRAINT invoice_template_singleton_key;
  END IF;
END $$;

ALTER TABLE public.invoice_template ALTER COLUMN singleton DROP NOT NULL;
ALTER TABLE public.invoice_template ALTER COLUMN singleton DROP DEFAULT;

-- Marcar la actual como default si no hay ninguna
UPDATE public.invoice_template
SET is_default = true
WHERE id = (SELECT id FROM public.invoice_template ORDER BY updated_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_template WHERE is_default = true);

-- Permitir DELETE a admins
CREATE POLICY "Admins can delete template"
ON public.invoice_template
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) template_id en invoice_requests
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.invoice_template(id) ON DELETE SET NULL;

-- 3) Tabla form_config (singleton con JSON)
CREATE TABLE IF NOT EXISTS public.form_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_config TO authenticated;
GRANT ALL ON public.form_config TO service_role;

ALTER TABLE public.form_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read form_config"
ON public.form_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage form_config"
ON public.form_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed inicial
INSERT INTO public.form_config (config)
SELECT '{
  "conceptos": ["Matrícula", "Matrícula parcial", "Inscripción", "Derecho de grado", "Certificado", "Otro"],
  "tipos_programa": ["Diplomado", "Especialización"],
  "fields": {
    "email_estudiante": {"visible": true, "label": "Correo"},
    "fecha_fin": {"visible": true, "label": "Fecha de finalización"},
    "horas_programa": {"visible": true, "label": "Horas / Duración"},
    "observaciones": {"visible": true, "label": "Observaciones"}
  }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.form_config);