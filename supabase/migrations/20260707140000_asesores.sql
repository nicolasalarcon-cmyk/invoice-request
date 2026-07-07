-- Catálogo de asesores comerciales: quienes realmente atienden al cliente,
-- distinto de la cuenta "Comercial" (jefe de área) que crea la solicitud.
-- El jefe selecciona a qué asesor corresponde cada solicitud al crearla.

CREATE TABLE IF NOT EXISTS public.asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asesores TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.asesores TO authenticated;
GRANT ALL ON public.asesores TO service_role;

ALTER TABLE public.asesores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read asesores"
  ON public.asesores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage asesores insert"
  ON public.asesores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage asesores update"
  ON public.asesores FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage asesores delete"
  ON public.asesores FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Nombre del asesor asignado a cada solicitud (dato denormalizado, igual que
-- comercial_nombre/comercial_email, para no depender de un join).
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS asesor_nombre text;
